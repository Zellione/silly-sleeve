package crawler

import (
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// SectionsFromSelectors extracts one Section per node matched by any of the
// given CSS selectors, in document order. The heading is taken from the node's
// own heading text when it is a heading element, otherwise left blank.
func SectionsFromSelectors(rawHTML string, selectors []string) []Section {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}
	sel := strings.Join(selectors, ", ")
	if strings.TrimSpace(sel) == "" {
		return nil
	}
	var out []Section
	doc.Find(sel).Each(func(_ int, s *goquery.Selection) {
		text := strings.TrimSpace(s.Text())
		if text == "" {
			return
		}
		heading := ""
		if goquery.NodeName(s) == "h2" || goquery.NodeName(s) == "h3" {
			heading = text
			text = ""
		}
		out = append(out, Section{Heading: heading, Body: text, Level: 2})
	})
	return out
}

// SameDomainLinks returns absolute, deduped, same-domain wiki content links
// found in the page body, excluding MediaWiki Special:/File:/Category: pages.
func SameDomainLinks(rawHTML, baseURL string) []string {
	base, err := url.Parse(baseURL)
	if err != nil {
		return nil
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	doc.Find(".mw-parser-output a[href], article a[href], main a[href]").Each(func(_ int, s *goquery.Selection) {
		href, ok := s.Attr("href")
		if !ok {
			return
		}
		ref, err := base.Parse(href)
		if err != nil || ref.Hostname() != base.Hostname() {
			return
		}
		ref.Fragment = ""
		if isExcludedWikiPath(ref.Path) {
			return
		}
		abs := ref.String()
		if abs == "" || abs == baseURL || seen[abs] {
			return
		}
		seen[abs] = true
		out = append(out, abs)
	})
	return out
}

func isExcludedWikiPath(p string) bool {
	for _, ns := range []string{"Special:", "File:", "Category:", "Template:", "Help:", "User:"} {
		if strings.Contains(p, "/"+ns) || strings.Contains(p, ":"+ns) {
			return true
		}
	}
	return false
}
