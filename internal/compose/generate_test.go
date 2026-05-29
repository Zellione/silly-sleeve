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
