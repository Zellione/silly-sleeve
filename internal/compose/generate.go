package compose

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/jsonrepair"
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
	AltGreetings  []string   `json:"altGreetings"`
	Stats         [][]string `json:"stats"`
}

// GenerateBulk sends a bulk prompt to the LLM and returns a Character
// populated from the JSON response. lockedFields are field IDs that should
// retain their existing values from the provided character. It uses the
// production HTTP completer; see GenerateBulkWith to inject a Completer.
func GenerateBulk(ctx context.Context, result crawler.CrawlResult, ep llm.LLMEndpoint, lockedFields []string, existing Character) (Character, error) {
	return GenerateBulkWith(ctx, llm.DefaultCompleter, result, ep, lockedFields, existing)
}

// GenerateBulkWith is GenerateBulk with an injectable Completer.
func GenerateBulkWith(ctx context.Context, completer llm.Completer, result crawler.CrawlResult, ep llm.LLMEndpoint, lockedFields []string, existing Character) (Character, error) {
	userPrompt := buildUserPrompt(result)

	if len(lockedFields) > 0 {
		userPrompt += buildFieldMaskString(lockedFields)
	}

	gr, _, err := llm.CompleteJSON(ctx, completer, ep, systemPrompt, userPrompt, parseBulkResponse)
	if err != nil {
		return Character{}, err
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
		case "altGreetings":
			gr.AltGreetings = existing.AltGreetings
		case "stats":
			gr.Stats = nil
		}
	}

	applyResponse(&ch, gr)
	ch.Dirty = true

	return ch, nil
}

func applyResponse(ch *Character, gr generateResponse) {
	// Apply simple scalar fields (name, epithet always; appearance, etc. only if non-empty)
	applyResponseStringFields(ch, gr)

	// Apply slice fields
	if len(gr.Tags) > 0 {
		ch.Tags = gr.Tags
	}
	if len(gr.Quotes) > 0 {
		ch.Quotes = gr.Quotes
	}
	if len(gr.AltGreetings) > 0 {
		ch.AltGreetings = gr.AltGreetings
	}

	// Apply stats field
	if len(gr.Stats) > 0 {
		applyResponseStats(ch, gr.Stats)
	}
}

// applyResponseStringFields applies string fields from generateResponse to Character.
func applyResponseStringFields(ch *Character, gr generateResponse) {
	// Fields with no validation (name, epithet always apply)
	ch.Name = gr.Name
	ch.Epithet = gr.Epithet

	// Text fields (only apply if non-empty)
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
}

// applyResponseStats converts and applies stats from response format to Character format.
func applyResponseStats(ch *Character, stats [][]string) {
	ch.Stats = make([]StatKV, len(stats))
	for i, pair := range stats {
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

// parseBulkResponse decodes the bulk-generation reply, tolerating fences and
// surrounding prose.
func parseBulkResponse(content string) (generateResponse, error) {
	cleaned := jsonrepair.Clean(content)
	var gr generateResponse
	if err := json.Unmarshal([]byte(cleaned), &gr); err != nil {
		return generateResponse{}, fmt.Errorf("parse response: %w (raw: %s)", err, truncate(cleaned, 200))
	}
	return gr, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// FieldRequest bundles the inputs for per-field generation.
type FieldRequest struct {
	FieldID      string
	Result       crawler.CrawlResult
	CustomPrompt string
	Existing     Character
	Templates    prompts.TemplateSet
}

// GenerateField sends a per-field prompt to the LLM and returns the
// character with that field updated. customPrompt is appended to the
// field-specific instruction. templates provides the system prompt.
func GenerateField(
	ctx context.Context,
	fieldID string,
	result crawler.CrawlResult,
	ep llm.LLMEndpoint,
	customPrompt string,
	existing Character,
	templates prompts.TemplateSet,
) (Character, error) {
	return GenerateFieldWith(ctx, llm.DefaultCompleter, ep, FieldRequest{
		FieldID:      fieldID,
		Result:       result,
		CustomPrompt: customPrompt,
		Existing:     existing,
		Templates:    templates,
	})
}

// GenerateFieldWith is GenerateField with an injectable Completer.
func GenerateFieldWith(ctx context.Context, completer llm.Completer, ep llm.LLMEndpoint, req FieldRequest) (Character, error) {
	fieldTemplate := req.Templates.FieldPrompts[req.FieldID]
	if fieldTemplate == "" {
		return req.Existing, fmt.Errorf("no template for field %s", req.FieldID)
	}

	vars := prompts.BuildVars(req.Result.Title, req.Result.URL, CrawlContext(req.Result))
	userPrompt := prompts.Substitute(fieldTemplate, vars)

	if req.CustomPrompt != "" {
		userPrompt += "\n\nAdditional instructions: " + req.CustomPrompt
	}

	sysPrompt := req.Templates.SystemPrompt
	if sysPrompt == "" {
		sysPrompt = systemPrompt
	}

	val, _, err := llm.CompleteJSON(ctx, completer, ep, sysPrompt, userPrompt, func(content string) (any, error) {
		return resolveFieldValue(req.FieldID, jsonrepair.Clean(content))
	})
	if err != nil {
		return req.Existing, err
	}

	ch := req.Existing
	applyField(&ch, req.FieldID, val)
	ch.Dirty = true

	return ch, nil
}

// resolveFieldValue parses the LLM response for a single field and extracts
// the field value. It handles JSON objects, raw text fallback, case-insensitive
// key lookups, and delegates text-field scenarios to resolveTextFieldValue.
func resolveFieldValue(fieldID, content string) (any, error) {
	var raw map[string]any
	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		if isTextField(fieldID) {
			return stripJSONQuotes(content), nil
		}
		return nil, fmt.Errorf("parse field response: %w (raw: %s)", err, truncate(content, 200))
	}

	val := raw[fieldID]
	if val == nil {
		val = findCaseInsensitive(raw, fieldID)
	}

	if isTextField(fieldID) {
		return resolveTextFieldValue(content, val)
	}

	if val == nil {
		return nil, nil
	}
	return val, nil
}

// resolveTextFieldValue handles text-field-specific resolution: empty-value
// fallback, array-to-string conversion, and nil checks.
func resolveTextFieldValue(content string, val any) (any, error) {
	if val == nil || isEmptyString(val) || isEmptyArray(val) {
		if content != "" {
			return content, nil
		}
		return nil, nil
	}
	if arr, ok := val.([]any); ok {
		b, err := json.Marshal(arr)
		if err == nil {
			return string(b), nil
		}
	}
	return val, nil
}

// stripJSONQuotes removes surrounding double-quotes if content is a valid
// JSON string literal (e.g. `"hello"` → `hello`).
func stripJSONQuotes(s string) string {
	if len(s) < 2 || s[0] != '"' {
		return s
	}
	var str string
	if err := json.Unmarshal([]byte(s), &str); err != nil {
		return s
	}
	return str
}

// CrawlContext renders a crawl result as the flat page text used in prompts:
// title, infobox rows, then each section under its heading. Exported because
// lorebook extraction builds its prompts from the same rendering, and a second
// copy would drift.
func CrawlContext(result crawler.CrawlResult) string {
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

// isEmptyArray returns true if the value is a JSON array with no elements.
func isEmptyArray(v any) bool {
	arr, ok := v.([]any)
	return ok && len(arr) == 0
}

// findCaseInsensitive looks for a key in the map ignoring case differences.
// Some LLMs return capitalized keys like "Relationships" instead of "relationships".
func findCaseInsensitive(raw map[string]any, key string) any {
	lower := strings.ToLower(key)
	for k, v := range raw {
		if strings.ToLower(k) == lower {
			return v
		}
	}
	return nil
}

// applyField sets a single field on the character from the LLM response value.
func applyField(ch *Character, fieldID string, value any) {
	if value == nil {
		return
	}

	switch fieldID {
	case "tags", "quotes", "altGreetings":
		applyStringSliceField(ch, fieldID, value)
	case "stats":
		applyStatsField(ch, value)
	default:
		applyStringField(ch, fieldID, value)
	}
}

func applyStringField(ch *Character, fieldID string, value any) {
	s, ok := value.(string)
	if !ok || s == "" && fieldID != "epithet" {
		return
	}
	switch fieldID {
	case "name":
		ch.Name = s
	case "epithet":
		ch.Epithet = s
	case "appearance":
		ch.Appearance = s
	case "personality":
		ch.Personality = s
	case "backstory":
		ch.Backstory = s
	case "abilities":
		ch.Abilities = s
	case "relationships":
		ch.Relationships = s
	}
}

func applyStringSliceField(ch *Character, fieldID string, value any) {
	arr, ok := value.([]any)
	if !ok || len(arr) == 0 {
		return
	}
	slice := make([]string, 0, len(arr))
	for _, v := range arr {
		if s, ok := v.(string); ok {
			slice = append(slice, s)
		}
	}
	switch fieldID {
	case "tags":
		ch.Tags = slice
	case "quotes":
		ch.Quotes = slice
	case "altGreetings":
		ch.AltGreetings = slice
	}
}

func applyStatsField(ch *Character, value any) {
	arr, ok := value.([]any)
	if !ok || len(arr) == 0 {
		return
	}
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
