package crawler

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	readability "github.com/go-shiori/go-readability"
)

// FetchReadable fetches an arbitrary HTML page and extracts its readable
// article content using go-readability. Used as a fallback for non-MediaWiki
// sites.
func FetchReadable(pageURL string, opts FetchOptions) FetchResult {
	start := time.Now()
	u, err := url.Parse(pageURL)
	if err != nil {
		return FetchResult{LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}
	if u.Scheme != "" && u.Scheme != "http" && u.Scheme != "https" {
		return FetchResult{LatencyMs: time.Since(start).Milliseconds(),
			Error: fmt.Errorf("unsupported URL scheme %q", u.Scheme)}
	}

	client := newSafeClient()
	req, err := http.NewRequest(http.MethodGet, pageURL, nil)
	if err != nil {
		return FetchResult{Domain: u.Hostname(), LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}
	if opts.UserAgent != "" {
		req.Header.Set("User-Agent", opts.UserAgent)
	}
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return FetchResult{Domain: u.Hostname(), LatencyMs: latency, Error: err}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FetchResult{Domain: u.Hostname(), LatencyMs: latency,
			Error: fmt.Errorf("%w: %d", ErrHTTPStatus, resp.StatusCode)}
	}

	limited := io.LimitReader(resp.Body, maxCrawlResponseBytes)
	article, err := readability.FromReader(limited, u)
	if err != nil {
		return FetchResult{Domain: u.Hostname(), LatencyMs: latency,
			Error: fmt.Errorf("readability: %w", err)}
	}
	if article.Content == "" {
		return FetchResult{Domain: u.Hostname(), LatencyMs: latency, Error: ErrEmptyResult}
	}
	return FetchResult{
		Title:       article.Title,
		Domain:      u.Hostname(),
		RawHTML:     article.Content,
		LatencyMs:   latency,
		IsMediaWiki: false,
	}
}
