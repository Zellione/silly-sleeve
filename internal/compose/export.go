package compose

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ExportSillyTavernCard writes ch as a SillyTavern-compatible character card
// (v1 spec JSON) into folderPath and returns the written file path.
func ExportSillyTavernCard(ch Character, folderPath string) (string, error) {
	st := sillyTavernCard(ch)

	data, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return "", err
	}

	fname := slugify(ch.Name)
	if fname == "" {
		fname = "character"
	}
	outPath := filepath.Join(folderPath, fname+".json")
	if err := os.WriteFile(outPath, data, 0o644); err != nil {
		return "", fmt.Errorf("write character JSON: %w", err)
	}
	return outPath, nil
}

// CardFields holds the SillyTavern-derived fields for a character. It is the
// single source of truth shared by the v1 JSON export here and the v2/v3 PNG
// export engine in internal/export.
type CardFields struct {
	Name         string
	Description  string
	Personality  string
	Scenario     string
	FirstMes     string
	MesExample   string
	AltGreetings []string
	Epithet      string
	Tags         []string
}

// BuildCardFields derives the SillyTavern card fields from a character: the
// markdown description assembled from text sections, greeting/example messages
// from quotes, and a non-nil tags slice.
func BuildCardFields(ch Character) CardFields {
	firstMes, mesExample := buildMessages(ch)

	tags := ch.Tags
	if tags == nil {
		tags = []string{}
	}

	return CardFields{
		Name:         ch.Name,
		Description:  strings.Join(buildDescriptionSections(ch), "\n\n"),
		Personality:  ch.Personality,
		Scenario:     "",
		FirstMes:     firstMes,
		MesExample:   mesExample,
		AltGreetings: nonEmpty(ch.AltGreetings),
		Epithet:      ch.Epithet,
		Tags:         tags,
	}
}

// nonEmpty returns a new slice with blank entries removed, never nil.
func nonEmpty(s []string) []string {
	out := make([]string, 0, len(s))
	for _, v := range s {
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

// sillyTavernCard builds the SillyTavern v1 card map from a character.
func sillyTavernCard(ch Character) map[string]any {
	f := BuildCardFields(ch)
	return map[string]any{
		"name":              f.Name,
		"description":       f.Description,
		"personality":       f.Personality,
		"scenario":          f.Scenario,
		"first_mes":         f.FirstMes,
		"mes_example":       f.MesExample,
		"creatorcomment":    f.Epithet,
		"tags":              f.Tags,
		"creator":           "Silly Sleeve",
		"character_version": "1.0",
	}
}

// buildDescriptionSections assembles the markdown description from text fields.
func buildDescriptionSections(ch Character) []string {
	sections := []struct {
		heading string
		body    string
	}{
		{"Appearance", ch.Appearance},
		{"Personality", ch.Personality},
		{"Backstory", ch.Backstory},
		{"Abilities & Skills", ch.Abilities},
		{"Relationships", ch.Relationships},
	}

	var parts []string
	for _, s := range sections {
		if s.body != "" {
			parts = append(parts, "### "+s.heading+"\n"+s.body)
		}
	}

	if len(ch.Stats) > 0 {
		var sb strings.Builder
		sb.WriteString("### Stats\n")
		for _, s := range ch.Stats {
			if s.Key != "" || s.Value != "" {
				fmt.Fprintf(&sb, "- **%s**: %s\n", s.Key, s.Value)
			}
		}
		parts = append(parts, sb.String())
	}
	return parts
}

// buildMessages derives first_mes and mes_example from a character's quotes.
func buildMessages(ch Character) (firstMes, mesExample string) {
	if len(ch.Quotes) == 0 {
		return "", ""
	}
	firstMes = ch.Quotes[0]
	if len(ch.Quotes) > 1 {
		var sb strings.Builder
		for i, q := range ch.Quotes[1:] {
			if i > 0 {
				sb.WriteString("\n")
			}
			sb.WriteString("<START>\n{{user}}: ...\n{{char}}: " + q + "\n")
		}
		mesExample = sb.String()
	}
	return firstMes, mesExample
}

// Slugify converts a name into a lowercase, dash-separated filename slug. It is
// exported for reuse by the export engine so PNG and JSON files share naming.
func Slugify(s string) string {
	return slugify(s)
}

// slugify converts a name into a lowercase, dash-separated filename slug.
func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")

	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	result := strings.Trim(b.String(), "-")

	var sb strings.Builder
	prevDash := false
	for _, r := range result {
		if r == '-' {
			if prevDash {
				continue
			}
			prevDash = true
		} else {
			prevDash = false
		}
		sb.WriteRune(r)
	}
	return sb.String()
}
