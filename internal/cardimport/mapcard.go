package cardimport

import (
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
)

// headingFields maps the markdown headings cardexport emits to character field keys.
var headingFields = map[string]string{
	"appearance":         "appearance",
	"personality":        "personality",
	"backstory":          "backstory",
	"abilities & skills": "abilities",
	"relationships":      "relationships",
	"stats":              "stats",
}

// ToCharacter reverse-maps a parsed card into a character and its lorebook entries.
func ToCharacter(p *ParsedCard) (compose.Character, []lorebook.Entry) {
	ch := compose.NewCharacter(0)
	ch.Name = p.Name
	if ch.Name == "" {
		ch.Name = "Untitled"
	}
	ch.Epithet = p.CreatorNotes
	ch.Tags = nonNil(p.Tags)
	ch.Quotes = buildQuotes(p)
	ch.Portrait = p.Portrait

	sections := parseSections(p.Description)
	ch.Appearance = sections["appearance"]
	ch.Backstory = sections["backstory"]
	ch.Abilities = sections["abilities"]
	ch.Relationships = sections["relationships"]
	if s := sections["stats"]; s != "" {
		ch.Stats = parseStats(s)
	}
	ch.Personality = p.Personality
	if ch.Personality == "" {
		ch.Personality = sections["personality"]
	}
	if len(sections) == 0 && strings.TrimSpace(p.Description) != "" {
		ch.Backstory = strings.TrimSpace(p.Description)
	}

	var entries []lorebook.Entry
	if p.CharacterBook != nil {
		entries = convertEntries(p.CharacterBook.Entries)
	}
	return ch, entries
}

// parseSections splits a markdown description into a map keyed by field id.
// Content under unrecognized headings is dropped; an empty result signals the
// caller to apply the whole-description fallback.
func parseSections(desc string) map[string]string {
	out := map[string]string{}
	var curKey string
	var buf []string
	flush := func() {
		if curKey != "" {
			out[curKey] = strings.TrimSpace(strings.Join(buf, "\n"))
		}
		buf = nil
	}
	for _, ln := range strings.Split(desc, "\n") {
		if h, ok := strings.CutPrefix(ln, "### "); ok {
			flush()
			curKey = headingFields[strings.ToLower(strings.TrimSpace(h))]
			continue
		}
		if curKey != "" {
			buf = append(buf, ln)
		}
	}
	flush()
	return out
}

// parseStats reverses the "- **Key**: Value" stat rendering.
func parseStats(block string) []compose.StatKV {
	var stats []compose.StatKV
	for _, ln := range strings.Split(block, "\n") {
		ln = strings.TrimPrefix(strings.TrimSpace(ln), "- ")
		k, v, ok := strings.Cut(ln, ":")
		if !ok {
			continue
		}
		k = strings.TrimSpace(strings.Trim(k, "* "))
		v = strings.TrimSpace(v)
		if k == "" && v == "" {
			continue
		}
		stats = append(stats, compose.StatKV{Key: k, Value: v})
	}
	if len(stats) == 0 {
		return []compose.StatKV{{Key: "", Value: ""}}
	}
	return stats
}

// buildQuotes reconstructs the quotes slice from first_mes, mes_example, and
// alternate_greetings.
func buildQuotes(p *ParsedCard) []string {
	var quotes []string
	if p.FirstMes != "" {
		quotes = append(quotes, p.FirstMes)
	}
	for _, ln := range strings.Split(p.MesExample, "\n") {
		if rest, ok := strings.CutPrefix(strings.TrimSpace(ln), "{{char}}:"); ok {
			if q := strings.TrimSpace(rest); q != "" {
				quotes = append(quotes, q)
			}
		}
	}
	for _, g := range p.AlternateGreetings {
		if g != "" {
			quotes = append(quotes, g)
		}
	}
	if len(quotes) == 0 {
		return []string{""}
	}
	return quotes
}

// convertEntries maps character_book entries to lorebook entries. UIDs are
// provisional (0..n-1); App.ImportCard renumbers them on merge.
func convertEntries(src []BookEntry) []lorebook.Entry {
	out := make([]lorebook.Entry, 0, len(src))
	for i, e := range src {
		entry := lorebook.NewEntry(i)
		entry.Key = nonNil(e.Keys)
		entry.KeySecondary = nonNil(e.SecondaryKeys)
		entry.Content = e.Content
		entry.Comment = e.Comment
		if entry.Comment == "" {
			entry.Comment = e.Name
		}
		entry.Order = e.InsertionOrder
		entry.Position = positionInt(e.Position)
		entry.Selective = e.Selective
		entry.Constant = e.Constant
		entry.Disable = e.Enabled != nil && !*e.Enabled
		out = append(out, entry)
	}
	return out
}

func positionInt(pos string) int {
	if pos == "after_char" {
		return 1
	}
	return 0
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
