package crawler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// FetchResult holds the raw API response data.
type FetchResult struct {
	Title     string
	Domain    string
	RawHTML   string
	LatencyMs int64
	Error     error
}

// FetchPage fetches a wiki page via the MediaWiki action=parse API.
func FetchPage(pageURL string) FetchResult {
	start := time.Now()

	u, err := url.Parse(pageURL)
	if err != nil {
		return FetchResult{LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}

	domain, title, err := parseMediaWikiURLFromURL(u)
	if err != nil {
		return FetchResult{LatencyMs: time.Since(start).Milliseconds(), Error: err}
	}

	apiURL := buildParseURLWithScheme(u.Scheme, domain, title)
	if u.Scheme == "" {
		apiURL = buildParseURL(domain, title)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(apiURL)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return FetchResult{Domain: domain, LatencyMs: latency, Error: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return FetchResult{
			Domain:    domain,
			LatencyMs: latency,
			Error:     fmt.Errorf("HTTP %d", resp.StatusCode),
		}
	}

	var body struct {
		Parse struct {
			Title string `json:"title"`
			Text  struct {
				Content string `json:"*"`
			} `json:"text"`
		} `json:"parse"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return FetchResult{Domain: domain, LatencyMs: latency, Error: fmt.Errorf("parse response: %w", err)}
	}

	if body.Parse.Title == "" && body.Parse.Text.Content == "" {
		return FetchResult{
			Domain:    domain,
			LatencyMs: latency,
			Error:     fmt.Errorf("empty parse result"),
		}
	}

	return FetchResult{
		Title:     body.Parse.Title,
		Domain:    domain,
		RawHTML:   body.Parse.Text.Content,
		LatencyMs: latency,
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
