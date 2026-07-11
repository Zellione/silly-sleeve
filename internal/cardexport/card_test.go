package cardexport

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
)

func sampleChar() compose.Character {
	return compose.Character{
		ID:          1,
		Name:        "Alice",
		Epithet:     "The Brave",
		Tags:        []string{"hero"},
		Appearance:  "Tall.",
		Personality: "Cheerful.",
		Quotes:      []string{"Hello there!", "Stand back."},
	}
}

func sampleEntries() []lorebook.Entry {
	return []lorebook.Entry{
		{UID: 0, Comment: "The Harpers", Key: []string{"harper"}, Content: "A faction.", Order: 100, Position: 0, Characters: []string{"1"}},
		{UID: 1, Comment: "World baseline", Key: []string{"faerun"}, Content: "The world.", Order: 200, Position: 1, Characters: []string{}},
		{UID: 2, Comment: "Bob's secret", Key: []string{"bob"}, Content: "Hidden.", Order: 50, Position: 0, Characters: []string{"2"}},
	}
}

// decode unmarshals card JSON into a generic map for assertions.
func decode(t *testing.T, data []byte) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(data, &m))
	return m
}

func TestCardV2JSONSpec(t *testing.T) {
	data, err := CardV2JSON(sampleChar(), nil, "1", Options{IncludeGreetings: true})
	require.NoError(t, err)

	m := decode(t, data)
	assert.Equal(t, "chara_card_v2", m["spec"])
	assert.Equal(t, "2.0", m["spec_version"])

	d := m["data"].(map[string]any)
	assert.Equal(t, "Alice", d["name"])
	assert.Equal(t, "Hello there!", d["first_mes"])
	assert.Contains(t, d["description"], "Tall.")
}

func TestCardV3JSONSpec(t *testing.T) {
	data, err := CardV3JSON(sampleChar(), nil, "1", Options{IncludeGreetings: true})
	require.NoError(t, err)

	m := decode(t, data)
	assert.Equal(t, "chara_card_v3", m["spec"])
	assert.Equal(t, "3.0", m["spec_version"])

	d := m["data"].(map[string]any)
	// v3 adds an assets array referencing the embedded portrait.
	assets := d["assets"].([]any)
	assert.NotEmpty(t, assets)
}

func TestEmbedLorebookAttachesCharacterBook(t *testing.T) {
	opts := Options{EmbedLorebook: true, IncludeGreetings: true}
	data, err := CardV3JSON(sampleChar(), sampleEntries(), "1", opts)
	require.NoError(t, err)

	d := decode(t, data)["data"].(map[string]any)
	book := d["character_book"].(map[string]any)
	entries := book["entries"].([]any)
	assert.Len(t, entries, 3)

	first := entries[0].(map[string]any)
	assert.Equal(t, []any{"harper"}, first["keys"])
	assert.Equal(t, "before_char", first["position"])
	assert.Equal(t, float64(100), first["insertion_order"])
}

func TestNoEmbedOmitsCharacterBook(t *testing.T) {
	opts := Options{EmbedLorebook: false, IncludeGreetings: true}
	data, err := CardV3JSON(sampleChar(), sampleEntries(), "1", opts)
	require.NoError(t, err)

	d := decode(t, data)["data"].(map[string]any)
	_, ok := d["character_book"]
	assert.False(t, ok, "character_book should be omitted when EmbedLorebook is false")
}

func TestScopePerCharFiltersEntries(t *testing.T) {
	opts := Options{EmbedLorebook: true, ScopePerChar: true, IncludeGreetings: true}
	data, err := CardV3JSON(sampleChar(), sampleEntries(), "1", opts)
	require.NoError(t, err)

	d := decode(t, data)["data"].(map[string]any)
	entries := d["character_book"].(map[string]any)["entries"].([]any)
	// Alice (key "1") keeps her scoped entry + the global one, drops Bob's.
	assert.Len(t, entries, 2)
}

func TestAlternateGreetingsExported(t *testing.T) {
	ch := sampleChar()
	ch.AltGreetings = []string{"Oh, it's you.", "Welcome back."}
	data, err := CardV2JSON(ch, nil, "1", Options{IncludeGreetings: true})
	require.NoError(t, err)

	d := decode(t, data)["data"].(map[string]any)
	assert.Equal(t, []any{"Oh, it's you.", "Welcome back."}, d["alternate_greetings"])
}

func TestExcludeGreetings(t *testing.T) {
	opts := Options{IncludeGreetings: false}
	data, err := CardV2JSON(sampleChar(), nil, "1", opts)
	require.NoError(t, err)

	d := decode(t, data)["data"].(map[string]any)
	assert.Empty(t, d["first_mes"])
	assert.Empty(t, d["alternate_greetings"])
}

func TestStripMetadata(t *testing.T) {
	opts := Options{StripMetadata: true, IncludeGreetings: true}
	data, err := CardV2JSON(sampleChar(), nil, "1", opts)
	require.NoError(t, err)

	d := decode(t, data)["data"].(map[string]any)
	assert.Empty(t, d["creator"])
	assert.Empty(t, d["character_version"])
}

func TestPositionStringMapping(t *testing.T) {
	assert.Equal(t, "before_char", positionString(0))
	assert.Equal(t, "after_char", positionString(1))
	assert.Equal(t, "before_char", positionString(99))
}
