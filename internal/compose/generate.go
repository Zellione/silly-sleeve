package compose

import (
	"encoding/json"
	"fmt"
	"strings"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/prompts"
)

type generateResponse struct {
	Name          string     `json:"name"`
	Epithet       string     `json:"epithet"`
	Tags          []string   `json:"tags"`
	Appearance    string     `json:"appearance"`
	Personality   string     `json:"personality"`
	Backstory     string     `json:"backstory"`
	Abilities     string     `json:"abilities"`
	Relationships string     `json:"relationships"`
	Quotes        []string   `json:"quotes"`
	Stats         [][]string `json:"stats"`
}

// GenerateBulk sends a bulk prompt to the LLM and returns a Character
// populated from the JSON response. lockedFields are field IDs that should
// retain their existing values from the provided character.
func GenerateBulk(result crawler.CrawlResult, ep llm.LLMEndpoint, lockedFields []string, existing Character) (Character, error) {
	userPrompt := buildUserPrompt(result)

	if len(lockedFields) > 0 {
		userPrompt += buildFieldMaskString(lockedFields)
	}

	content, err := llm.Complete(ep, systemPrompt, userPrompt)
	if err != nil {
		return Character{}, fmt.Errorf("llm complete: %w", err)
	}

	content = cleanResponse(content)

	var gr generateResponse
	if err := json.Unmarshal([]byte(content), &gr); err != nil {
		return Character{}, fmt.Errorf("parse response: %w (raw: %s)", err, truncate(content, 200))
	}

	ch := existing
	for _, id := range lockedFields {
		switch id {
		case "name":
			gr.Name = existing.Name
		case "epithet":
			gr.Epithet = existing.Epithet
		case "tags":
			gr.Tags = existing.Tags
		case "appearance":
			gr.Appearance = existing.Appearance
		case "personality":
			gr.Personality = existing.Personality
		case "backstory":
			gr.Backstory = existing.Backstory
		case "abilities":
			gr.Abilities = existing.Abilities
		case "relationships":
			gr.Relationships = existing.Relationships
		case "quotes":
			gr.Quotes = existing.Quotes
		case "stats":
			gr.Stats = nil
		}
	}

	applyResponse(&ch, gr)
	ch.Dirty = true

	return ch, nil
}

func applyResponse(ch *Character, gr generateResponse) {
	if gr.Name != "" {
		ch.Name = gr.Name
	}
	if gr.Epithet != "" {
		ch.Epithet = gr.Epithet
	}
	if len(gr.Tags) > 0 {
		ch.Tags = gr.Tags
	}
	if gr.Appearance != "" {
		ch.Appearance = gr.Appearance
	}
	if gr.Personality != "" {
		ch.Personality = gr.Personality
	}
	if gr.Backstory != "" {
		ch.Backstory = gr.Backstory
	}
	if gr.Abilities != "" {
		ch.Abilities = gr.Abilities
	}
	if gr.Relationships != "" {
		ch.Relationships = gr.Relationships
	}
	if len(gr.Quotes) > 0 {
		ch.Quotes = gr.Quotes
	}
	if len(gr.Stats) > 0 {
		ch.Stats = make([]StatKV, len(gr.Stats))
		for i, pair := range gr.Stats {
			k, v := "", ""
			if len(pair) > 0 {
				k = pair[0]
			}
			if len(pair) > 1 {
				v = pair[1]
			}
			ch.Stats[i] = StatKV{Key: k, Value: v}
		}
	}
}

func cleanResponse(content string) string {
	content = strings.TrimSpace(content)

	if strings.HasPrefix(content, "```json") {
		content = strings.TrimPrefix(content, "```json")
		if idx := strings.LastIndex(content, "```"); idx >= 0 {
			content = content[:idx]
		}
	} else if strings.HasPrefix(content, "```") {
		content = strings.TrimPrefix(content, "```")
		if idx := strings.LastIndex(content, "```"); idx >= 0 {
			content = content[:idx]
		}
	}

	return strings.TrimSpace(content)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// GenerateField sends a per-field prompt to the LLM and returns the
// character with that field updated. customPrompt is appended to the
// field-specific instruction. templates provides the system prompt.
func GenerateField(
	fieldID string,
	result crawler.CrawlResult,
	ep llm.LLMEndpoint,
	customPrompt string,
	existing Character,
	templates prompts.TemplateSet,
) (Character, error) {
	fieldTemplate := templates.FieldPrompts[fieldID]
	if fieldTemplate == "" {
		return existing, fmt.Errorf("no template for field %s", fieldID)
	}

	vars := prompts.BuildVars(result.Title, result.URL, buildCrawlContent(result))
	userPrompt := prompts.Substitute(fieldTemplate, vars)

	if customPrompt != "" {
		userPrompt += "\n\nAdditional instructions: " + customPrompt
	}

	sysPrompt := templates.SystemPrompt
	if sysPrompt == "" {
		sysPrompt = systemPrompt
	}

	content, err := llm.Complete(ep, sysPrompt, userPrompt)
	if err != nil {
		return existing, fmt.Errorf("llm complete: %w", err)
	}

	content = cleanResponse(content)

	var raw map[string]any
	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		// Fallback: if the LLM returned plain text instead of a JSON object,
		// use the raw text as the field value for text-type fields.
		if isTextField(fieldID) && content != "" {
			ch := existing
			applyField(&ch, fieldID, content)
			ch.Dirty = true
			return ch, nil
		}
		return existing, fmt.Errorf("parse field response: %w (raw: %s)", err, truncate(content, 200))
	}

	ch := existing
	val := raw[fieldID]
	// If the field value is nil or empty string, try reading the raw content directly
	// as a fallback (some models return the content without proper JSON wrapping).
	if val == nil || (isTextField(fieldID) && isEmptyString(val)) {
		if isTextField(fieldID) && content != "" {
			applyField(&ch, fieldID, content)
			ch.Dirty = true
			return ch, nil
		}
	}
	applyField(&ch, fieldID, val)
	ch.Dirty = true

	return ch, nil
}

// buildCrawlContent renders the crawl result as a flat string for template substitution.
func buildCrawlContent(result crawler.CrawlResult) string {
	var sb strings.Builder
	sb.WriteString("Wiki page title: ")
	sb.WriteString(result.Title)
	sb.WriteString("\n\n")

	if len(result.Infobox) > 0 {
		sb.WriteString("Infobox:\n")
		for _, entry := range result.Infobox {
			if entry.Key != "" {
				sb.WriteString("- ")
				sb.WriteString(entry.Key)
				sb.WriteString(": ")
				sb.WriteString(entry.Value)
				sb.WriteString("\n")
			}
		}
		sb.WriteString("\n")
	}

	sb.WriteString("Content:\n")
	for _, section := range result.Sections {
		if section.Heading != "" {
			sb.WriteString("\n## ")
			sb.WriteString(section.Heading)
			sb.WriteString("\n")
		}
		if section.Body != "" {
			sb.WriteString(section.Body)
			sb.WriteString("\n\n")
		}
	}

	return sb.String()
}

// isTextField returns true for fields that are freeform text (not arrays or scalars).
func isTextField(fieldID string) bool {
	return fieldID == "appearance" || fieldID == "personality" ||
		fieldID == "backstory" || fieldID == "abilities" || fieldID == "relationships"
}

// isEmptyString returns true if the value is a JSON string that is empty.
func isEmptyString(v any) bool {
	s, ok := v.(string)
	return ok && s == ""
}

// applyField sets a single field on the character from the LLM response value.
func applyField(ch *Character, fieldID string, value any) {
	if value == nil {
		return
	}

	switch fieldID {
	case "name":
		if s, ok := value.(string); ok && s != "" {
			ch.Name = s
		}
	case "epithet":
		if s, ok := value.(string); ok {
			ch.Epithet = s
		}
	case "tags":
		if arr, ok := value.([]any); ok && len(arr) > 0 {
			tags := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					tags = append(tags, s)
				}
			}
			ch.Tags = tags
		}
	case "appearance":
		if s, ok := value.(string); ok && s != "" {
			ch.Appearance = s
		}
	case "personality":
		if s, ok := value.(string); ok && s != "" {
			ch.Personality = s
		}
	case "backstory":
		if s, ok := value.(string); ok && s != "" {
			ch.Backstory = s
		}
	case "abilities":
		if s, ok := value.(string); ok && s != "" {
			ch.Abilities = s
		}
	case "relationships":
		if s, ok := value.(string); ok && s != "" {
			ch.Relationships = s
		}
	case "quotes":
		if arr, ok := value.([]any); ok && len(arr) > 0 {
			quotes := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					quotes = append(quotes, s)
				}
			}
			ch.Quotes = quotes
		}
	case "stats":
		if arr, ok := value.([]any); ok && len(arr) > 0 {
			stats := make([]StatKV, 0, len(arr))
			for _, v := range arr {
				pair, ok := v.([]any)
				if !ok || len(pair) < 2 {
					continue
				}
				k, _ := pair[0].(string)
				val, _ := pair[1].(string)
				stats = append(stats, StatKV{Key: k, Value: val})
			}
			ch.Stats = stats
		}
	}
}
