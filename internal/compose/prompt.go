package compose

import (
	"fmt"
	"strings"

	"silly-sleeve/internal/crawler"
)

const systemPrompt = `You are an expert SillyTavern character card creator. Your task is to process wiki content and output a JSON object describing the character for use in a role-playing chat.

Follow these rules:
1. Extract or invent character details from the wiki content. If the content lacks a detail, extrapolate naturally.
2. Use third-person present tense. Do not use "{{char}}" or "{{user}}" placeholders.
3. Write in a compressed, sensory style — every word should convey information.
4. For quotes, generate natural, in-character dialogue snippets.
5. For stats, create reasonable RPG-style key/value pairs based on the source material.
6. Output ONLY a valid JSON object — no preamble, no markdown fences, no explanation.
7. Use straight quotes in all string values — never use curly quotes.

The JSON object must have exactly these fields:
- name (string): The character's name
- epithet (string): A title or short descriptor
- tags (string[]): 5-10 lowercase tags covering genre, role, personality
- appearance (string): Sensory physical description — build, dress, notable features
- personality (string): Comma-separated traits or short prose
- backstory (string): Compressed origin story
- abilities (string): Powers, skills, talents
- relationships (string): Key alliances and rivalries
- quotes (string[]): 2-3 in-character dialogue snippets
- stats ([][]string): Custom stat key/value pairs, e.g. [["STR","10"],["DEX","14"]]`

func buildUserPrompt(result crawler.CrawlResult) string {
	var b strings.Builder

	b.WriteString("Wiki page title: ")
	b.WriteString(result.Title)
	b.WriteString("\n\n")

	if len(result.Infobox) > 0 {
		b.WriteString("Infobox:\n")
		for _, entry := range result.Infobox {
			if entry.Key != "" {
				b.WriteString("- ")
				b.WriteString(entry.Key)
				b.WriteString(": ")
				b.WriteString(entry.Value)
				b.WriteString("\n")
			}
		}
		b.WriteString("\n")
	}

	b.WriteString("Content:\n")
	for _, section := range result.Sections {
		if section.Heading != "" {
			b.WriteString("\n## ")
			b.WriteString(section.Heading)
			b.WriteString("\n")
		}
		if section.Body != "" {
			b.WriteString(section.Body)
			b.WriteString("\n\n")
		}
	}

	b.WriteString("\nGenerate a SillyTavern character card JSON from this wiki content.")

	return b.String()
}

func buildFieldMaskString(lockedFields []string) string {
	if len(lockedFields) == 0 {
		return ""
	}
	return fmt.Sprintf("\n\nIMPORTANT: The following fields are LOCKED and must NOT be changed: %s. Preserve their existing values exactly.", strings.Join(lockedFields, ", "))
}
