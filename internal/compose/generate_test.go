package compose

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/prompts"
)

func TestBuildUserPrompt_IncludesTitle(t *testing.T) {
	result := crawler.CrawlResult{
		Title: "Elara_Wynd",
	}
	prompt := buildUserPrompt(result)
	assert.Contains(t, prompt, "Elara_Wynd")
}

func TestBuildUserPrompt_IncludesInfobox(t *testing.T) {
	result := crawler.CrawlResult{
		Title: "Test",
		Infobox: []crawler.InfoboxEntry{
			{Key: "race", Value: "Half-elf"},
			{Key: "class", Value: "Bard"},
		},
	}
	prompt := buildUserPrompt(result)
	assert.Contains(t, prompt, "race: Half-elf")
	assert.Contains(t, prompt, "class: Bard")
}

func TestBuildUserPrompt_IncludesSections(t *testing.T) {
	result := crawler.CrawlResult{
		Title: "Test",
		Sections: []crawler.Section{
			{Heading: "Appearance", Body: "Tall and lean.", Level: 2},
		},
	}
	prompt := buildUserPrompt(result)
	assert.Contains(t, prompt, "## Appearance")
	assert.Contains(t, prompt, "Tall and lean.")
}

func TestBuildUserPrompt_SkipsEmptyInfobox(t *testing.T) {
	result := crawler.CrawlResult{Title: "Test", Infobox: []crawler.InfoboxEntry{}}
	prompt := buildUserPrompt(result)
	assert.NotContains(t, prompt, "Infobox:")
}

func TestBuildUserPrompt_SkipsEmptySections(t *testing.T) {
	result := crawler.CrawlResult{
		Title:    "Test",
		Sections: []crawler.Section{},
	}
	prompt := buildUserPrompt(result)
	assert.Contains(t, prompt, "Content:")
}

func TestBuildFieldMaskString_Empty(t *testing.T) {
	s := buildFieldMaskString(nil)
	assert.Empty(t, s)
}

func TestBuildFieldMaskString_WithFields(t *testing.T) {
	s := buildFieldMaskString([]string{"name", "appearance"})
	assert.Contains(t, s, "LOCKED")
	assert.Contains(t, s, "name")
	assert.Contains(t, s, "appearance")
}

func TestCleanResponse_PlainJSON(t *testing.T) {
	input := `{"name":"Elara"}`
	output := cleanResponse(input)
	assert.Equal(t, input, output)
}

func TestCleanResponse_CodeFence(t *testing.T) {
	input := "```json\n{\"name\":\"Elara\"}\n```"
	output := cleanResponse(input)
	assert.Equal(t, "{\"name\":\"Elara\"}", output)
}

func TestCleanResponse_GenericFence(t *testing.T) {
	input := "```\n{\"name\":\"Elara\"}\n```"
	output := cleanResponse(input)
	assert.Equal(t, "{\"name\":\"Elara\"}", output)
}

func TestGenerateBulk_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"name":          "Elara",
			"epithet":       "The Lark",
			"tags":          []string{"half-elf", "bard"},
			"appearance":    "Auburn hair.",
			"personality":   "Cheerful.",
			"backstory":     "Born in Reithwin.",
			"abilities":     "College of Lore.",
			"relationships": "Allies.",
			"quotes":        []string{"Hello."},
			"stats":         [][]string{{"STR", "10"}},
		}
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": mustMarshal(t, resp)}},
			},
		})
	}))
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "model"}
	result := crawler.CrawlResult{Title: "Elara Page"}
	ch, err := GenerateBulk(result, ep, nil, Character{})

	require.NoError(t, err)
	assert.Equal(t, "Elara", ch.Name)
	assert.Equal(t, "The Lark", ch.Epithet)
	assert.Len(t, ch.Tags, 2)
	assert.Equal(t, "Auburn hair.", ch.Appearance)
	assert.True(t, ch.Dirty)
}

func TestGenerateBulk_WithLockedFields(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"name":          "Overwritten",
			"epithet":       "New",
			"tags":          []string{},
			"appearance":    "New.",
			"personality":   "New.",
			"backstory":     "New.",
			"abilities":     "New.",
			"relationships": "New.",
			"quotes":        []string{},
			"stats":         [][]string{},
		}
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": mustMarshal(t, resp)}},
			},
		})
	}))
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "model"}
	result := crawler.CrawlResult{Title: "Page"}

	existing := Character{Name: "KeepMe", Epithet: "Original"}
	ch, err := GenerateBulk(result, ep, []string{"name", "epithet"}, existing)

	require.NoError(t, err)
	assert.Equal(t, "KeepMe", ch.Name)
	assert.Equal(t, "Original", ch.Epithet)
	assert.Equal(t, "New.", ch.Appearance)
}

func TestGenerateBulk_LLMError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "model"}
	result := crawler.CrawlResult{Title: "Page"}
	_, err := GenerateBulk(result, ep, nil, Character{})

	assert.Error(t, err)
}

func TestGenerateBulk_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": "not valid json"}},
			},
		})
	}))
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "model"}
	result := crawler.CrawlResult{Title: "Page"}
	_, err := GenerateBulk(result, ep, nil, Character{})

	assert.Error(t, err)
}

func mustMarshal(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return string(b)
}

/* ── GenerateField tests ──────────────────────────────── */

func TestGenerateField_Success_Appearance(t *testing.T) {
	srv := fieldLLMServer(t, `"A tall figure with auburn hair."`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Elara", URL: "https://wiki.test/Elara"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["appearance"] = "Describe {{crawl.title}}'s appearance."

	ch, err := GenerateField("appearance", result, ep, "", Character{Name: "Elara"}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, "A tall figure with auburn hair.", ch.Appearance)
	assert.True(t, ch.Dirty)
}

func TestGenerateField_Success_WithCustomPrompt(t *testing.T) {
	srv := fieldLLMServer(t, `"Friendly and warm."`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Elara"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["personality"] = "Describe {{crawl.title}}'s personality."

	ch, err := GenerateField("personality", result, ep, "Make her very shy.", Character{Name: "Elara"}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, "Friendly and warm.", ch.Personality)
}

func TestGenerateField_JSONWrapped_ObjectValue(t *testing.T) {
	srv := fieldLLMServer(t, `{"appearance": "Tall and lean."}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["appearance"] = "Describe appearance."

	ch, err := GenerateField("appearance", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, "Tall and lean.", ch.Appearance)
}

func TestGenerateField_JSONWrapped_CaseInsensitive(t *testing.T) {
	srv := fieldLLMServer(t, `{"Relationships": "Allies with the Harpers."}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["relationships"] = "Describe relationships."

	ch, err := GenerateField("relationships", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, "Allies with the Harpers.", ch.Relationships)
}

func TestGenerateField_JSONWrapped_ArrayToString(t *testing.T) {
	srv := fieldLLMServer(t, `{"relationships": ["Ally of Harpers", "Friend of Elara"]}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["relationships"] = "Describe."

	ch, err := GenerateField("relationships", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Contains(t, ch.Relationships, "Ally of Harpers")
	assert.Contains(t, ch.Relationships, "Friend of Elara")
}

func TestGenerateField_NoTemplate(t *testing.T) {
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	delete(tmpl.FieldPrompts, "name")

	_, err := GenerateField("name", result, llm.LLMEndpoint{}, "", Character{}, tmpl)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no template")
}

func TestGenerateField_LLMError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["appearance"] = "Describe."

	ch, err := GenerateField("appearance", result, ep, "", Character{Name: "KeepMe"}, tmpl)
	assert.Error(t, err)
	assert.Equal(t, "KeepMe", ch.Name)
}

func TestGenerateField_TagsArray(t *testing.T) {
	srv := fieldLLMServer(t, `{"tags": ["half-elf", "bard", "rogue"]}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["tags"] = "List tags."

	ch, err := GenerateField("tags", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, []string{"half-elf", "bard", "rogue"}, ch.Tags)
}

func TestGenerateField_StatsArray(t *testing.T) {
	srv := fieldLLMServer(t, `{"stats": [["STR","14"],["DEX","18"],["INT","12"]]}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["stats"] = "List stats."

	ch, err := GenerateField("stats", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Len(t, ch.Stats, 3)
	assert.Equal(t, StatKV{Key: "STR", Value: "14"}, ch.Stats[0])
}

func TestGenerateField_EmptyJSONTextFallback(t *testing.T) {
	srv := fieldLLMServer(t, `{"personality": ""}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["personality"] = "Describe."

	ch, err := GenerateField("personality", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.True(t, ch.Dirty)
}

func TestGenerateField_EmptyArrayTextFallback(t *testing.T) {
	srv := fieldLLMServer(t, `[{"backstory": "From a small village."}]`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["backstory"] = "Describe."

	ch, err := GenerateField("backstory", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.True(t, ch.Dirty)
}

func TestGenerateField_SystemPromptFromTemplate(t *testing.T) {
	srv := fieldLLMServer(t, `"Cheerful."`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.SystemPrompt = "You are a creative assistant."
	tmpl.FieldPrompts["personality"] = "Describe personality."

	ch, err := GenerateField("personality", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, "Cheerful.", ch.Personality)
}

func TestGenerateField_QuotesArray(t *testing.T) {
	srv := fieldLLMServer(t, `{"quotes": ["Hello there!", "Let's go!"]}`)
	defer srv.Close()

	ep := llm.LLMEndpoint{URL: srv.URL, Model: "m"}
	result := crawler.CrawlResult{Title: "Test"}
	tmpl := prompts.Defaults()
	tmpl.FieldPrompts["quotes"] = "List quotes."

	ch, err := GenerateField("quotes", result, ep, "", Character{}, tmpl)
	require.NoError(t, err)
	assert.Equal(t, []string{"Hello there!", "Let's go!"}, ch.Quotes)
}

/* ── resolveFieldValue tests ─────────────────────────── */

func TestResolveFieldValue_ValidJSON(t *testing.T) {
	val, err := resolveFieldValue("appearance", `{"appearance": "Tall."}`)
	require.NoError(t, err)
	assert.Equal(t, "Tall.", val)
}

func TestResolveFieldValue_RawText(t *testing.T) {
	val, err := resolveFieldValue("appearance", "A tall figure.")
	require.NoError(t, err)
	assert.Equal(t, "A tall figure.", val)
}

func TestResolveFieldValue_CaseInsensitive(t *testing.T) {
	val, err := resolveFieldValue("relationships", `{"Relationships": "Friendly."}`)
	require.NoError(t, err)
	assert.Equal(t, "Friendly.", val)
}

func TestResolveFieldValue_ArrayToString(t *testing.T) {
	val, err := resolveFieldValue("backstory", `{"backstory": ["Born in forest.", "Raised by elves."]}`)
	require.NoError(t, err)
	s, ok := val.(string)
	require.True(t, ok)
	assert.Contains(t, s, "Born in forest.")
	assert.Contains(t, s, "Raised by elves.")
}

func TestResolveFieldValue_EmptyStringFallback(t *testing.T) {
	val, err := resolveFieldValue("personality", `{"personality": ""}`)
	require.NoError(t, err)
	s, ok := val.(string)
	require.True(t, ok)
	assert.Contains(t, s, "personality")
}

func TestResolveFieldValue_InvalidJSON_ArrayField(t *testing.T) {
	_, err := resolveFieldValue("tags", "not json")
	assert.Error(t, err)
}

func TestResolveFieldValue_MissingKey(t *testing.T) {
	val, err := resolveFieldValue("appearance", `{"personality": "Cheerful."}`)
	require.NoError(t, err)
	s, ok := val.(string)
	require.True(t, ok)
	assert.Contains(t, s, "Cheerful")
}

func TestResolveFieldValue_NilValue(t *testing.T) {
	val, err := resolveFieldValue("backstory", `{"backstory": null}`)
	require.NoError(t, err)
	s, ok := val.(string)
	require.True(t, ok)
	assert.Contains(t, s, "backstory")
}

/* ── Helper tests ────────────────────────────────────── */

func TestBuildCrawlContent_Full(t *testing.T) {
	result := crawler.CrawlResult{
		Title: "Elara",
		URL:   "https://wiki.test/Elara",
		Infobox: []crawler.InfoboxEntry{
			{Key: "race", Value: "Half-elf"},
			{Key: "class", Value: "Bard"},
		},
		Sections: []crawler.Section{
			{Heading: "Appearance", Body: "Tall and lean.", Level: 2},
			{Heading: "Personality", Body: "Cheerful.", Level: 2},
		},
	}
	content := buildCrawlContent(result)
	assert.Contains(t, content, "Wiki page title: Elara")
	assert.Contains(t, content, "Infobox:")
	assert.Contains(t, content, "race: Half-elf")
	assert.Contains(t, content, "class: Bard")
	assert.Contains(t, content, "## Appearance")
	assert.Contains(t, content, "Tall and lean.")
	assert.Contains(t, content, "## Personality")
	assert.Contains(t, content, "Cheerful.")
}

func TestBuildCrawlContent_Minimal(t *testing.T) {
	result := crawler.CrawlResult{Title: "X", URL: "https://x"}
	content := buildCrawlContent(result)
	assert.Contains(t, content, "Wiki page title: X")
	assert.NotContains(t, content, "Infobox:")
}

func TestBuildCrawlContent_SkipsEmptyKey(t *testing.T) {
	result := crawler.CrawlResult{
		Title: "Test",
		Infobox: []crawler.InfoboxEntry{
			{Key: "", Value: "no key"},
			{Key: "real", Value: "yes"},
		},
	}
	content := buildCrawlContent(result)
	assert.NotContains(t, content, "no key")
	assert.Contains(t, content, "real: yes")
}

func TestBuildCrawlContent_EmptySections(t *testing.T) {
	result := crawler.CrawlResult{
		Title:    "Test",
		Sections: []crawler.Section{{Heading: "", Body: "body"}},
	}
	content := buildCrawlContent(result)
	assert.NotContains(t, content, "## ")
	assert.Contains(t, content, "body")
}

func TestIsTextField(t *testing.T) {
	assert.True(t, isTextField("appearance"))
	assert.True(t, isTextField("personality"))
	assert.True(t, isTextField("backstory"))
	assert.True(t, isTextField("abilities"))
	assert.True(t, isTextField("relationships"))
	assert.False(t, isTextField("name"))
	assert.False(t, isTextField("tags"))
	assert.False(t, isTextField("stats"))
}

func TestIsEmptyString(t *testing.T) {
	assert.True(t, isEmptyString(""))
	assert.False(t, isEmptyString("x"))
	assert.False(t, isEmptyString(42))
	assert.False(t, isEmptyString(nil))
}

func TestIsEmptyArray(t *testing.T) {
	assert.True(t, isEmptyArray([]any{}))
	assert.False(t, isEmptyArray([]any{"x"}))
	assert.False(t, isEmptyArray("not array"))
	assert.False(t, isEmptyArray(nil))
}

func TestFindCaseInsensitive_Exact(t *testing.T) {
	raw := map[string]any{"name": "Elara"}
	assert.Equal(t, "Elara", findCaseInsensitive(raw, "name"))
}

func TestFindCaseInsensitive_CaseMismatch(t *testing.T) {
	raw := map[string]any{"Name": "Elara"}
	assert.Equal(t, "Elara", findCaseInsensitive(raw, "name"))
}

func TestFindCaseInsensitive_NotFound(t *testing.T) {
	raw := map[string]any{"name": "Elara"}
	assert.Nil(t, findCaseInsensitive(raw, "missing"))
}

func TestFindCaseInsensitive_Empty(t *testing.T) {
	assert.Nil(t, findCaseInsensitive(map[string]any{}, "name"))
}

func TestTruncate_Short(t *testing.T) {
	assert.Equal(t, "hello", truncate("hello", 10))
	assert.Equal(t, "hello", truncate("hello", 5))
}

func TestTruncate_Long(t *testing.T) {
	assert.Equal(t, "hello...", truncate("hello world", 5))
}

/* ── applyField / applyStringField / applyStringSliceField tests ── */

func TestApplyField_StringFields(t *testing.T) {
	ch := Character{}
	applyField(&ch, "name", "Elara")
	assert.Equal(t, "Elara", ch.Name)

	applyField(&ch, "epithet", "The Brave")
	assert.Equal(t, "The Brave", ch.Epithet)

	applyField(&ch, "epithet", "")
	assert.Equal(t, "", ch.Epithet) // empty is allowed for epithet

	applyField(&ch, "appearance", "Tall.")
	assert.Equal(t, "Tall.", ch.Appearance)

	applyField(&ch, "personality", "Cheerful.")
	assert.Equal(t, "Cheerful.", ch.Personality)

	applyField(&ch, "backstory", "Born in forest.")
	assert.Equal(t, "Born in forest.", ch.Backstory)

	applyField(&ch, "abilities", "Archery.")
	assert.Equal(t, "Archery.", ch.Abilities)

	applyField(&ch, "relationships", "Friendly.")
	assert.Equal(t, "Friendly.", ch.Relationships)
}

func TestApplyField_EmptyStringDoesNotOverwrite(t *testing.T) {
	ch := Character{Name: "Elara"}
	applyField(&ch, "name", "")
	assert.Equal(t, "Elara", ch.Name)
}

func TestApplyField_Tags(t *testing.T) {
	ch := Character{Tags: []string{"old"}}
	applyField(&ch, "tags", []any{"half-elf", "bard"})
	assert.Equal(t, []string{"half-elf", "bard"}, ch.Tags)
}

func TestApplyField_TagsEmptyArray(t *testing.T) {
	ch := Character{Tags: []string{"old"}}
	applyField(&ch, "tags", []any{})
	assert.Equal(t, []string{"old"}, ch.Tags) // not overwritten
}

func TestApplyField_Quotes(t *testing.T) {
	ch := Character{}
	applyField(&ch, "quotes", []any{"Hello!", "Bye!"})
	assert.Equal(t, []string{"Hello!", "Bye!"}, ch.Quotes)
}

func TestApplyField_Stats(t *testing.T) {
	ch := Character{}
	applyField(&ch, "stats", []any{[]any{"STR", "14"}, []any{"DEX", "18"}})
	assert.Len(t, ch.Stats, 2)
	assert.Equal(t, StatKV{Key: "STR", Value: "14"}, ch.Stats[0])
	assert.Equal(t, StatKV{Key: "DEX", Value: "18"}, ch.Stats[1])
}

func TestApplyField_StatsMisshapen(t *testing.T) {
	ch := Character{}
	applyField(&ch, "stats", []any{[]any{"only"}, "bad", []any{"K", "V"}})
	assert.Len(t, ch.Stats, 1)
}

func TestApplyField_NilValue(t *testing.T) {
	ch := Character{Name: "Original"}
	applyField(&ch, "name", nil)
	assert.Equal(t, "Original", ch.Name)
}

func TestApplyStringField_All(t *testing.T) {
	ch := Character{}
	applyStringField(&ch, "name", "Alice")
	assert.Equal(t, "Alice", ch.Name)
	applyStringField(&ch, "epithet", "Brave")
	assert.Equal(t, "Brave", ch.Epithet)
	applyStringField(&ch, "appearance", "Tall")
	assert.Equal(t, "Tall", ch.Appearance)
	applyStringField(&ch, "personality", "Calm")
	assert.Equal(t, "Calm", ch.Personality)
	applyStringField(&ch, "backstory", "Orphan")
	assert.Equal(t, "Orphan", ch.Backstory)
	applyStringField(&ch, "abilities", "Magic")
	assert.Equal(t, "Magic", ch.Abilities)
	applyStringField(&ch, "relationships", "Solo")
	assert.Equal(t, "Solo", ch.Relationships)
}

func TestApplyStringField_NotString(t *testing.T) {
	ch := Character{}
	applyStringField(&ch, "name", 42)
	assert.Equal(t, "", ch.Name)
}

func TestApplyStringField_UnknownField(t *testing.T) {
	ch := Character{}
	applyStringField(&ch, "unknown", "value")
}

func TestApplyStringSliceField_NotArray(t *testing.T) {
	ch := Character{Tags: []string{"keep"}}
	applyStringSliceField(&ch, "tags", "not an array")
	assert.Equal(t, []string{"keep"}, ch.Tags)
}

func TestApplyStringSliceField_MixedTypes(t *testing.T) {
	ch := Character{}
	applyStringSliceField(&ch, "tags", []any{"valid", 42, "also"})
	assert.Equal(t, []string{"valid", "also"}, ch.Tags)
}

func TestApplyStringSliceField_Quotes(t *testing.T) {
	ch := Character{}
	applyStringSliceField(&ch, "quotes", []any{"q1", "q2"})
	assert.Equal(t, []string{"q1", "q2"}, ch.Quotes)
}

func TestApplyStatsField_Empty(t *testing.T) {
	ch := Character{Stats: []StatKV{{Key: "old", Value: "1"}}}
	applyStatsField(&ch, []any{})
	assert.Len(t, ch.Stats, 1)
}

func TestApplyStatsField_NotArray(t *testing.T) {
	ch := Character{Stats: []StatKV{{Key: "old", Value: "1"}}}
	applyStatsField(&ch, "bad")
	assert.Len(t, ch.Stats, 1)
}

/* ── helpers ─────────────────────────────────────────── */

func fieldLLMServer(t *testing.T, content string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": content}},
			},
		})
	}))
}
