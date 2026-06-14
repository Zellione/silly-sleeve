package crawler

import (
	"sync"
	"time"
)

// Crawler runs a bounded breadth-first crawl starting at a root URL,
// following same-domain content links up to a depth and a global page cap,
// rate-limited between requests.
type Crawler struct {
	UserAgent   string
	RateLimitMs int
	MaxPages    int

	mu      sync.Mutex
	lastReq time.Time
}

// Crawl fetches the root page and (when opts.FollowLinks > 0) its same-domain
// links breadth-first. Failed page fetches are skipped. The returned CrawlSet
// contains the root first when it succeeds.
func (c *Crawler) Crawl(rootURL string, opts CrawlOptions) (CrawlSet, error) {
	maxPages := c.MaxPages
	if maxPages <= 0 {
		maxPages = 1
	}
	type queued struct {
		url, parent string
		depth       int
	}
	queue := []queued{{url: rootURL, depth: 0}}
	visited := map[string]bool{rootURL: true}
	set := CrawlSet{RootURL: rootURL}

	for len(queue) > 0 && len(set.Results) < maxPages {
		item := queue[0]
		queue = queue[1:]

		res, raw, ok := c.fetchOne(item.url, opts)
		if !ok {
			continue
		}
		res.Depth = item.depth
		res.ParentURL = item.parent
		set.Results = append(set.Results, res)

		if item.depth < opts.FollowLinks {
			for _, link := range SameDomainLinks(raw, item.url) {
				if visited[link] {
					continue
				}
				visited[link] = true
				queue = append(queue, queued{url: link, parent: item.url, depth: item.depth + 1})
			}
		}
	}
	return set, nil
}

// fetchOne fetches a single page (rate-limited), runs the extraction-precedence
// pipeline, and returns the CrawlResult plus the raw HTML used for link
// discovery. ok is false when the page should be skipped.
func (c *Crawler) fetchOne(pageURL string, opts CrawlOptions) (CrawlResult, string, bool) {
	c.wait()
	fr := FetchPageWith(pageURL, FetchOptions{UserAgent: c.UserAgent})
	if fr.Error != nil || fr.RawHTML == "" {
		fr = FetchReadable(pageURL, FetchOptions{UserAgent: c.UserAgent})
		if fr.Error != nil || fr.RawHTML == "" {
			return CrawlResult{}, "", false
		}
	}
	sections, infobox := extractContent(fr, opts)
	return CrawlResult{
		Title:       fr.Title,
		URL:         pageURL,
		Domain:      fr.Domain,
		RawHTML:     fr.RawHTML,
		Sections:    sections,
		Infobox:     infobox,
		WordCount:   TotalWordCount(sections, infobox),
		LatencyMs:   fr.LatencyMs,
		StatusCode:  200,
		IsMediaWiki: fr.IsMediaWiki,
	}, fr.RawHTML, true
}

// extractContent applies the extraction precedence: custom selectors, then
// native MediaWiki section parsing.
func extractContent(fr FetchResult, opts CrawlOptions) ([]Section, []InfoboxEntry) {
	if len(opts.Selectors) > 0 {
		return SectionsFromSelectors(fr.RawHTML, opts.Selectors), nil
	}
	return SectionsFromRawHTML(fr.RawHTML, opts.Include)
}

// wait enforces the inter-request delay.
func (c *Crawler) wait() {
	if c.RateLimitMs <= 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.lastReq.IsZero() {
		elapsed := time.Since(c.lastReq)
		if d := time.Duration(c.RateLimitMs)*time.Millisecond - elapsed; d > 0 {
			time.Sleep(d)
		}
	}
	c.lastReq = time.Now()
}
