package library

import (
	"net/url"
	"strings"
)

// SourceShort renders a compact source label from a crawl URL, e.g.
// "https://witcher.fandom.com/wiki/Ciri" -> "witcher · wiki". Non-Fandom
// hosts fall back to the bare host; an unparseable URL yields "".
func SourceShort(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.ToLower(u.Host)
	if i := strings.Index(host, ".fandom.com"); i > 0 {
		return host[:i] + " · wiki"
	}
	return host
}
