package crawler

import (
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
