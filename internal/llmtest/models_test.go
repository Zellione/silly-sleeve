package llmtest

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"silly-sleeve/internal/compose"
)

func TestFieldText_RendersEveryFieldID(t *testing.T) {
	ch := FixtureCharacter()

	want := map[string]string{
		"name":          ch.Name,
		"epithet":       ch.Epithet,
		"tags":          "female, lamplighter, fantasy, cheerful, haunted",
		"appearance":    ch.Appearance,
		"personality":   ch.Personality,
		"backstory":     ch.Backstory,
		"abilities":     ch.Abilities,
		"relationships": ch.Relationships,
		"quotes":        ch.Quotes[0] + "\n" + ch.Quotes[1],
		"altGreetings":  "",
		"stats":         "Class: Lamplighter\nAlignment: Neutral Good",
	}
	for _, id := range compose.FieldIDs() {
		assert.Equal(t, want[id], FieldText(ch, id), "field %s", id)
	}
}

func TestFieldText_UnknownFieldIsEmpty(t *testing.T) {
	assert.Empty(t, FieldText(FixtureCharacter(), "no-such-field"))
}

func TestFieldText_SkipsBlankStatRows(t *testing.T) {
	ch := compose.Character{Stats: []compose.StatKV{{Key: "", Value: ""}, {Key: "HP", Value: "12"}}}

	assert.Equal(t, "HP: 12", FieldText(ch, "stats"))
}

func TestConfig_CompleterDefaultsToProduction(t *testing.T) {
	assert.NotNil(t, Config{}.completerOrDefault())
}

func TestConfig_RunsDefaultsToOne(t *testing.T) {
	assert.Equal(t, 1, Config{}.runsOrDefault())
	assert.Equal(t, 5, Config{Runs: 5}.runsOrDefault())
}
