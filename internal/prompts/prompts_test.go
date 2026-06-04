package prompts

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDefaults(t *testing.T) {
	ts := Defaults()
	assert.NotEmpty(t, ts.SystemPrompt)
	assert.Len(t, ts.FieldPrompts, len(FieldIDs()))
	for _, id := range FieldIDs() {
		prompt, ok := ts.FieldPrompts[id]
		assert.True(t, ok, "missing prompt for field "+id)
		assert.NotEmpty(t, prompt, "empty prompt for field "+id)
		assert.Contains(t, prompt, "{{crawl_context}}", "prompt for %s must contain crawl_context variable", id)
	}
}

func TestSubstitute(t *testing.T) {
	type test struct {
		name     string
		template string
		vars     map[string]string
		want     string
	}
	tests := []test{
		{
			name:     "empty",
			template: "",
			vars:     nil,
			want:     "",
		},
		{
			name:     "no vars",
			template: "hello world",
			vars:     nil,
			want:     "hello world",
		},
		{
			name:     "single var",
			template: "hello {{name}}",
			vars:     map[string]string{"name": "world"},
			want:     "hello world",
		},
		{
			name:     "multiple vars",
			template: "{{greeting}} {{name}}!",
			vars:     map[string]string{"greeting": "hello", "name": "world"},
			want:     "hello world!",
		},
		{
			name:     "var with dots",
			template: "title: {{crawl.title}}",
			vars:     map[string]string{"crawl.title": "Elara Wynd"},
			want:     "title: Elara Wynd",
		},
		{
			name:     "var not found",
			template: "hello {{missing}}",
			vars:     map[string]string{},
			want:     "hello {{missing}}",
		},
		{
			name:     "var empty value",
			template: "hello {{name}}",
			vars:     map[string]string{"name": ""},
			want:     "hello ",
		},
		{
			name:     "crawl content injection",
			template: "Before\n{{crawl_context}}\nAfter",
			vars:     map[string]string{"crawl_context": "wiki body text"},
			want:     "Before\nwiki body text\nAfter",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Substitute(tc.template, tc.vars)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestFieldIDs(t *testing.T) {
	ids := FieldIDs()
	assert.Len(t, ids, 10)
	assert.Equal(t, "name", ids[0])
	assert.Equal(t, "stats", ids[9])
	seen := make(map[string]bool)
	for _, id := range ids {
		assert.False(t, seen[id], "duplicate field: "+id)
		seen[id] = true
	}
}

func TestFieldLabel(t *testing.T) {
	assert.Equal(t, "Name", FieldLabel("name"))
	assert.Equal(t, "Title / epithet", FieldLabel("epithet"))
	assert.Equal(t, "Stat block", FieldLabel("stats"))
	assert.Equal(t, "unknown", FieldLabel("unknown"))
}

func TestVariableNames(t *testing.T) {
	names := VariableNames()
	assert.Len(t, names, 6)
	assert.Contains(t, names, "crawl_context")
	assert.Contains(t, names, "crawl.title")
	assert.Contains(t, names, "crawl.url")
	assert.Contains(t, names, "character.name")
	assert.Contains(t, names, "character.epithet")
	assert.Contains(t, names, "custom")
}

func TestClone(t *testing.T) {
	orig := Defaults()
	clone := orig.Clone()

	assert.Equal(t, orig.SystemPrompt, clone.SystemPrompt)
	assert.Len(t, clone.FieldPrompts, len(orig.FieldPrompts))

	// Mutate clone, ensure original unchanged
	clone.SystemPrompt = "modified"
	clone.FieldPrompts["name"] = "changed"

	assert.NotEqual(t, orig.SystemPrompt, clone.SystemPrompt)
	assert.NotEqual(t, orig.FieldPrompts["name"], clone.FieldPrompts["name"])
}

func TestBuildVars(t *testing.T) {
	vars := BuildVars("Elara Wynd", "https://example.com/wiki/Elara", "wiki content")
	assert.Equal(t, "Elara Wynd", vars["crawl.title"])
	assert.Equal(t, "https://example.com/wiki/Elara", vars["crawl.url"])
	assert.Equal(t, "wiki content", vars["crawl_context"])
	assert.Equal(t, "", vars["custom"])
}

func TestDefaultFieldPromptsAreComplete(t *testing.T) {
	ts := Defaults()
	for _, id := range FieldIDs() {
		prompt := ts.FieldPrompts[id]
		assert.NotEmpty(t, prompt)
		// All default prompts must contain the crawl_context placeholder
		assert.Contains(t, prompt, "{{crawl_context}}")
		// All default prompts must mention returning JSON
		assert.Contains(t, prompt, "JSON")
	}
}
