package app

import (
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/loreextract"
)

// CrawlState is the persisted Crawler-screen state: the input parameters, the
// per-result role assignments, and the crawl set. It keeps the screen intact
// across tab switches and is saved into / restored from the project bundle.
type CrawlState struct {
	URL         string            `json:"url"`
	FollowLinks int               `json:"followLinks"`
	Include     map[string]bool   `json:"include"`
	Selectors   string            `json:"selectors"`
	Roles       map[string]string `json:"roles"`
	// Sent maps a crawled page URL to the role it was last sent as
	// ("character" | "lorebook"), so the list can mark already-sent pages.
	Sent map[string]string `json:"sent"`
	Set  *crawler.CrawlSet `json:"set"`
}

// GetCrawlState returns the current Crawler-screen state for restoring the
// screen after navigation or on project load.
func (a *App) GetCrawlState() CrawlState {
	a.mu.Lock()
	defer a.mu.Unlock()
	st := a.crawlInputs
	st.Set = a.cachedCrawlSet
	return st
}

// SaveCrawlState stores the Crawler-screen input parameters and role
// assignments. The crawl set itself is owned by CrawlPage/RemoveCrawlResult, so
// the incoming Set is ignored here.
func (a *App) SaveCrawlState(s CrawlState) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.crawlInputs = CrawlState{
		URL:         s.URL,
		FollowLinks: s.FollowLinks,
		Include:     s.Include,
		Selectors:   s.Selectors,
		Roles:       s.Roles,
		Sent:        s.Sent,
	}
}

// ClearCrawl empties the crawl list (the set and its role assignments),
// leaving the input parameters so the user can re-crawl. Staged sources and
// their pending candidates go too: extraction reads the page text out of the
// crawl set, so a staged source outliving its page could never be extracted.
// Approved entries are untouched — they are part of the lorebook now.
func (a *App) ClearCrawl() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.cachedCrawlSet = nil
	a.cachedCrawl = nil
	a.crawlInputs.Roles = map[string]string{}
	a.crawlInputs.Sent = map[string]string{}
	a.stagedSources = nil
	a.loreCandidates = nil
}

// CrawlSendResult is the project state after distributing crawl results.
type CrawlSendResult struct {
	Characters   []compose.Character        `json:"characters"`
	Lorebook     []lorebook.Entry           `json:"lorebook"`
	Staged       []loreextract.StagedSource `json:"staged"`
	ActiveCharID int                        `json:"activeCharId"`
}

// SendCrawlOutcome reports the result of sending one crawled page to the
// project. Status is one of:
//
//	created       a character stub was added
//	overwritten   an existing character was repointed at this page
//	staged        the page was queued for lorebook extraction
//	restaged      an already-staged page was queued again
//	needs_confirm the page has already been sent; retry with overwrite=true
//	missing       no such page in the crawl, or an unknown role
//
// Result carries the updated project state for every status except
// "needs_confirm".
type SendCrawlOutcome struct {
	Status string          `json:"status"`
	Kind   string          `json:"kind"`
	Name   string          `json:"name"`
	Result CrawlSendResult `json:"result"`
}

// SendCrawlResult sends a single crawled page to the project, recording its
// origin page in SourceURL. Sending a duplicate returns "needs_confirm" unless
// overwrite is true.
//
// The two roles behave differently on purpose. A character page becomes a
// character stub immediately, because a page maps to one character and the
// editor fills the fields in. A lorebook page does not become an entry: it is
// staged for extraction. One wiki page is many lorebook facts, and which of
// them are worth keeping — and what should trigger each — is a judgement the
// user makes after seeing them.
//
// No LLM calls happen here. Generation runs from the editors, and extraction
// from the lorebook screen.
func (a *App) SendCrawlResult(pageURL, role string, overwrite bool) SendCrawlOutcome {
	a.mu.Lock()
	defer a.mu.Unlock()

	res, ok := a.crawlResultByURLLocked(pageURL)
	if !ok {
		return SendCrawlOutcome{Status: "missing"}
	}

	var status string
	switch role {
	case "character":
		status = a.sendCharacterLocked(res, overwrite)
	case "lorebook":
		status = a.sendLorebookLocked(res, overwrite)
	default:
		return SendCrawlOutcome{Status: "missing"}
	}

	out := SendCrawlOutcome{Status: status, Kind: role, Name: res.Title}
	if status != "needs_confirm" {
		out.Result = CrawlSendResult{
			Characters:   a.characters,
			Lorebook:     a.lorebookEntries,
			Staged:       a.stagedSources,
			ActiveCharID: a.activeCharID,
		}
	}
	return out
}

// crawlResultByURLLocked finds a cached crawl result by URL. Caller holds a.mu.
func (a *App) crawlResultByURLLocked(pageURL string) (crawler.CrawlResult, bool) {
	if a.cachedCrawlSet == nil {
		return crawler.CrawlResult{}, false
	}
	for _, r := range a.cachedCrawlSet.Results {
		if r.URL == pageURL {
			return r, true
		}
	}
	return crawler.CrawlResult{}, false
}

// sendCharacterLocked creates a character stub from a crawl result, or
// overwrites the existing character of the same name. Caller holds a.mu.
func (a *App) sendCharacterLocked(res crawler.CrawlResult, overwrite bool) string {
	name := strings.TrimSpace(res.Title)
	for i := range a.characters {
		if strings.EqualFold(strings.TrimSpace(a.characters[i].Name), name) {
			if !overwrite {
				return "needs_confirm"
			}
			a.characters[i].SourceURL = res.URL
			a.activeCharID = a.characters[i].ID
			return "overwritten"
		}
	}
	a.appendCharacterFromCrawl(res)
	return "created"
}

// sendLorebookLocked stages a crawled page for lorebook extraction. It
// deliberately creates no entry: the previous behaviour dumped every section
// body of the page into a single entry with no keywords, producing something
// that could never fire in SillyTavern and blew the token budget if it did.
// Caller holds a.mu.
func (a *App) sendLorebookLocked(res crawler.CrawlResult, overwrite bool) string {
	if i, ok := a.stagedSourceIndexLocked(res.URL); ok {
		if !overwrite {
			return "needs_confirm"
		}
		// Re-staging clears the extracted flag and the pending candidates, so
		// the page is extracted afresh rather than accumulating duplicates.
		a.stagedSources[i].Title = res.Title
		a.stagedSources[i].Extracted = false
		a.dropCandidatesLocked(res.URL)
		return "restaged"
	}

	if a.hasApprovedEntriesLocked(res.URL) && !overwrite {
		return "needs_confirm"
	}

	a.stagedSources = append(a.stagedSources, loreextract.StagedSource{
		URL:   res.URL,
		Title: res.Title,
		Mode:  loreextract.ModeSplit,
	})
	return "staged"
}

// stagedSourceIndexLocked finds a staged source by page URL. Caller holds a.mu.
func (a *App) stagedSourceIndexLocked(pageURL string) (int, bool) {
	for i := range a.stagedSources {
		if a.stagedSources[i].URL == pageURL {
			return i, true
		}
	}
	return 0, false
}

// hasApprovedEntriesLocked reports whether the lorebook already holds entries
// extracted from a page. Caller holds a.mu.
func (a *App) hasApprovedEntriesLocked(pageURL string) bool {
	for _, e := range a.lorebookEntries {
		if e.SourceURL != "" && e.SourceURL == pageURL {
			return true
		}
	}
	return false
}

// dropCandidatesLocked removes the pending candidates from a page. Caller holds a.mu.
func (a *App) dropCandidatesLocked(pageURL string) {
	kept := make([]loreextract.Candidate, 0, len(a.loreCandidates))
	for _, c := range a.loreCandidates {
		if c.SourceURL != pageURL {
			kept = append(kept, c)
		}
	}
	a.loreCandidates = kept
}

// dropStagedSourceLocked removes a staged source and its pending candidates.
// Caller holds a.mu.
func (a *App) dropStagedSourceLocked(pageURL string) {
	if i, ok := a.stagedSourceIndexLocked(pageURL); ok {
		a.stagedSources = append(a.stagedSources[:i], a.stagedSources[i+1:]...)
	}
	a.dropCandidatesLocked(pageURL)
}

// appendCharacterFromCrawl adds a new character stub. Caller holds a.mu.
func (a *App) appendCharacterFromCrawl(res crawler.CrawlResult) {
	ch := compose.NewCharacter(a.nextCharID())
	if res.Title != "" {
		ch.Name = res.Title
	}
	ch.SourceURL = res.URL
	a.characters = append(a.characters, ch)
	a.activeCharID = ch.ID
}

// RemoveCrawlResult removes the crawled page with the given URL from the cached
// crawl set and returns the updated set. The legacy single-result cache is kept
// in sync with the new root (or cleared when the set becomes empty). Any staging
// for that page goes too, since extraction reads the page text from the set.
func (a *App) RemoveCrawlResult(pageURL string) crawler.CrawlSet {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.dropStagedSourceLocked(pageURL)
	if a.cachedCrawlSet == nil {
		return crawler.CrawlSet{}
	}

	filtered := make([]crawler.CrawlResult, 0, len(a.cachedCrawlSet.Results))
	for _, r := range a.cachedCrawlSet.Results {
		if r.URL != pageURL {
			filtered = append(filtered, r)
		}
	}
	a.cachedCrawlSet.Results = filtered

	if len(filtered) > 0 {
		root := filtered[0]
		a.cachedCrawl = &root
	} else {
		a.cachedCrawl = nil
	}
	return *a.cachedCrawlSet
}
