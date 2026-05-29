package crawler

import (
	"fmt"
	"strings"

	"golang.org/x/net/html"
)

var skipClasses = map[string]bool{
	"navbox":                 true,
	"navbox-styles":          true,
	"navbox-inner":           true,
	"mw-editsection":         true,
	"mw-editsection-bracket": true,
	"mw-empty-elt":           true,
	"mw-reflink-text":        true,
	"mw-cite-backlink":       true,
	"visualClear":            true,
	"portable-infobox":       true,
	"toccolours":             true,
	"mw-collapsible":         true,
	"mw-collapsed":           true,
}

var skipTags = map[string]bool{
	"script":   true,
	"style":    true,
	"noscript": true,
	"sup":      true,
}

func findAttr(node *html.Node, key string) string {
	for _, a := range node.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func hasClass(node *html.Node, class string) bool {
	cls := findAttr(node, "class")
	if cls == "" {
		return false
	}
	for _, c := range strings.Fields(cls) {
		if c == class {
			return true
		}
	}
	return false
}

func hasID(node *html.Node, id string) bool {
	return findAttr(node, "id") == id
}

func shouldSkip(node *html.Node) bool {
	if node.Type != html.ElementNode {
		return false
	}
	if skipTags[node.Data] {
		return true
	}
	if node.Data == "aside" && hasClass(node, "portable-infobox") {
		return true
	}
	if node.Data == "table" || node.Data == "div" || node.Data == "span" {
		for c := range skipClasses {
			if hasClass(node, c) {
				return true
			}
		}
	}
	if hasID(node, "toc") {
		return true
	}
	if node.Data == "ol" && hasClass(node, "references") {
		return true
	}
	return false
}

func shouldSkipSections(node *html.Node, include map[string]bool) bool {
	if node.Type != html.ElementNode {
		return false
	}
	if node.Data == "ul" && hasClass(node, "gallery") {
		return !include["gallery"]
	}
	return shouldSkip(node)
}

func getTextContent(node *html.Node) string {
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if shouldSkip(n) {
			return
		}
		if n.Type == html.TextNode {
			buf.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	for c := node.FirstChild; c != nil; c = c.NextSibling {
		walk(c)
	}
	return strings.TrimSpace(buf.String())
}

func getParagraphText(node *html.Node) string {
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if shouldSkip(n) {
			return
		}
		if n.Type == html.ElementNode && n.Data == "br" {
			buf.WriteString("\n")
			return
		}
		if n.Type == html.TextNode {
			text := strings.ReplaceAll(n.Data, "\u00a0", " ")
			text = strings.ReplaceAll(text, "\t", " ")
			text = strings.ReplaceAll(text, "\r", " ")
			text = strings.ReplaceAll(text, "\n", " ")
			buf.WriteString(text)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	for c := node.FirstChild; c != nil; c = c.NextSibling {
		walk(c)
	}
	result := buf.String()
	for strings.Contains(result, "  ") {
		result = strings.ReplaceAll(result, "  ", " ")
	}
	for strings.Contains(result, " \n") {
		result = strings.ReplaceAll(result, " \n", "\n")
	}
	for strings.Contains(result, "\n ") {
		result = strings.ReplaceAll(result, "\n ", "\n")
	}
	for strings.Contains(result, "\n\n\n") {
		result = strings.ReplaceAll(result, "\n\n\n", "\n\n")
	}
	return strings.TrimSpace(result)
}

func cleanParagraph(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\u00a0", " ")
	var out []rune
	inSpace := false
	for _, r := range s {
		switch {
		case r == '\t' || r == '\r':
			if !inSpace {
				out = append(out, ' ')
				inSpace = true
			}
		case r == '\n':
			out = append(out, '\n')
			inSpace = false
		case r == ' ':
			if !inSpace {
				out = append(out, ' ')
				inSpace = true
			}
		default:
			out = append(out, r)
			inSpace = false
		}
	}
	return strings.TrimSpace(string(out))
}

// ExtractInfobox parses infobox key/value pairs from raw HTML.
func ExtractInfobox(rawHTML string) []InfoboxEntry {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}

	var entries []InfoboxEntry
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			if n.Data == "table" && hasClass(n, "infobox") {
				entries = extractTableInfobox(n)
				return
			}
			if n.Data == "aside" && hasClass(n, "portable-infobox") {
				entries = extractPortableInfobox(n)
				return
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return entries
}

func extractTableInfobox(table *html.Node) []InfoboxEntry {
	var entries []InfoboxEntry
	for tr := table.FirstChild; tr != nil; tr = tr.NextSibling {
		if tr.Type != html.ElementNode || tr.Data != "tbody" {
			continue
		}
		for row := tr.FirstChild; row != nil; row = row.NextSibling {
			if row.Type != html.ElementNode || row.Data != "tr" {
				continue
			}
			var key, value string
			for cell := row.FirstChild; cell != nil; cell = cell.NextSibling {
				if cell.Type != html.ElementNode {
					continue
				}
				if cell.Data == "th" {
					key = cleanInfoboxText(getTextContent(cell))
				}
				if cell.Data == "td" {
					value = cleanInfoboxText(getTextContent(cell))
				}
			}
			if key != "" && value != "" {
				entries = append(entries, InfoboxEntry{Key: key, Value: value})
			}
		}
	}
	return entries
}

func extractPortableInfobox(aside *html.Node) []InfoboxEntry {
	var entries []InfoboxEntry
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			source := findAttr(n, "data-source")
			if source != "" {
				value := getPortableInfoboxValue(n)
				if value != "" {
					entries = append(entries, InfoboxEntry{Key: source, Value: value})
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(aside)
	return entries
}

func getPortableInfoboxValue(node *html.Node) string {
	var value string
	var findValue func(*html.Node)
	findValue = func(n *html.Node) {
		if n.Type == html.ElementNode && hasClass(n, "pi-data-value") {
			value = cleanInfoboxText(getTextContent(n))
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findValue(c)
		}
	}
	findValue(node)
	if value == "" {
		value = cleanInfoboxText(getTextContent(node))
	}
	return value
}

func cleanInfoboxText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\u00a0", " ")
	var result []rune
	for _, r := range s {
		if r == '\n' || r == '\r' || r == '\t' {
			result = append(result, ' ')
		} else {
			result = append(result, r)
		}
	}
	return strings.Join(strings.Fields(string(result)), " ")
}

// ExtractSections parses raw HTML into structured sections.
func ExtractSections(rawHTML string, include map[string]bool) []Section {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}

	var sections []Section
	var current *Section
	collecting := false

	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if shouldSkipSections(n, include) {
			return
		}
		if n.Type == html.ElementNode && (n.Data == "h2" || n.Data == "h3" || n.Data == "h4") {
			heading := cleanHeading(cleanText(getTextContent(n)))
			if heading == "" {
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					walk(c)
				}
				return
			}
			if current != nil {
				sections = append(sections, *current)
			}
			level := 2
			switch n.Data {
			case "h2":
				level = 2
			case "h3":
				level = 3
			case "h4":
				level = 4
			}
			current = &Section{Heading: heading, Level: level}
			collecting = true
			return
		}
		if n.Type == html.ElementNode && n.Data == "p" {
			if !collecting {
				current = &Section{Heading: "", Level: 1}
				collecting = true
			}
			if current != nil {
				text := cleanParagraph(getParagraphText(n))
				if text != "" {
					if current.Body != "" {
						current.Body += "\n\n"
					}
					current.Body += text
				}
			}
		}
		if n.Type == html.ElementNode && n.Data == "ul" && hasClass(n, "gallery") {
			if current != nil {
				text := cleanParagraph(getTextContent(n))
				if text != "" {
					if current.Body != "" {
						current.Body += "\n\n"
					}
					current.Body += text
				}
			}
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)

	if current != nil {
		sections = append(sections, *current)
	}

	skipTrivia := include != nil && !include["trivia"]
	skipQuotes := include != nil && !include["quotes"]

	var filtered []Section
	for _, s := range sections {
		if strings.EqualFold(s.Heading, "Navigation") {
			continue
		}
		if skipTrivia && strings.EqualFold(s.Heading, "Trivia") {
			continue
		}
		if skipQuotes && strings.EqualFold(s.Heading, "Quotes") {
			continue
		}
		filtered = append(filtered, s)
	}
	return filtered
}

func cleanText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\u00a0", " ")
	var result []rune
	for _, r := range s {
		if r == '\n' || r == '\r' || r == '\t' {
			result = append(result, ' ')
		} else {
			result = append(result, r)
		}
	}
	return strings.Join(strings.Fields(string(result)), " ")
}

func cleanHeading(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimSuffix(s, "[]")
	s = strings.TrimSuffix(s, " edit")
	return s
}

// Sanitize runs the full sanitization pipeline on raw wiki HTML.
func Sanitize(rawHTML string, include map[string]bool) (sections []Section, infobox []InfoboxEntry) {
	if include == nil || include["infobox"] {
		infobox = ExtractInfobox(rawHTML)
	}
	sections = ExtractSections(rawHTML, include)
	return sections, infobox
}

// WordCount counts words in a string.
func WordCount(s string) int {
	if s == "" {
		return 0
	}
	return len(strings.Fields(s))
}

// TotalWordCount counts total words across all sections.
func TotalWordCount(sections []Section, infobox []InfoboxEntry) int {
	count := 0
	for _, s := range sections {
		count += WordCount(s.Heading) + WordCount(s.Body)
	}
	for _, e := range infobox {
		count += WordCount(e.Key) + WordCount(e.Value)
	}
	return count
}

// SectionsFromRawHTML is a convenience wrapper that extracts sections with better section grouping.
// It groups consecutive paragraphs after headings into the same section.
func SectionsFromRawHTML(rawHTML string, include map[string]bool) ([]Section, []InfoboxEntry) {
	sections, infobox := Sanitize(rawHTML, include)

	var deduped []Section
	seen := map[string]bool{}
	for _, s := range sections {
		if s.Heading == "" && s.Body == "" {
			continue
		}
		key := fmt.Sprintf("%s|%d", s.Heading, s.Level)
		if seen[key] {
			continue
		}
		seen[key] = true
		deduped = append(deduped, s)
	}

	if len(deduped) > 0 && deduped[0].Heading == "" {
		deduped[0].Level = 1
	}

	return deduped, infobox
}
