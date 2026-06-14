package crawler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// maxCrawlResponseBytes caps the MediaWiki API response read from an untrusted
// wiki host, guarding against memory exhaustion.
const maxCrawlResponseBytes = 32 << 20 // 32 MiB

// Sentinel errors so callers can classify fetch failures with errors.Is.
var (
	ErrHTTPStatus  = errors.New("non-2xx HTTP status")
	ErrEmptyResult = errors.New("empty parse result")
)

// isBlockedIP reports whether an IP is in a range we refuse to be redirected
// to: loopback, private, link-local (incl. cloud metadata at 169.254.169.254),
// and unspecified addresses.
func isBlockedIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

// checkRedirectTarget rejects redirects to non-http(s) schemes or to hosts that
// resolve into a blocked IP range. The user's originally entered host is
// trusted; this guards against a malicious wiki redirecting the request to an
// internal address (SSRF).
func checkRedirectTarget(u *url.URL) error {
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("refusing redirect to scheme %q", u.Scheme)
	}
	host := u.Hostname()
	if ip := net.ParseIP(host); ip != nil {
		if isBlockedIP(ip) {
			return fmt.Errorf("refusing redirect to blocked address %s", host)
		}
		return nil
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("resolve redirect host %s: %w", host, err)
	}
	for _, ip := range ips {
		if isBlockedIP(ip) {
			return fmt.Errorf("refusing redirect to blocked address %s (%s)", host, ip)
		}
	}
	return nil
}

// newSafeClient returns an HTTP client that caps redirects and refuses to
// follow redirects into blocked IP ranges or non-http(s) schemes.
func newSafeClient() *http.Client {
	return &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("stopped after 5 redirects")
			}
			return checkRedirectTarget(req.URL)
		},
	}
}

// FetchResult holds the raw API response data.
type FetchResult struct {
	Title       string
	Domain      string
	RawHTML     string
	LatencyMs   int64
	IsMediaWiki bool
	Error       error
}

type mediaWikiParseResponse struct {
	Parse struct {
		Title string `json:"title"`
		Text  struct {
			Content string `json:"*"`
		} `json:"text"`
	} `json:"parse"`
}

// FetchOptions tunes a single page fetch.
type FetchOptions struct {
	UserAgent string
}

// FetchPage fetches a wiki page with default options (kept for back-compat).
func FetchPage(pageURL string) FetchResult {
	return FetchPageWith(pageURL, FetchOptions{})
}

// FetchPageWith fetches a wiki page via the MediaWiki action=parse API with configurable options.
func FetchPageWith(pageURL string, opts FetchOptions) FetchResult {
	start := time.Now()

	u, err := url.Parse(pageURL)
	if err != nil {
		fmt.Println("[crawler] URL parse error:", err)
		return FetchResult{LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}

	domain, title, err := parseMediaWikiURLFromURL(u)
	if err != nil {
		fmt.Println("[crawler] parseMediaWikiURL error:", err)
		return FetchResult{LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}

	if u.Scheme != "" && u.Scheme != "http" && u.Scheme != "https" {
		err := fmt.Errorf("unsupported URL scheme %q", u.Scheme)
		return FetchResult{Domain: domain, LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}

	apiURL := buildParseURLWithScheme(u.Scheme, domain, title)
	if u.Scheme == "" {
		apiURL = buildParseURL(domain, title)
	}

	client := newSafeClient()
	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return FetchResult{Domain: domain, LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}
	if opts.UserAgent != "" {
		req.Header.Set("User-Agent", opts.UserAgent)
	}
	fmt.Println("[crawler] GET", apiURL)
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		fmt.Println("[crawler] HTTP error:", err)
		return FetchResult{Domain: domain, LatencyMs: latency, Error: err}
	}
	defer resp.Body.Close()

	fmt.Printf("[crawler] HTTP %d (%.0f ms)\n", resp.StatusCode, float64(latency))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FetchResult{
			Domain:    domain,
			LatencyMs: latency,
			Error:     fmt.Errorf("%w: %d", ErrHTTPStatus, resp.StatusCode),
		}
	}

	var body mediaWikiParseResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxCrawlResponseBytes)).Decode(&body); err != nil {
		fmt.Println("[crawler] JSON decode error:", err)
		return FetchResult{Domain: domain, LatencyMs: latency, Error: fmt.Errorf("parse response: %w", err)}
	}

	if body.Parse.Title == "" && body.Parse.Text.Content == "" {
		fmt.Println("[crawler] empty parse result (both title and content are empty)")
		return FetchResult{
			Domain:    domain,
			LatencyMs: latency,
			Error:     ErrEmptyResult,
		}
	}

	fmt.Printf("[crawler] parsed title=%q contentLen=%d\n", body.Parse.Title, len(body.Parse.Text.Content))

	return FetchResult{
		Title:       body.Parse.Title,
		Domain:      domain,
		RawHTML:     body.Parse.Text.Content,
		LatencyMs:   latency,
		IsMediaWiki: true,
	}
}

func buildParseURL(domain, title string) string {
	return fmt.Sprintf("https://%s/api.php?action=parse&page=%s&prop=text&format=json", domain, url.PathEscape(title))
}

func buildParseURLWithScheme(scheme, domain, title string) string {
	return fmt.Sprintf("%s://%s/api.php?action=parse&page=%s&prop=text&format=json", scheme, domain, url.PathEscape(title))
}

func parseMediaWikiURL(pageURL string) (domain, title string, err error) {
	u, err := url.Parse(pageURL)
	if err != nil {
		return "", "", fmt.Errorf("invalid URL: %w", err)
	}
	return parseMediaWikiURLFromURL(u)
}

func parseMediaWikiURLFromURL(u *url.URL) (domain, title string, err error) {
	if u.Host == "" {
		return "", "", fmt.Errorf("URL has no host: %s", u.String())
	}
	domain = u.Host

	path := strings.TrimPrefix(u.Path, "/")
	path = strings.TrimSuffix(path, "/")

	parts := strings.Split(path, "/")
	if len(parts) >= 2 && parts[0] == "wiki" {
		title = parts[1]
	} else if len(parts) >= 1 {
		title = parts[len(parts)-1]
	} else {
		title = strings.ReplaceAll(path, " ", "_")
	}

	if title == "" {
		return "", "", fmt.Errorf("could not extract page title from URL: %s", u.String())
	}
	title = strings.ReplaceAll(title, "_", " ")
	return domain, title, nil
}
