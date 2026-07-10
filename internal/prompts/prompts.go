package prompts

import "strings"

// TemplateSet holds prompt templates for bulk and per-field generation.
type TemplateSet struct {
	SystemPrompt string            `json:"systemPrompt"`
	FieldPrompts map[string]string `json:"fieldPrompts"`
}

// Clone returns a deep copy of the TemplateSet.
func (ts TemplateSet) Clone() TemplateSet {
	fields := make(map[string]string, len(ts.FieldPrompts))
	for k, v := range ts.FieldPrompts {
		fields[k] = v
	}
	return TemplateSet{
		SystemPrompt: ts.SystemPrompt,
		FieldPrompts: fields,
	}
}

// Substitute replaces {{key}} placeholders in the template with values from vars.
func Substitute(template string, vars map[string]string) string {
	result := template
	for k, v := range vars {
		result = strings.ReplaceAll(result, "{{"+k+"}}", v)
	}
	return result
}

// Defaults returns the built-in prompt templates.
func Defaults() TemplateSet {
	return TemplateSet{
		SystemPrompt: defaultSystemPrompt,
		FieldPrompts: defaultFieldPrompts(),
	}
}

const defaultSystemPrompt = `You are an expert SillyTavern character card creator. Your task is to process wiki content and output information describing the character for use in a role-playing chat.

Follow these rules:
1. Extract or invent character details from the wiki content. If the content lacks a detail, extrapolate naturally.
2. Use third-person present tense. Do not use "{{char}}" or "{{user}}" placeholders.
3. Write in a compressed, sensory style — every word should convey information.
4. Use straight quotes in all string values — never use curly quotes.`

func defaultFieldPrompts() map[string]string {
	m := map[string]string{}
	for _, id := range FieldIDs() {
		m[id] = defaultFieldPrompt(id)
	}
	return m
}

func defaultFieldPrompt(fieldID string) string {
	switch fieldID {
	case "name":
		return `Based on the wiki content below, extract the character's name. Return ONLY a JSON object with a single "name" field.

{{crawl_context}}`
	case "epithet":
		return `Based on the wiki content below, create a title or epithet for this character — a short, memorable descriptor. Return ONLY a JSON object with a single "epithet" field.

{{crawl_context}}`
	case "tags":
		return `Based on the wiki content below, generate 5-10 lowercase tags for this character covering genre, role, and personality. Return ONLY a JSON object with a single "tags" field containing an array of strings.

{{crawl_context}}`
	case "appearance":
		return `Based on the wiki content below, write a sensory physical description of this character — build, dress, notable features. Use third-person present tense. Return ONLY a JSON object with a single "appearance" field.

{{crawl_context}}`
	case "personality":
		return `Based on the wiki content below, describe this character's personality as comma-separated traits or short prose. Use third-person present tense. Return ONLY a JSON object with a single "personality" field.

{{crawl_context}}`
	case "backstory":
		return `Based on the wiki content below, write a compressed origin story for this character. Use third-person present tense. Return ONLY a JSON object with a single "backstory" field.

{{crawl_context}}`
	case "abilities":
		return `Based on the wiki content below, describe this character's powers, skills, and talents. Use third-person present tense. Return ONLY a JSON object with a single "abilities" field.

{{crawl_context}}`
	case "relationships":
		return `Based on the wiki content below, describe this character's key allies and rivalries. Use third-person present tense. Return ONLY a JSON object with a single "relationships" field.

{{crawl_context}}`
	case "quotes":
		return `Based on the wiki content below, generate 2-3 in-character dialogue snippets for this character. Return ONLY a JSON object with a single "quotes" field containing an array of strings.

{{crawl_context}}`
	case "altGreetings":
		return `Based on the wiki content below, generate 1-3 alternate opening greetings this character could use to start a conversation — variations in tone or scene, distinct from each other. Use third-person present tense. Return ONLY a JSON object with a single "altGreetings" field containing an array of strings.

{{crawl_context}}`
	case "stats":
		return `Based on the wiki content below, generate RPG-style stat key/value pairs for this character. Return ONLY a JSON object with a single "stats" field containing an array of [key, value] pairs, e.g. [["STR","10"],["DEX","14"]].

{{crawl_context}}`
	default:
		return ""
	}
}

// FieldIDs returns all field IDs in display order.
func FieldIDs() []string {
	return []string{
		"name",
		"epithet",
		"tags",
		"appearance",
		"personality",
		"backstory",
		"abilities",
		"relationships",
		"quotes",
		"altGreetings",
		"stats",
	}
}

// VariableNames returns the list of supported template variable names.
func VariableNames() []string {
	return []string{
		"crawl_context",
		"crawl.title",
		"crawl.url",
		"character.name",
		"character.epithet",
		"custom",
	}
}

// FieldLabel returns the display label for a field ID.
func FieldLabel(id string) string {
	if l, ok := defaultFieldLabels[id]; ok {
		return l
	}
	return id
}

var defaultFieldLabels = map[string]string{
	"name":          "Name",
	"epithet":       "Title / epithet",
	"tags":          "Tags",
	"appearance":    "Appearance",
	"personality":   "Personality",
	"backstory":     "Backstory",
	"abilities":     "Abilities & skills",
	"relationships": "Relationships",
	"quotes":        "Example quotes",
	"altGreetings":  "Alternate greetings",
	"stats":         "Stat block",
}

// BuildVars constructs the standard substitution variables map for a crawl result.
func BuildVars(title, url, crawlContent string) map[string]string {
	return map[string]string{
		"crawl.title":   title,
		"crawl.url":     url,
		"crawl_context": crawlContent,
		"custom":        "",
	}
}
