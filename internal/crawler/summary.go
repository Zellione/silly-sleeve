package crawler

import "strings"

// ParseSummaryText converts hand-edited summary text back into sections.
// Lines starting with "## " begin a new level-2 section; any content before
// the first heading becomes the level-1 lede (empty heading). Blank lines
// inside a section are kept, so paragraph breaks survive the round trip.
func ParseSummaryText(text string) []Section {
	var sections []Section
	cur := Section{Level: 1}
	var body []string
	flush := func() {
		b := strings.TrimSpace(strings.Join(body, "\n"))
		if b != "" || cur.Heading != "" {
			cur.Body = b
			sections = append(sections, cur)
		}
		body = nil
	}
	for line := range strings.SplitSeq(text, "\n") {
		if strings.HasPrefix(line, "## ") {
			flush()
			cur = Section{Heading: strings.TrimSpace(line[3:]), Level: 2}
			continue
		}
		body = append(body, line)
	}
	flush()
	return sections
}
