package prompts

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaults_IncludesEveryLorePrompt(t *testing.T) {
	ts := Defaults()
	require.Len(t, ts.LorePrompts, len(LorePromptIDs()))

	for _, id := range LorePromptIDs() {
		prompt, ok := ts.LorePrompts[id]
		assert.True(t, ok, "missing lore prompt %q", id)
		assert.NotEmpty(t, prompt, "empty lore prompt %q", id)
		assert.NotEqual(t, id, LorePromptLabel(id), "lore prompt %q has no label", id)
	}
}

func TestDefaultLorePrompt_UnknownIsEmpty(t *testing.T) {
	assert.Empty(t, defaultLorePrompt("nope"))
	assert.Equal(t, "nope", LorePromptLabel("nope"))
}

func TestLorePrompts_DeclareTheVariablesTheyUse(t *testing.T) {
	tests := map[string][]string{
		LoreExtractSplit:   {"{{crawl_context}}", "{{character_roster}}", "{{entry_index}}", "{{style.rewrite}}", "{{style.opening}}"},
		LoreExtractSummary: {"{{crawl_context}}", "{{character_roster}}", "{{entry_index}}", "{{style.rewrite}}", "{{style.opening}}"},
		LoreConnect:        {"{{character_roster}}", "{{entry_index}}", "{{focus_entries}}"},
	}

	for id, wantVars := range tests {
		t.Run(id, func(t *testing.T) {
			prompt := defaultLorePrompt(id)
			for _, v := range wantVars {
				assert.Contains(t, prompt, v)
			}
		})
	}
}

func TestLoreVariableNames_CoverEveryPlaceholderUsed(t *testing.T) {
	declared := make(map[string]bool, len(LoreVariableNames()))
	for _, v := range LoreVariableNames() {
		declared[v] = true
	}

	// The system prompt is excluded: its "{{char}}"/"{{user}}" are quoted
	// SillyTavern placeholders the model is told not to emit, not substitutions
	// we perform. Substitute leaves unknown placeholders alone, so they survive
	// into the prompt intact, which is what we want.
	for _, id := range LorePromptIDs() {
		if id == LoreSystem {
			continue
		}
		for _, name := range placeholdersIn(defaultLorePrompt(id)) {
			assert.True(t, declared[name],
				"lore prompt %q uses {{%s}}, which LoreVariableNames does not declare", id, name)
		}
	}
}

func TestLoreSystemPrompt_KeepsSillyTavernPlaceholdersLiteral(t *testing.T) {
	// Substitute must not have a variable named char or user, or the instruction
	// telling the model to avoid those placeholders would itself be substituted.
	p := defaultLorePrompt(LoreSystem)
	assert.Contains(t, p, "{{char}}")

	out := Substitute(p, BuildVars("t", "u", "c"))
	assert.Contains(t, out, "{{char}}")
	assert.Contains(t, out, "{{user}}")
}

// placeholdersIn returns the {{name}} placeholders appearing in a template.
func placeholdersIn(template string) []string {
	var out []string
	rest := template
	for {
		start := strings.Index(rest, "{{")
		if start == -1 {
			return out
		}
		rest = rest[start+2:]
		end := strings.Index(rest, "}}")
		if end == -1 {
			return out
		}
		out = append(out, rest[:end])
		rest = rest[end+2:]
	}
}

func TestExtractionPrompts_CarryTheSpecRules(t *testing.T) {
	// The prompt is the only place the extraction spec is stated to the model,
	// so a silent edit that drops a rule would quietly change output quality.
	for _, id := range []string{LoreExtractSplit, LoreExtractSummary} {
		t.Run(id, func(t *testing.T) {
			p := defaultLorePrompt(id)
			assert.Contains(t, p, "ONE atomic concept")
			assert.Contains(t, p, "Never copy it verbatim")
			assert.Contains(t, p, "Omit rather than invent")
			assert.Contains(t, p, "keysecondary")
			assert.Contains(t, p, "relationships(")
			assert.Contains(t, p, "characters")
			assert.Contains(t, p, "900-999")
			for _, category := range []string{"character", "location", "organization", "item", "rule", "event", "concept"} {
				assert.Contains(t, p, category, "category %q missing from the prompt", category)
			}
			assert.Contains(t, p, "No markdown fences")
		})
	}
}

func TestSummaryPrompt_AsksForExactlyOneEntry(t *testing.T) {
	p := defaultLorePrompt(LoreExtractSummary)
	assert.Contains(t, p, "SINGLE lorebook entry")
	assert.Contains(t, p, "exactly one entry")
}

func TestConnectPrompt_CoversEveryConnectionKind(t *testing.T) {
	p := defaultLorePrompt(LoreConnect)
	kinds := []string{
		"entryCharacter", "triggerKeys", "entryEntry", "characterCharacter",
		"entryOrder", "entryPosition", "entryFlags", "removeKeys",
	}
	for _, kind := range kinds {
		assert.Contains(t, p, kind)
	}
	assert.Contains(t, p, "complete replacement relationships text",
		"the prompt must ask for full text, since a fragment would clobber the existing prose")
	for _, field := range []string{"proposedOrder", "proposedPosition", "proposedDepth", "flags"} {
		assert.Contains(t, p, field, "the JSON contract must show the %s field", field)
	}
	assert.Contains(t, p, "900-999", "the prompt must restate the order tiers it should propose within")
}

func TestWithDefaults_BackfillsLorePrompts(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		out := TemplateSet{}.WithDefaults()
		assert.Len(t, out.LorePrompts, len(LorePromptIDs()))
		for _, id := range LorePromptIDs() {
			assert.NotEmpty(t, out.LorePrompts[id])
		}
	})

	t.Run("keeps customisation, fills gaps", func(t *testing.T) {
		ts := TemplateSet{LorePrompts: map[string]string{LoreConnect: "mine"}}
		out := ts.WithDefaults()

		assert.Equal(t, "mine", out.LorePrompts[LoreConnect])
		assert.Equal(t, defaultLorePrompt(LoreExtractSplit), out.LorePrompts[LoreExtractSplit])
	})
}

func TestClone_DeepCopiesLorePrompts(t *testing.T) {
	ts := Defaults()
	clone := ts.Clone()
	clone.LorePrompts[LoreConnect] = "changed"

	assert.NotEqual(t, "changed", ts.LorePrompts[LoreConnect])
}

func TestMerge(t *testing.T) {
	base := TemplateSet{
		SystemPrompt: "base system",
		FieldPrompts: map[string]string{"name": "base name"},
		LorePrompts:  map[string]string{LoreConnect: "custom connect"},
	}

	t.Run("omitted groups survive", func(t *testing.T) {
		// This is the settings-screen shape: it knows about the system prompt
		// and character fields, and nothing about lorebook prompts.
		out := base.Merge(TemplateSet{
			SystemPrompt: "new system",
			FieldPrompts: map[string]string{"name": "new name"},
		})

		assert.Equal(t, "new system", out.SystemPrompt)
		assert.Equal(t, "new name", out.FieldPrompts["name"])
		assert.Equal(t, "custom connect", out.LorePrompts[LoreConnect],
			"a caller that does not know about lore prompts must not wipe them")
	})

	t.Run("provided groups replace", func(t *testing.T) {
		out := base.Merge(TemplateSet{LorePrompts: map[string]string{LoreConnect: "replaced"}})

		assert.Equal(t, "replaced", out.LorePrompts[LoreConnect])
		assert.Equal(t, "base system", out.SystemPrompt)
		assert.Equal(t, "base name", out.FieldPrompts["name"])
	})

	t.Run("empty merge changes nothing", func(t *testing.T) {
		out := base.Merge(TemplateSet{})

		assert.Equal(t, base.SystemPrompt, out.SystemPrompt)
		assert.Equal(t, base.FieldPrompts, out.FieldPrompts)
		assert.Equal(t, base.LorePrompts, out.LorePrompts)
	})

	t.Run("result is a copy", func(t *testing.T) {
		out := base.Merge(TemplateSet{})
		out.LorePrompts[LoreConnect] = "mutated"

		assert.Equal(t, "custom connect", base.LorePrompts[LoreConnect])
	})
}
