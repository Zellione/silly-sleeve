package llmtest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/llm"
)

func TestScenarios_RegistersLoreAndImageScenarios(t *testing.T) {
	ids := make([]string, 0)
	for _, s := range Scenarios() {
		ids = append(ids, s.ID)
	}
	for _, want := range []string{
		"image-prompt-natural", "image-prompt-danbooru",
		"lore-extract-split", "lore-extract-summary",
		"lore-connect", "lore-optimize",
	} {
		assert.Contains(t, ids, want)
	}
}

func TestImagePromptScenario_SummarizesPrompts(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string {
		return "POSITIVE: (masterpiece), copper-haired lamplighter\nNEGATIVE: blurry, low quality"
	})
	s := findScenario(t, "image-prompt-natural")
	rec := NewRecorder(llm.DefaultCompleter)

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, rec)

	require.NoError(t, err)
	assert.False(t, s.ExpectJSON, "image prompts are labelled text, not JSON")
	assert.Equal(t, []string{"POSITIVE:", "NEGATIVE:"}, s.ExpectLabels)
	require.Len(t, rec.Exchanges, 1)

	pos, ok := summary["positiveChars"].(int)
	require.True(t, ok)
	assert.Positive(t, pos)
	neg, ok := summary["negativeChars"].(int)
	require.True(t, ok)
	assert.Positive(t, neg)
}

func TestImagePromptScenarios_UseDistinctStyles(t *testing.T) {
	var prompts []string
	_, ep := stubLLM(t, func(int, string) string {
		return "POSITIVE: p\nNEGATIVE: n"
	})
	for _, id := range []string{"image-prompt-natural", "image-prompt-danbooru"} {
		rec := NewRecorder(llm.DefaultCompleter)
		_, err := findScenario(t, id).Run(context.Background(), Config{Endpoint: ep}, rec)
		require.NoError(t, err)
		require.Len(t, rec.Exchanges, 1)
		prompts = append(prompts, rec.Exchanges[0].System)
	}
	assert.NotEqual(t, prompts[0], prompts[1], "the two image scenarios must exercise different style prompts")
	assert.Contains(t, prompts[1], "danbooru")
}

func extractionJSON() string {
	return `{"entries":[` +
		`{"category":"lore","comment":"The Hollow Mist","key":["Hollow Mist"],` +
		`"keysecondary":[],"content":"A sentient fog around Emberfall.","order":55,` +
		`"constant":false,"selective":false,"characters":[]},` +
		`{"category":"lore","comment":"Ember lanterns","key":["ember lantern"],` +
		`"keysecondary":[],"content":"Brass lanterns holding back the mist.","order":55,` +
		`"constant":false,"selective":false,"characters":[]}]}`
}

func TestLoreExtractSplitScenario_SummarizesCandidates(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string { return extractionJSON() })
	s := findScenario(t, "lore-extract-split")
	rec := NewRecorder(llm.DefaultCompleter)

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, rec)

	require.NoError(t, err)
	assert.True(t, s.ExpectJSON)
	assert.Equal(t, 2, summary["candidates"])

	keys, ok := summary["keys"].([]string)
	require.True(t, ok)
	assert.Contains(t, keys, "hollow mist")

	_, ok = summary["adjustments"].([]string)
	require.True(t, ok, "summary records what the normaliser corrected")
}

func TestLoreExtractScenario_DropsCategoryMandatedAdjustments(t *testing.T) {
	reply := `{"entries":[{"category":"character","comment":"Mira",` +
		`"key":["Mira Dawnhollow"],"keysecondary":[],` +
		`"content":"The last lamplighter of Emberfall tends the wall alone.","order":550,` +
		`"constant":false,"selective":false,"characters":["1"]}]}`
	_, ep := stubLLM(t, func(int, string) string { return reply })
	s := findScenario(t, "lore-extract-split")

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, NewRecorder(llm.DefaultCompleter))

	require.NoError(t, err)
	adjustments, ok := summary["adjustments"].([]string)
	require.True(t, ok)
	assert.Contains(t, adjustments, "Only 1 keyword; 2 or more trigger more reliably.",
		"corrections of fields the model chose must stay visible")
	for _, a := range adjustments {
		assert.NotContains(t, a, "(required for",
			"category-mandated settings fire mechanically and are not model findings")
	}
}

func TestLoreExtractSummaryScenario_KeepsOneCandidate(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string { return extractionJSON() })
	s := findScenario(t, "lore-extract-summary")

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, NewRecorder(llm.DefaultCompleter))

	require.NoError(t, err)
	assert.Equal(t, 1, summary["candidates"], "summary mode keeps a single whole-page entry")
}

func TestLoreExtractCheck_FlagsZeroCandidatesAndAdjustments(t *testing.T) {
	s := findScenario(t, "lore-extract-split")

	empty := s.Check(map[string]any{"candidates": 0, "adjustments": []string{}})
	require.NotEmpty(t, empty)
	assert.Contains(t, empty[0], "no candidates")

	adjusted := s.Check(map[string]any{
		"candidates":  2,
		"adjustments": []string{"forced position", "clamped order"},
	})
	require.NotEmpty(t, adjusted)
	assert.Contains(t, adjusted[0], "2")

	assert.Empty(t, s.Check(map[string]any{"candidates": 2, "adjustments": []string{}}))
}

func TestLoreConnectScenario_CountsSuggestionsByKind(t *testing.T) {
	reply := `{"suggestions":[` +
		`{"kind":"triggerKeys","entryUid":2,"addKeys":["Hollow Mist"],"rationale":"keyless entry"},` +
		`{"kind":"entryOrder","entryUid":1,"proposedOrder":60,"rationale":"tiering"}]}`
	_, ep := stubLLM(t, func(int, string) string { return reply })
	s := findScenario(t, "lore-connect")

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, NewRecorder(llm.DefaultCompleter))

	require.NoError(t, err)
	assert.True(t, s.ExpectJSON)
	assert.Equal(t, 1, summary["connectionSuggestions"])
	assert.Equal(t, 1, summary["ruleChangeSuggestions"])

	byKind, ok := summary["byKind"].(map[string]int)
	require.True(t, ok)
	assert.Equal(t, 1, byKind["triggerKeys"])
	assert.Equal(t, 1, byKind["entryOrder"])
}

func TestLoreConnectCheck_FlagsZeroConnectionSuggestions(t *testing.T) {
	s := findScenario(t, "lore-connect")

	problems := s.Check(map[string]any{"connectionSuggestions": 0, "ruleChangeSuggestions": 3})

	require.NotEmpty(t, problems)
	assert.Contains(t, problems[0], "no connection suggestions")

	assert.Empty(t, s.Check(map[string]any{"connectionSuggestions": 1, "ruleChangeSuggestions": 0}))
}

func TestLoreOptimizeScenario_UsesRuleGapFixture(t *testing.T) {
	reply := `{"suggestions":[` +
		`{"kind":"removeKeys","entryUid":1,"removeKeys":["the"],"rationale":"generic key"}]}`
	_, ep := stubLLM(t, func(int, string) string { return reply })
	s := findScenario(t, "lore-optimize")
	rec := NewRecorder(llm.DefaultCompleter)

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, rec)

	require.NoError(t, err)
	assert.Equal(t, 1, summary["ruleChangeSuggestions"])
	require.NotEmpty(t, rec.Exchanges)
	assert.Contains(t, rec.Exchanges[0].User, "Duplicate lantern lore",
		"the optimize scenario must send the rule-gap fixture, not the connect fixture")
}

func TestFixtureRuleGapEntries_HaveDeliberateRuleProblems(t *testing.T) {
	entries := FixtureRuleGapEntries()

	require.GreaterOrEqual(t, len(entries), 3)
	hasGenericKey := false
	for _, e := range entries {
		for _, k := range e.Key {
			if k == "the" {
				hasGenericKey = true
			}
		}
	}
	assert.True(t, hasGenericKey, "a generic key gives the optimize pass a removeKeys target")
}
