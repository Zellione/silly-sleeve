package app

import (
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
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
// leaving the input parameters so the user can re-crawl.
func (a *App) ClearCrawl() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.cachedCrawlSet = nil
	a.cachedCrawl = nil
	a.crawlInputs.Roles = map[string]string{}
	a.crawlInputs.Sent = map[string]string{}
}

// CrawlSendResult is the project state after distributing crawl results.
type CrawlSendResult struct {
	Characters   []compose.Character `json:"characters"`
	Lorebook     []lorebook.Entry    `json:"lorebook"`
	ActiveCharID int                 `json:"activeCharId"`
}

// SendCrawlOutcome reports the result of sending one crawled page to the
// project. Status is "created", "overwritten", "needs_confirm", or "missing".
// On "needs_confirm" the caller should ask the user to overwrite the existing
// item (named Name, of kind Kind) and retry with overwrite=true. Result carries
// the updated project state for the "created" and "overwritten" statuses.
type SendCrawlOutcome struct {
	Status string          `json:"status"`
	Kind   string          `json:"kind"`
	Name   string          `json:"name"`
	Result CrawlSendResult `json:"result"`
}

// SendCrawlResult sends a single crawled page to the project as a character or
// lorebook entry, recording its origin page in SourceURL. Characters are unique
// by name and lorebook entries by source page; sending a duplicate returns
// "needs_confirm" unless overwrite is true, in which case the existing item is
// replaced in place. No LLM calls happen here — generation occurs in the editors.
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

// sendLorebookLocked creates a lorebook entry from a crawl result, or
// overwrites the existing entry from the same source page. Caller holds a.mu.
func (a *App) sendLorebookLocked(res crawler.CrawlResult, overwrite bool) string {
	for i := range a.lorebookEntries {
		if a.lorebookEntries[i].SourceURL != "" && a.lorebookEntries[i].SourceURL == res.URL {
			if !overwrite {
				return "needs_confirm"
			}
			a.lorebookEntries[i].Comment = res.Title
			a.lorebookEntries[i].Content = crawlPlainText(res)
			return "overwritten"
		}
	}
	a.appendLorebookFromCrawl(res)
	return "created"
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

// appendLorebookFromCrawl adds a new lorebook entry seeded with page text.
// Caller holds a.mu.
func (a *App) appendLorebookFromCrawl(res crawler.CrawlResult) {
	uid := 1
	for _, e := range a.lorebookEntries {
		if e.UID >= uid {
			uid = e.UID + 1
		}
	}
	a.lorebookEntries = append(a.lorebookEntries, lorebook.Entry{
		UID:        uid,
		Comment:    res.Title,
		Content:    crawlPlainText(res),
		Key:        []string{},
		Characters: []string{},
		SourceURL:  res.URL,
	})
}

// crawlPlainText joins a result's non-empty section bodies into seed content.
func crawlPlainText(res crawler.CrawlResult) string {
	var b []string
	for _, s := range res.Sections {
		if s.Body != "" {
			b = append(b, s.Body)
		}
	}
	return strings.Join(b, "\n\n")
}


// RemoveCrawlResult removes the crawled page with the given URL from the cached
// crawl set and returns the updated set. The legacy single-result cache is kept
// in sync with the new root (or cleared when the set becomes empty).
func (a *App) RemoveCrawlResult(pageURL string) crawler.CrawlSet {
	a.mu.Lock()
	defer a.mu.Unlock()
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
