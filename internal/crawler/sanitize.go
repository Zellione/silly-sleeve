package crawler

import (
	"fmt"
	"strings"

	"golang.org/x/net/html"
)

const (
	nbSpace      = "\u00a0"
	infoboxClass = "portable-infobox"
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
	infoboxClass:             true,
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
	if node.Data == "aside" && hasClass(node, infoboxClass) {
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

// walkNodes does a depth-first pre-order traversal starting at n, calling fn on
// each node. When fn returns false the node's children are skipped (siblings are
// still visited by the caller's loop). It replaces the hand-rolled recursive
// `walk` closures throughout this file.
func walkNodes(n *html.Node, fn func(*html.Node) bool) {
	if !fn(n) {
		return
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		walkNodes(c, fn)
	}
}

func getTextContent(node *html.Node) string {
	var buf strings.Builder
	for c := node.FirstChild; c != nil; c = c.NextSibling {
		walkNodes(c, func(n *html.Node) bool {
			if shouldSkip(n) {
				return false
			}
			if n.Type == html.TextNode {
				buf.WriteString(n.Data)
			}
			return true
		})
	}
	return strings.TrimSpace(buf.String())
}

func getInlineText(node *html.Node) string {
	var buf strings.Builder
	for c := node.FirstChild; c != nil; c = c.NextSibling {
		walkNodes(c, func(n *html.Node) bool {
			if shouldSkip(n) {
				return false
			}
			if n.Type == html.ElementNode && n.Data == "br" {
				buf.WriteString("\n")
				return false
			}
			if n.Type == html.TextNode {
				buf.WriteString(n.Data)
			}
			return true
		})
	}
	return strings.TrimSpace(buf.String())
}

// collapseInlineSpaces collapses runs of ASCII spaces to a single space and
// drops spaces sitting directly before or after a newline, preserving newlines
// and every other rune. It is a single-pass replacement for the repeated
// O(n²) strings.Contains/ReplaceAll space-collapse loops. A single leading or
// trailing space is preserved (callers TrimSpace as needed), matching the old
// loop behavior.
func collapseInlineSpaces(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	pendingSpace := false
	atLineStart := false
	for _, r := range s {
		switch r {
		case ' ':
			pendingSpace = true
		case '\n':
			pendingSpace = false
			b.WriteByte('\n')
			atLineStart = true
		default:
			if pendingSpace && !atLineStart {
				b.WriteByte(' ')
			}
			pendingSpace = false
			atLineStart = false
			b.WriteRune(r)
		}
	}
	if pendingSpace && !atLineStart {
		b.WriteByte(' ')
	}
	return b.String()
}

// limitConsecutiveNewlines collapses runs of more than max consecutive newlines
// down to exactly max, in a single pass.
func limitConsecutiveNewlines(s string, max int) string {
	var b strings.Builder
	b.Grow(len(s))
	run := 0
	for _, r := range s {
		if r == '\n' {
			run++
			if run <= max {
				b.WriteByte('\n')
			}
			continue
		}
		run = 0
		b.WriteRune(r)
	}
	return b.String()
}

func getParagraphText(node *html.Node) string {
	var buf strings.Builder
	for c := node.FirstChild; c != nil; c = c.NextSibling {
		walkNodes(c, func(n *html.Node) bool {
			if shouldSkip(n) {
				return false
			}
			if n.Type == html.ElementNode && n.Data == "br" {
				buf.WriteString("\n")
				return false
			}
			if n.Type == html.TextNode {
				text := strings.ReplaceAll(n.Data, nbSpace, " ")
				text = strings.ReplaceAll(text, "\t", " ")
				text = strings.ReplaceAll(text, "\r", " ")
				text = strings.ReplaceAll(text, "\n", " ")
				buf.WriteString(text)
			}
			return true
		})
	}
	result := collapseInlineSpaces(buf.String())
	result = limitConsecutiveNewlines(result, 2)
	return strings.TrimSpace(result)
}

func cleanParagraph(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, nbSpace, " ")
	var out []rune
	inSpace := false
	for _, r := range s {
		switch {
		case r == '\t' || r == '\r' || r == ' ':
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

func joinTextParts(parts []string) string {
	var buf strings.Builder
	needSpace := false
	needNewline := false
	for _, part := range parts {
		if part == "\n" {
			needNewline = true
			needSpace = false
			continue
		}
		if needNewline {
			buf.WriteString("\n")
			needNewline = false
		}
		if needSpace {
			buf.WriteString(" ")
		}
		buf.WriteString(part)
		needSpace = true
	}
	result := collapseInlineSpaces(buf.String())
	return strings.TrimSpace(result)
}

func getListContent(node *html.Node) string {
	var lines []string
	walkListNodes(node, 0, &lines)
	return strings.Join(lines, "\n\n")
}

// walkListNodes recursively walks list nodes (ul, ol) and extracts list item text.
func walkListNodes(n *html.Node, depth int, lines *[]string) {
	for li := n.FirstChild; li != nil; li = li.NextSibling {
		if li.Type != html.ElementNode || li.Data != "li" {
			continue
		}
		processListItem(li, depth, lines)
	}
}

// processListItem extracts text from a list item and handles nested lists.
func processListItem(li *html.Node, depth int, lines *[]string) {
	indent := strings.Repeat("  ", depth)
	var textParts []string

	for c := li.FirstChild; c != nil; c = c.NextSibling {
		processListItemChild(c, depth, &textParts, lines, indent)
	}

	if len(textParts) > 0 {
		text := joinTextParts(textParts)
		*lines = append(*lines, indent+"- "+text)
	}
}

// processListItemChild processes a single child node of a list item.
func processListItemChild(c *html.Node, depth int, textParts *[]string, lines *[]string, indent string) {
	if c.Type == html.TextNode {
		if t := strings.TrimSpace(c.Data); t != "" {
			*textParts = append(*textParts, t)
		}
		return
	}

	if c.Type != html.ElementNode {
		return
	}

	// Handle nested lists.
	if c.Data == "ul" || c.Data == "ol" {
		if len(*textParts) > 0 {
			text := joinTextParts(*textParts)
			*lines = append(*lines, indent+"- "+text)
			*textParts = nil
		}
		walkListNodes(c, depth+1, lines)
		return
	}

	// Handle line breaks.
	if c.Data == "br" {
		*textParts = append(*textParts, "\n")
		return
	}

	// Handle other elements (links, spans, etc.).
	if !shouldSkip(c) {
		inner := strings.TrimSpace(getTextContent(c))
		if inner != "" {
			*textParts = append(*textParts, inner)
		}
	}
}

// ExtractInfobox parses infobox key/value pairs from raw HTML.
func ExtractInfobox(rawHTML string) []InfoboxEntry {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}

	var entries []InfoboxEntry
	walkNodes(doc, func(n *html.Node) bool {
		if n.Type == html.ElementNode {
			if n.Data == "table" && hasClass(n, "infobox") {
				entries = extractTableInfobox(n)
				return false
			}
			if n.Data == "aside" && hasClass(n, infoboxClass) {
				entries = extractPortableInfobox(n)
				return false
			}
		}
		return true
	})
	return entries
}

func extractTableInfobox(table *html.Node) []InfoboxEntry {
	var entries []InfoboxEntry
	walkTableBodies(table, &entries)
	return entries
}

// walkTableBodies walks through tbody elements in a table and extracts rows.
func walkTableBodies(table *html.Node, entries *[]InfoboxEntry) {
	for tbody := table.FirstChild; tbody != nil; tbody = tbody.NextSibling {
		if tbody.Type != html.ElementNode || tbody.Data != "tbody" {
			continue
		}
		walkTableRows(tbody, entries)
	}
}

// walkTableRows walks through rows in a tbody and extracts infobox entries.
func walkTableRows(tbody *html.Node, entries *[]InfoboxEntry) {
	for row := tbody.FirstChild; row != nil; row = row.NextSibling {
		if row.Type != html.ElementNode || row.Data != "tr" {
			continue
		}
		extractRowEntry(row, entries)
	}
}

// extractRowEntry extracts key-value pair from a table row.
func extractRowEntry(row *html.Node, entries *[]InfoboxEntry) {
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
		*entries = append(*entries, InfoboxEntry{Key: key, Value: value})
	}
}

func extractPortableInfobox(aside *html.Node) []InfoboxEntry {
	var entries []InfoboxEntry
	var currentSection string
	walkNodes(aside, func(n *html.Node) bool {
		if n.Type == html.ElementNode {
			if n.Data == "h2" && hasClass(n, "pi-header") {
				currentSection = cleanText(getTextContent(n))
			}
			source := findAttr(n, "data-source")
			if source != "" {
				value := getPortableInfoboxValue(n)
				if value != "" {
					entries = append(entries, InfoboxEntry{
						Key:     source,
						Value:   value,
						Section: currentSection,
					})
				}
			}
		}
		return true
	})
	return entries
}

func getPortableInfoboxValue(node *html.Node) string {
	var value string
	walkNodes(node, func(n *html.Node) bool {
		if n.Type == html.ElementNode && hasClass(n, "pi-data-value") {
			value = cleanInfoboxText(getInlineText(n))
			return false
		}
		return true
	})
	if value == "" {
		value = cleanInfoboxText(getInlineText(node))
	}
	return value
}

func cleanInfoboxText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, nbSpace, " ")
	var result []rune
	prevWasNewline := false
	for _, r := range s {
		if r == '\r' || r == '\t' {
			result = append(result, ' ')
		} else if r == '\n' {
			if !prevWasNewline {
				result = append(result, '\n')
				prevWasNewline = true
			}
		} else {
			result = append(result, r)
			prevWasNewline = false
		}
	}
	return collapseInlineSpaces(string(result))
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

	walkNodes(doc, func(n *html.Node) bool {
		if shouldSkipSections(n, include) {
			return false
		}

		// Check if this is a heading node.
		if isHeadingNode(n) {
			return processHeadingNode(n, &sections, &current, &collecting)
		}

		// Check if this is a gallery element.
		if isGalleryNode(n) {
			appendGalleryContent(n, current)
			return false
		}

		// Check if this is content (paragraph or list).
		if isContentNode(n) {
			if !collecting {
				current = &Section{Heading: "", Level: 1}
				collecting = true
			}
			appendContentToSection(n, current)
		}

		return true
	})

	if current != nil {
		sections = append(sections, *current)
	}

	return filterSections(sections, include)
}

// isHeadingNode returns true if the node is a heading element (h2, h3, h4).
func isHeadingNode(n *html.Node) bool {
	return n.Type == html.ElementNode && (n.Data == "h2" || n.Data == "h3" || n.Data == "h4")
}

// getHeadingLevel extracts the numeric level from a heading element.
func getHeadingLevel(tag string) int {
	switch tag {
	case "h2":
		return 2
	case "h3":
		return 3
	case "h4":
		return 4
	}
	return 2
}

// processHeadingNode processes a heading element and updates the current section.
// It returns false to skip the heading's children (which are usually formatting/edit links).
func processHeadingNode(n *html.Node, sections *[]Section, current **Section, collecting *bool) bool {
	heading := cleanHeading(cleanText(getTextContent(n)))
	if heading == "" {
		return true
	}

	if *current != nil {
		*sections = append(*sections, **current)
	}

	level := getHeadingLevel(n.Data)
	*current = &Section{Heading: heading, Level: level}
	*collecting = true
	return false
}

// isGalleryNode returns true if the node is a gallery list.
func isGalleryNode(n *html.Node) bool {
	return n.Type == html.ElementNode && n.Data == "ul" && hasClass(n, "gallery")
}

// appendGalleryContent appends gallery text to the current section.
func appendGalleryContent(n *html.Node, current *Section) {
	if current == nil {
		return
	}

	text := cleanParagraph(getTextContent(n))
	if text == "" {
		return
	}

	if current.Body != "" {
		current.Body += "\n\n"
	}
	current.Body += text
}

// isContentNode returns true if the node is a content element (p, ul, or ol).
func isContentNode(n *html.Node) bool {
	return n.Type == html.ElementNode && (n.Data == "p" || n.Data == "ul" || n.Data == "ol")
}

// appendContentToSection appends content from a paragraph or list to the current section.
func appendContentToSection(n *html.Node, current *Section) {
	if current == nil {
		return
	}

	var text string
	if n.Data == "ul" || n.Data == "ol" {
		text = getListContent(n)
	} else {
		text = cleanParagraph(getParagraphText(n))
	}

	if text == "" {
		return
	}

	if current.Body != "" {
		current.Body += "\n\n"
	}
	current.Body += text
}

// filterSections removes unwanted sections (Navigation, Trivia, Quotes) based on user preferences.
func filterSections(sections []Section, include map[string]bool) []Section {
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
	s = strings.ReplaceAll(s, nbSpace, " ")
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
