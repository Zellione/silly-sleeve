package crawler

import (
	"net/url"
	"strings"
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
	// linksPerPage bounds how many new links each page contributes. For a single
	// hop we follow everything (breadth), but for multi-hop crawls we cap the
	// fan-out so the page budget isn't consumed entirely by hop-1 links before
	// any deeper hop is reached.
	linksPerPage := maxPages
	if opts.FollowLinks >= 2 {
		linksPerPage = max(maxPages/opts.FollowLinks, 2)
	}
	queue := []queuedPage{{url: rootURL, depth: 0}}
	visited := map[string]bool{normalizeURL(rootURL): true}
	seenPages := map[string]bool{}
	set := CrawlSet{RootURL: rootURL}

	for len(queue) > 0 && len(set.Results) < maxPages {
		item := queue[0]
		queue = queue[1:]

		res, raw, ok := c.fetchOne(item.url, opts)
		if !ok || !claimPage(seenPages, res) {
			continue
		}

		res.Depth = item.depth
		res.ParentURL = item.parent
		set.Results = append(set.Results, res)

		if item.depth < opts.FollowLinks {
			queue = appendChildLinks(queue, raw, item, visited, linksPerPage)
		}
	}
	return set, nil
}

// queuedPage is a page awaiting fetch in the breadth-first queue.
type queuedPage struct {
	url, parent string
	depth       int
}

// claimPage records res as seen and reports whether it is new. A page already
// collected under a different URL form (e.g. a MediaWiki redirect/alias
// resolving to the same page) is rejected.
func claimPage(seenPages map[string]bool, res CrawlResult) bool {
	id := pageIdentity(res)
	if seenPages[id] {
		return false
	}
	seenPages[id] = true
	return true
}

// appendChildLinks enqueues up to linksPerPage not-yet-visited same-domain
// links found in raw, marking them visited, and returns the extended queue.
func appendChildLinks(queue []queuedPage, raw string, item queuedPage, visited map[string]bool, linksPerPage int) []queuedPage {
	enqueued := 0
	for _, link := range SameDomainLinks(raw, item.url) {
		if enqueued >= linksPerPage {
			break
		}
		key := normalizeURL(link)
		if visited[key] {
			continue
		}
		visited[key] = true
		queue = append(queue, queuedPage{url: link, parent: item.url, depth: item.depth + 1})
		enqueued++
	}
	return queue
}

// pageIdentity returns a key identifying the underlying page so the same page
// reached via different URL forms is only collected once. A MediaWiki page
// title is unique per domain, so (domain, title) identifies it; non-wiki pages
// (empty/duplicate titles) fall back to the normalized URL.
func pageIdentity(res CrawlResult) string {
	if res.IsMediaWiki && res.Title != "" {
		return strings.ToLower(res.Domain + "\x00" + res.Title)
	}
	return normalizeURL(res.URL)
}

// normalizeURL canonicalizes a URL for dedup: it lowercases the host, drops the
// fragment, and trims a trailing slash from the path.
func normalizeURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	u.Fragment = ""
	u.Host = strings.ToLower(u.Host)
	if len(u.Path) > 1 {
		u.Path = strings.TrimRight(u.Path, "/")
	}
	return u.String()
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
