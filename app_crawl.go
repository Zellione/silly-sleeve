package main

import (
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
)

// CrawlAssignment maps a crawled page URL to a target role.
type CrawlAssignment struct {
	URL  string `json:"url"`
	Role string `json:"role"` // "character" | "lorebook" | "skip"
}

// CrawlSendResult is the project state after distributing crawl results.
type CrawlSendResult struct {
	Characters   []compose.Character `json:"characters"`
	Lorebook     []lorebook.Entry    `json:"lorebook"`
	ActiveCharID int                 `json:"activeCharId"`
}

// SendCrawlToProject creates character / lorebook stubs from assigned crawl
// results. Each stub records its origin page in SourceURL. No LLM calls happen
// here — generation occurs later in the editors.
func (a *App) SendCrawlToProject(assignments []CrawlAssignment) CrawlSendResult {
	a.mu.Lock()
	defer a.mu.Unlock()

	byURL := map[string]crawler.CrawlResult{}
	if a.cachedCrawlSet != nil {
		for _, r := range a.cachedCrawlSet.Results {
			byURL[r.URL] = r
		}
	}

	for _, as := range assignments {
		res, ok := byURL[as.URL]
		if !ok {
			continue
		}
		switch as.Role {
		case "character":
			a.appendCharacterFromCrawl(res)
		case "lorebook":
			a.appendLorebookFromCrawl(res)
		}
	}

	return CrawlSendResult{
		Characters:   a.characters,
		Lorebook:     a.lorebookEntries,
		ActiveCharID: a.activeCharID,
	}
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
		UID:       uid,
		Comment:   res.Title,
		Content:   crawlPlainText(res),
		Key:       []string{},
		SourceURL: res.URL,
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
