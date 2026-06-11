package compose

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSlugify(t *testing.T) {
	assert.Equal(t, "alice-the-brave", slugify("Alice the Brave"))
	assert.Equal(t, "test-character", slugify("Test_Character"))
	assert.Equal(t, "hello-world", slugify("Hello! World?"))
	assert.Equal(t, "", slugify("?! "))
	assert.Equal(t, "123", slugify("123"))
}

func TestExportSillyTavernCard(t *testing.T) {
	dir := t.TempDir()
	ch := Character{
		ID:            1,
		Name:          "Alice",
		Epithet:       "The Brave",
		Tags:          []string{"hero", "elf"},
		Appearance:    "Tall and slender.",
		Personality:   "Cheerful and brave.",
		Backstory:     "Born in a forest.",
		Abilities:     "Archery, tracking.",
		Relationships: "Bob — ally.",
		Quotes:        []string{"Let's go!", "I won't give up."},
		Stats:         []StatKV{{Key: "STR", Value: "12"}, {Key: "DEX", Value: "18"}},
	}

	path, err := ExportSillyTavernCard(ch, dir)
	require.NoError(t, err)
	assert.Equal(t, dir+"/alice.json", path)

	data, err := os.ReadFile(path)
	require.NoError(t, err)

	var st map[string]any
	require.NoError(t, json.Unmarshal(data, &st))

	assert.Equal(t, "Alice", st["name"])
	assert.Equal(t, "Cheerful and brave.", st["personality"])
	assert.Equal(t, "Let's go!", st["first_mes"])
	assert.Contains(t, st["mes_example"], "I won't give up.")
	for _, want := range []string{"Appearance", "Personality", "Backstory", "Abilities", "Relationships", "Stats", "STR"} {
		assert.Contains(t, st["description"], want)
	}
	assert.Equal(t, "Silly Sleeve", st["creator"])
	assert.Equal(t, "The Brave", st["creatorcomment"])
	assert.Equal(t, "1.0", st["character_version"])
	assert.Len(t, st["tags"].([]any), 2)
}

func TestExportSillyTavernCard_EmptyNameAndTags(t *testing.T) {
	dir := t.TempDir()
	path, err := ExportSillyTavernCard(Character{ID: 1}, dir)
	require.NoError(t, err)
	// Empty name falls back to "character.json".
	assert.Equal(t, dir+"/character.json", path)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	var st map[string]any
	require.NoError(t, json.Unmarshal(data, &st))
	// tags must serialize as an empty array, not null.
	assert.Equal(t, []any{}, st["tags"])
	assert.Equal(t, "", st["first_mes"])
}
