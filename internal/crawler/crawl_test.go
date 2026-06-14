package crawler

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// mediaWikiServer serves an action=parse JSON for known page titles (by the
// `page` query param), 404 otherwise.
func mediaWikiServer(t *testing.T, pages map[string]string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		title := r.URL.Query().Get("page")
		body, ok := pages[title]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		fmt.Fprintf(w, `{"parse":{"title":%q,"text":{"*":%q}}}`, title, body)
	}))
}

func TestCrawler_NoFollowSingleResult(t *testing.T) {
	srv := mediaWikiServer(t, map[string]string{
		"Root": `<div class="mw-parser-output"><p>` + strings.Repeat("word ", 30) + `</p></div>`,
	})
	defer srv.Close()
	c := Crawler{UserAgent: "UA/1", RateLimitMs: 0, MaxPages: 10}
	set, err := c.Crawl(srv.URL+"/wiki/Root", CrawlOptions{FollowLinks: 0})
	assert.NoError(t, err)
	assert.Len(t, set.Results, 1)
	assert.Equal(t, 0, set.Results[0].Depth)
}

func TestCrawler_OneHopRespectsCap(t *testing.T) {
	root := `<div class="mw-parser-output"><p>root ` +
		`<a href="/wiki/A">A</a><a href="/wiki/B">B</a><a href="/wiki/C">C</a></p></div>`
	srv := mediaWikiServer(t, map[string]string{
		"Root": root,
		"A":    `<div class="mw-parser-output"><p>a body</p></div>`,
		"B":    `<div class="mw-parser-output"><p>b body</p></div>`,
		"C":    `<div class="mw-parser-output"><p>c body</p></div>`,
	})
	defer srv.Close()
	c := Crawler{UserAgent: "UA/1", RateLimitMs: 0, MaxPages: 2}
	set, err := c.Crawl(srv.URL+"/wiki/Root", CrawlOptions{FollowLinks: 1})
	assert.NoError(t, err)
	assert.Len(t, set.Results, 2) // root + 1 hop, capped at MaxPages
	assert.Equal(t, 1, set.Results[1].Depth)
}

func TestCrawler_DedupesAndSkipsFailures(t *testing.T) {
	root := `<div class="mw-parser-output"><p>` +
		`<a href="/wiki/A">A</a><a href="/wiki/A">A again</a><a href="/wiki/Missing">M</a></p></div>`
	srv := mediaWikiServer(t, map[string]string{
		"Root": root,
		"A":    `<div class="mw-parser-output"><p>a body</p></div>`,
		// "Missing" intentionally absent -> 404, must be skipped
	})
	defer srv.Close()
	c := Crawler{UserAgent: "UA/1", RateLimitMs: 0, MaxPages: 10}
	set, err := c.Crawl(srv.URL+"/wiki/Root", CrawlOptions{FollowLinks: 1})
	assert.NoError(t, err)
	urls := []string{}
	for _, r := range set.Results {
		urls = append(urls, r.URL)
	}
	assert.Contains(t, urls, srv.URL+"/wiki/A")
	assert.Len(t, set.Results, 2) // root + A only
}

func TestExtractContent_SelectorPrecedence(t *testing.T) {
	fr := FetchResult{
		RawHTML: `<div class="mw-parser-output"><p>hi there</p></div>`,
	}
	sections, infobox := extractContent(fr, CrawlOptions{Selectors: []string{".mw-parser-output > p"}})
	assert.Len(t, sections, 1)
	assert.Equal(t, "hi there", sections[0].Body)
	assert.Nil(t, infobox)
}

func TestCrawler_WaitDelays(t *testing.T) {
	c := Crawler{RateLimitMs: 40}
	c.wait() // First call should not delay

	start := time.Now()
	c.wait() // Second call should delay ~40ms
	elapsed := time.Since(start)

	// Allow some margin for timing variance, but should be at least 30ms
	assert.GreaterOrEqual(t, elapsed, 30*time.Millisecond)
}


func TestCrawler_DedupesSamePageReachedViaAlias(t *testing.T) {
	// Root "Mine" links to an alias URL that the wiki resolves to the same page
	// (parse.title == "Mine"). The duplicate must not be collected twice.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Query().Get("page") {
		case "Mine":
			fmt.Fprint(w, `{"parse":{"title":"Mine","text":{"*":"<div class=\"mw-parser-output\"><p><a href=\"/wiki/Mine_(alias)\">m</a><a href=\"/wiki/Tatsumi\">t</a></p></div>"}}}`)
		case "Mine (alias)":
			fmt.Fprint(w, `{"parse":{"title":"Mine","text":{"*":"<div class=\"mw-parser-output\"><p>dup body</p></div>"}}}`)
		case "Tatsumi":
			fmt.Fprint(w, `{"parse":{"title":"Tatsumi","text":{"*":"<div class=\"mw-parser-output\"><p>tatsumi body</p></div>"}}}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	c := Crawler{UserAgent: "UA/1", MaxPages: 10}
	set, err := c.Crawl(srv.URL+"/wiki/Mine", CrawlOptions{FollowLinks: 1})
	assert.NoError(t, err)

	mine := 0
	titles := []string{}
	for _, r := range set.Results {
		titles = append(titles, r.Title)
		if r.Title == "Mine" {
			mine++
		}
	}
	assert.Equal(t, 1, mine, "the same page reached via an alias must be collected once")
	assert.Contains(t, titles, "Tatsumi")
}


func TestCrawler_TwoHopReachesDepth2(t *testing.T) {
	// Chain: Root -> A (hop 1) -> B (hop 2).
	srv := mediaWikiServer(t, map[string]string{
		"Root": `<div class="mw-parser-output"><p><a href="/wiki/A">a</a></p></div>`,
		"A":    `<div class="mw-parser-output"><p><a href="/wiki/B">b</a></p></div>`,
		"B":    `<div class="mw-parser-output"><p>b body</p></div>`,
	})
	defer srv.Close()

	depthOf := func(set CrawlSet, title string) (int, bool) {
		for _, r := range set.Results {
			if r.Title == title {
				return r.Depth, true
			}
		}
		return 0, false
	}

	// 1 hop: B (depth 2) must NOT be collected.
	c := Crawler{UserAgent: "UA/1", MaxPages: 50}
	oneHop, err := c.Crawl(srv.URL+"/wiki/Root", CrawlOptions{FollowLinks: 1})
	assert.NoError(t, err)
	_, hasB1 := depthOf(oneHop, "B")
	assert.False(t, hasB1, "B is 2 hops away; must be absent with FollowLinks=1")

	// 2 hops: B must be collected at depth 2.
	c2 := Crawler{UserAgent: "UA/1", MaxPages: 50}
	twoHop, err := c2.Crawl(srv.URL+"/wiki/Root", CrawlOptions{FollowLinks: 2})
	assert.NoError(t, err)
	dB, hasB2 := depthOf(twoHop, "B")
	assert.True(t, hasB2, "B must be reached with FollowLinks=2")
	assert.Equal(t, 2, dB)
}
