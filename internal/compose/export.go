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

// sillyTavernCard builds the SillyTavern card map from a character.
func sillyTavernCard(ch Character) map[string]any {
	description := strings.Join(buildDescriptionSections(ch), "\n\n")
	firstMes, mesExample := buildMessages(ch)

	tags := ch.Tags
	if tags == nil {
		tags = []string{}
	}

	return map[string]any{
		"name":              ch.Name,
		"description":       description,
		"personality":       ch.Personality,
		"scenario":          "",
		"first_mes":         firstMes,
		"mes_example":       mesExample,
		"creatorcomment":    ch.Epithet,
		"tags":              tags,
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
