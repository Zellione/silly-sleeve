package bundle

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
)

// TestBundleRoundTrip_WithCharactersAndLorebook verifies that a project with
// characters, lorebook, and metadata survives a write-read cycle with data integrity.
func TestBundleRoundTrip_WithCharactersAndLorebook(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "project.slv")

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name:         "Integration Test Project",
			ActiveCharID: 1,
			SourceURL:    "https://fandom.example.com/wiki/TestChar",
			CrawlTitle:   "TestChar",
		},
		Characters: []compose.Character{
			{
				ID:            1,
				Name:          "Elara Wynd",
				Epithet:       "The Crimson Lark",
				Tags:          []string{"half-elf", "bard", "mysterious"},
				Appearance:    "Auburn hair with crimson streaks, emerald eyes.",
				Personality:   "Cheerful on the surface but carries deep secrets.",
				Backstory:     "Once sang in taverns across the realm.",
				Abilities:     "Expert lute player, minor illusion magic.",
				Relationships: "Kethric — complicated history",
				Quotes:        []string{"The song must go on.", "Every note tells a story."},
				Stats: []compose.StatKV{
					{Key: "STR", Value: "8"},
					{Key: "DEX", Value: "16"},
					{Key: "CON", Value: "12"},
					{Key: "INT", Value: "14"},
					{Key: "WIS", Value: "13"},
					{Key: "CHA", Value: "15"},
				},
				Dirty: true,
			},
			{
				ID:            2,
				Name:          "Kethric Thorm",
				Epithet:       "The Tyrant",
				Tags:          []string{"human", "necromancer", "villain"},
				Appearance:    "Pale and imposing, ancient robes.",
				Personality:   "Calculating and merciless.",
				Backstory:     "Became undead centuries ago.",
				Abilities:     "Master of death magic, immortal.",
				Relationships: "Elara — his greatest mistake",
				Quotes:        []string{"Death is merely the beginning."},
				Stats:         []compose.StatKV{{Key: "INT", Value: "18"}},
				Dirty:         false,
			},
		},
		Prompts: prompts.Defaults(),
		Lorebook: []lorebook.Entry{
			{
				UID:     0,
				Comment: "Faction lore",
				Key:     []string{"Harpers", "Harper"},
				Content: "A secret society of bards and spies working for good.",
				Order:   100,
			},
			{
				UID:        1,
				Comment:    "Location",
				Key:        []string{"Elfsong Tavern", "Elfsong"},
				Content:    "A famous tavern in Baldur's Gate known for its bards.",
				Order:      80,
				Characters: []string{"1"}, // Elara
			},
			{
				UID:        2,
				Comment:    "Undead curse",
				Key:        []string{"Absolute", "Nethril"},
				Content:    "An ancient power that corrupts all who touch it.",
				Order:      60,
				Characters: []string{"2"}, // Kethric
			},
		},
		CrawlCache: &crawler.CrawlResult{
			Title:  "TestChar",
			URL:    "https://fandom.example.com/wiki/TestChar",
			Domain: "fandom.example.com",
			Infobox: []crawler.InfoboxEntry{
				{Key: "race", Value: "Half-elf"},
				{Key: "class", Value: "Bard"},
			},
			Sections: []crawler.Section{
				{Heading: "Appearance", Level: 2, Body: "Auburn hair with crimson streaks."},
				{Heading: "Background", Level: 2, Body: "Once sang in taverns across the realm."},
			},
		},
	}

	// Write the bundle to disk
	err := WriteBundle(filePath, original)
	require.NoError(t, err, "Failed to write bundle")

	// Read it back
	loaded, err := ReadBundle(filePath)
	require.NoError(t, err, "Failed to read bundle")

	// Assert manifest integrity
	assert.Equal(t, original.Manifest.Name, loaded.Manifest.Name)
	assert.Equal(t, original.Manifest.ActiveCharID, loaded.Manifest.ActiveCharID)
	assert.Equal(t, original.Manifest.SourceURL, loaded.Manifest.SourceURL)
	assert.Equal(t, original.Manifest.CrawlTitle, loaded.Manifest.CrawlTitle)

	// Assert characters integrity
	require.Len(t, loaded.Characters, 2)

	// Character 1: Elara
	assert.Equal(t, "Elara Wynd", loaded.Characters[0].Name)
	assert.Equal(t, "The Crimson Lark", loaded.Characters[0].Epithet)
	assert.Equal(t, []string{"half-elf", "bard", "mysterious"}, loaded.Characters[0].Tags)
	assert.Equal(t, "Auburn hair with crimson streaks, emerald eyes.", loaded.Characters[0].Appearance)
	assert.Equal(t, "Cheerful on the surface but carries deep secrets.", loaded.Characters[0].Personality)
	assert.Equal(t, "Expert lute player, minor illusion magic.", loaded.Characters[0].Abilities)
	assert.Len(t, loaded.Characters[0].Quotes, 2)
	assert.Equal(t, "The song must go on.", loaded.Characters[0].Quotes[0])
	assert.Len(t, loaded.Characters[0].Stats, 6)
	assert.Equal(t, "16", loaded.Characters[0].Stats[1].Value) // DEX

	// Character 2: Kethric
	assert.Equal(t, "Kethric Thorm", loaded.Characters[1].Name)
	assert.Equal(t, "The Tyrant", loaded.Characters[1].Epithet)
	assert.Equal(t, []string{"human", "necromancer", "villain"}, loaded.Characters[1].Tags)
	assert.Equal(t, "Calculating and merciless.", loaded.Characters[1].Personality)

	// Assert lorebook integrity
	require.Len(t, loaded.Lorebook, 3)
	assert.Equal(t, "Faction lore", loaded.Lorebook[0].Comment)
	assert.Equal(t, []string{"Harpers", "Harper"}, loaded.Lorebook[0].Key)
	assert.Equal(t, "A secret society of bards and spies working for good.", loaded.Lorebook[0].Content)
	assert.EqualValues(t, 100, loaded.Lorebook[0].Order)

	assert.Equal(t, "Location", loaded.Lorebook[1].Comment)
	assert.Equal(t, []string{"Elfsong Tavern", "Elfsong"}, loaded.Lorebook[1].Key)
	assert.Equal(t, []string{"1"}, loaded.Lorebook[1].Characters)

	// Assert crawl cache integrity
	require.NotNil(t, loaded.CrawlCache)
	assert.Equal(t, "TestChar", loaded.CrawlCache.Title)
	assert.Equal(t, "https://fandom.example.com/wiki/TestChar", loaded.CrawlCache.URL)
	assert.Len(t, loaded.CrawlCache.Sections, 2)
	assert.Equal(t, "Appearance", loaded.CrawlCache.Sections[0].Heading)

	// Assert prompts are preserved
	assert.NotNil(t, loaded.Prompts)
}

// TestBundleRoundTrip_EmptyProject verifies that an empty project
// (no characters, no lorebook) also round-trips correctly.
func TestBundleRoundTrip_EmptyProject(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "empty.slv")

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name:         "Empty Project",
			ActiveCharID: 0,
		},
		Characters: []compose.Character{},
		Prompts:    prompts.Defaults(),
		Lorebook:   []lorebook.Entry{},
		CrawlCache: nil,
	}

	err := WriteBundle(filePath, original)
	require.NoError(t, err)

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)

	assert.Equal(t, "Empty Project", loaded.Manifest.Name)
	assert.Len(t, loaded.Characters, 0)
	assert.Len(t, loaded.Lorebook, 0)
	assert.Nil(t, loaded.CrawlCache)
}

// TestCharacterExport verifies that characters are correctly exported
// to SillyTavern JSON format for use with the frontend.
func TestCharacterExport(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a fully-populated character
	char := compose.Character{
		ID:            1,
		Name:          "Test Hero",
		Epithet:       "The Bold",
		Tags:          []string{"human", "warrior", "noble"},
		Appearance:    "Tall, scarred, wears armor.",
		Personality:   "Brave but reckless.",
		Backstory:     "Rose from humble origins.",
		Abilities:     "Sword master, tactical genius.",
		Relationships: "Mentor — guides him; Rival — tests him",
		Quotes:        []string{"For glory!", "No retreat!"},
		Stats: []compose.StatKV{
			{Key: "STR", Value: "18"},
			{Key: "CON", Value: "16"},
		},
		Dirty: true,
	}

	// Export to SillyTavern JSON format
	jsonPath, err := compose.ExportSillyTavernCard(char, tmpDir)
	require.NoError(t, err, "Failed to export character")
	assert.NotEmpty(t, jsonPath, "Export should return a file path")
}
