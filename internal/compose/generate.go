package compose

import (
	"encoding/json"
	"fmt"
	"strings"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
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
