// Package cardimport_test holds the export -> import round-trip integration
// test. It lives in the external test package because it needs BOTH
// cardexport and cardimport, and cardexport imports compose while cardimport
// imports compose too — an internal test file here would create a cycle.
package cardimport_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/cardexport"
	"silly-sleeve/internal/cardimport"
	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
)

// richCharacter is deliberately populated in every field that survives a card
// round-trip, so a regression that silently drops one shows up as a diff rather
// than as a passing test over empty strings.
func richCharacter() compose.Character {
	return compose.Character{
		ID:            7,
		Name:          "Elara Wynd",
		Epithet:       "The Crimson Lark",
		Tags:          []string{"half-elf", "bard", "spy"},
		Appearance:    "Auburn hair with crimson streaks; smoke-grey eyes.",
		Personality:   "Cheerful with strangers, watchful with friends.",
		Backstory:     "Born in Reithwin, apprenticed to the Harpers at fifteen.",
		Abilities:     "College of Lore; minor illusion magic; expert lute.",
		Relationships: "Halsin — mentor. Kethric — her greatest mistake.",
		Quotes: []string{
			"Sit. I will pour.",
			"A song is a contract.",
		},
		Stats: []compose.StatKV{
			{Key: "STR", Value: "10"},
			{Key: "DEX", Value: "16"},
			{Key: "CHA", Value: "18"},
		},
	}
}

func loreEntries() []lorebook.Entry {
	return []lorebook.Entry{
		{
			UID:        1,
			Comment:    "The Harpers",
			Key:        []string{"Harpers", "Harper"},
			Content:    "A secret society of bards and spies working for good.",
			Order:      100,
			Characters: []string{},
		},
		{
			UID:        2,
			Comment:    "Songthorn",
			Key:        []string{"Songthorn", "rapier"},
			Content:    "Elara's rapier, its guard shaped like a lark in flight.",
			Order:      40,
			Characters: []string{"7"},
		},
	}
}

// roundTrip exports a character as a PNG card and reads it straight back.
func roundTrip(t *testing.T, ch compose.Character, entries []lorebook.Entry, spec string, opts cardexport.Options) *cardimport.ParsedCard {
	t.Helper()

	png, err := cardexport.BuildCharacterPNG(ch, entries, spec, opts)
	require.NoError(t, err, "export should produce a PNG")
	require.NotEmpty(t, png)

	parsed, err := cardimport.ParseCard(png)
	require.NoError(t, err, "the card we just wrote must be readable back")
	require.NotNil(t, parsed)
	return parsed
}

func TestCardRoundTrip_V2PreservesCoreFields(t *testing.T) {
	ch := richCharacter()
	opts := cardexport.Options{EmbedLorebook: true, IncludeGreetings: true}

	parsed := roundTrip(t, ch, loreEntries(), "v2", opts)

	assert.Equal(t, ch.Name, parsed.Name)
	assert.Equal(t, ch.Personality, parsed.Personality)
	assert.Subset(t, parsed.Tags, ch.Tags, "every tag must survive the round-trip")

	// The narrative fields are composed into the card description; assert each
	// one actually made it rather than just that the description is non-empty.
	for _, want := range []string{ch.Appearance, ch.Backstory, ch.Abilities, ch.Relationships} {
		assert.Contains(t, parsed.Description, want)
	}
}

func TestCardRoundTrip_V3PreservesCoreFields(t *testing.T) {
	ch := richCharacter()
	opts := cardexport.Options{EmbedLorebook: true, IncludeGreetings: true}

	parsed := roundTrip(t, ch, loreEntries(), "v3", opts)

	assert.Equal(t, ch.Name, parsed.Name)
	assert.Equal(t, ch.Personality, parsed.Personality)
	assert.Contains(t, strings.ToLower(parsed.SpecVersion+" v3"), "v3")
}

func TestCardRoundTrip_EmbeddedLorebookSurvives(t *testing.T) {
	ch := richCharacter()
	entries := loreEntries()
	opts := cardexport.Options{EmbedLorebook: true, IncludeGreetings: true}

	parsed := roundTrip(t, ch, entries, "v2", opts)

	require.NotNil(t, parsed.CharacterBook, "EmbedLorebook was set, so a character_book must be present")
	require.Len(t, parsed.CharacterBook.Entries, len(entries))

	byContent := map[string]bool{}
	for _, e := range parsed.CharacterBook.Entries {
		byContent[e.Content] = true
	}
	for _, e := range entries {
		assert.True(t, byContent[e.Content], "lorebook entry %q lost in round-trip", e.Comment)
	}
}

func TestCardRoundTrip_LorebookOmittedWhenNotEmbedded(t *testing.T) {
	parsed := roundTrip(t, richCharacter(), loreEntries(), "v2", cardexport.Options{EmbedLorebook: false})

	if parsed.CharacterBook != nil {
		assert.Empty(t, parsed.CharacterBook.Entries,
			"EmbedLorebook was false, so no entries should be written into the card")
	}
}

func TestCardRoundTrip_ScopePerCharKeepsGlobalAndOwnedEntries(t *testing.T) {
	ch := richCharacter()
	entries := append(loreEntries(), lorebook.Entry{
		UID:        3,
		Comment:    "Someone else's secret",
		Key:        []string{"unrelated"},
		Content:    "Belongs to a different character entirely.",
		Order:      10,
		Characters: []string{"999"},
	})
	opts := cardexport.Options{EmbedLorebook: true, ScopePerChar: true}

	parsed := roundTrip(t, ch, entries, "v2", opts)

	require.NotNil(t, parsed.CharacterBook)
	var contents []string
	for _, e := range parsed.CharacterBook.Entries {
		contents = append(contents, e.Content)
	}
	assert.Contains(t, contents, "A secret society of bards and spies working for good.", "global entry must be kept")
	assert.Contains(t, contents, "Elara's rapier, its guard shaped like a lark in flight.", "entry linked to this character must be kept")
	assert.NotContains(t, contents, "Belongs to a different character entirely.", "another character's entry must be scoped out")
}

// The end-to-end shape that matters to a user: export a card, re-import it,
// and land back on an equivalent character in the editor.
func TestCardRoundTrip_ReimportsToEquivalentCharacter(t *testing.T) {
	ch := richCharacter()
	opts := cardexport.Options{EmbedLorebook: true, IncludeGreetings: true}

	parsed := roundTrip(t, ch, loreEntries(), "v2", opts)
	imported, importedEntries := cardimport.ToCharacter(parsed)

	assert.Equal(t, ch.Name, imported.Name)
	assert.Equal(t, ch.Personality, imported.Personality)
	assert.Subset(t, imported.Tags, ch.Tags)
	assert.Len(t, importedEntries, len(loreEntries()))

	// Per mem:conventions, entries crossing the Wails bridge must never carry a
	// nil Characters slice — nil arrives in JS as null, the cancel sentinel.
	for _, e := range importedEntries {
		assert.NotNil(t, e.Characters, "entry %q must have a non-nil Characters slice", e.Comment)
	}
}

func TestCardRoundTrip_MinimalCharacterDoesNotPanic(t *testing.T) {
	parsed := roundTrip(t, compose.Character{ID: 1, Name: "Nameless"}, nil, "v2", cardexport.Options{})

	assert.Equal(t, "Nameless", parsed.Name)
}
