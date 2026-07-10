package cardimport

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/cardexport"
	"silly-sleeve/internal/compose"
)

func TestToCharacter_Headings(t *testing.T) {
	desc := "### Appearance\ntall\n\n### Backstory\norphan\n\n### Stats\n- **STR**: 10"
	ch, _ := ToCharacter(&ParsedCard{
		Name: "Ada", Description: desc, Personality: "calm",
		FirstMes: "Hi", Tags: []string{"x"}, CreatorNotes: "Pilot",
	})
	assert.Equal(t, "Ada", ch.Name)
	assert.Equal(t, "tall", ch.Appearance)
	assert.Equal(t, "orphan", ch.Backstory)
	assert.Equal(t, "calm", ch.Personality)
	assert.Equal(t, "Pilot", ch.Epithet)
	assert.Equal(t, []string{"x"}, ch.Tags)
	assert.Equal(t, []string{"Hi"}, ch.Quotes)
	require.Len(t, ch.Stats, 1)
	assert.Equal(t, compose.StatKV{Key: "STR", Value: "10"}, ch.Stats[0])
}

func TestToCharacter_BlobFallback(t *testing.T) {
	ch, _ := ToCharacter(&ParsedCard{Name: "Bo", Description: "just a plain blurb"})
	assert.Equal(t, "just a plain blurb", ch.Backstory)
	assert.Empty(t, ch.Appearance)
}

func TestToCharacter_EmptyNameDefaults(t *testing.T) {
	ch, _ := ToCharacter(&ParsedCard{})
	assert.Equal(t, "Untitled", ch.Name)
}

func TestToCharacter_AltGreetingsSeparateFromQuotes(t *testing.T) {
	ch, _ := ToCharacter(&ParsedCard{
		Name:               "Ada",
		FirstMes:           "Hi",
		AlternateGreetings: []string{"Oh, it's you.", "", "Welcome back."},
	})
	assert.Equal(t, []string{"Hi"}, ch.Quotes, "alternate greetings must not be folded into Quotes")
	assert.Equal(t, []string{"Oh, it's you.", "Welcome back."}, ch.AltGreetings)
}

func TestToCharacter_AltGreetingsEmptyDefaultsToEmptySlice(t *testing.T) {
	ch, _ := ToCharacter(&ParsedCard{Name: "Ada", FirstMes: "Hi"})
	assert.Equal(t, []string{}, ch.AltGreetings)
}

func TestToCharacter_CharacterBook(t *testing.T) {
	enabled := false
	_, entries := ToCharacter(&ParsedCard{CharacterBook: &CharacterBook{Entries: []BookEntry{
		{Keys: []string{"k"}, Content: "c", Comment: "note", InsertionOrder: 50,
			Position: "after_char", Selective: true, Enabled: &enabled},
	}}})
	require.Len(t, entries, 1)
	assert.Equal(t, []string{"k"}, entries[0].Key)
	assert.Equal(t, "c", entries[0].Content)
	assert.Equal(t, "note", entries[0].Comment)
	assert.Equal(t, 50, entries[0].Order)
	assert.Equal(t, 1, entries[0].Position)
	assert.True(t, entries[0].Selective)
	assert.True(t, entries[0].Disable) // enabled:false -> disabled
}

func TestRoundTrip_Export_Import(t *testing.T) {
	orig := compose.NewCharacter(7)
	orig.Name = "Ada"
	orig.Appearance = "tall"
	orig.Personality = "calm"
	orig.Backstory = "orphan"
	orig.Abilities = "coding"
	orig.Relationships = "none"
	orig.Tags = []string{"sci-fi"}
	orig.Quotes = []string{"Hello there"}
	orig.AltGreetings = []string{"Oh, it's you.", "Welcome back."}
	orig.Stats = []compose.StatKV{{Key: "STR", Value: "10"}}

	raw, err := cardexport.CardV2JSON(orig, nil, "0", cardexport.Options{IncludeGreetings: true})
	require.NoError(t, err)
	pc, err := ParseCard(raw)
	require.NoError(t, err)
	got, _ := ToCharacter(pc)

	assert.Equal(t, orig.Name, got.Name)
	assert.Equal(t, orig.Appearance, got.Appearance)
	assert.Equal(t, orig.Personality, got.Personality)
	assert.Equal(t, orig.Backstory, got.Backstory)
	assert.Equal(t, orig.Abilities, got.Abilities)
	assert.Equal(t, orig.Relationships, got.Relationships)
	assert.Equal(t, orig.Tags, got.Tags)
	assert.Equal(t, []string{"Hello there"}, got.Quotes)
	assert.Equal(t, orig.AltGreetings, got.AltGreetings)
	assert.Equal(t, orig.Stats, got.Stats)
}

func TestToCharacter_EmptyStatsAndQuotesUseSentinels(t *testing.T) {
	// A card with no stats section and no messages falls back to the same
	// sentinels compose.NewCharacter uses (one blank stat row, one blank quote),
	// keeping imported characters consistent with freshly created ones.
	ch, _ := ToCharacter(&ParsedCard{Name: "Empty", Description: "just prose"})
	assert.Equal(t, []compose.StatKV{{Key: "", Value: ""}}, ch.Stats)
	assert.Equal(t, []string{""}, ch.Quotes)
}

func TestParseStats_BlankRowsReturnSentinel(t *testing.T) {
	// A Stats section whose rows are all blank yields the single sentinel row,
	// not an empty slice.
	ch, _ := ToCharacter(&ParsedCard{Name: "S", Description: "### Stats\n- :"})
	assert.Equal(t, []compose.StatKV{{Key: "", Value: ""}}, ch.Stats)
}
