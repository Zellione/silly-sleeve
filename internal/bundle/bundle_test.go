package bundle

import (
	"os"
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

func TestWriteReadRoundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test.slv")

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name:         "Test Project",
			ActiveCharID: 1,
			SourceURL:    "https://example.com/wiki/Test",
			CrawlTitle:   "Test Character",
		},
		Characters: []compose.Character{
			{ID: 1, Name: "Elara", Epithet: "Crimson Lark", Tags: []string{"half-elf", "bard"}, Personality: "cheerful"},
			{ID: 2, Name: "Kethric", Tags: []string{}, Quotes: []string{}, Stats: []compose.StatKV{}},
		},
		Prompts: prompts.Defaults(),
		Lorebook: []lorebook.Entry{
			{UID: 0, Comment: "Faction info", Key: []string{"Harpers"}, Content: "secret network", Order: 100},
			{UID: 1, Comment: "Location", Key: []string{"Elfsong"}, Content: "tavern", Order: 80},
		},
		CrawlCache: &crawler.CrawlResult{
			Title:  "Test Character",
			URL:    "https://example.com/wiki/Test",
			Domain: "example.com",
		},
	}

	err := WriteBundle(filePath, original)
	require.NoError(t, err)

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)

	assert.Equal(t, original.Manifest.Name, loaded.Manifest.Name)
	assert.Equal(t, original.Manifest.ActiveCharID, loaded.Manifest.ActiveCharID)
	assert.Equal(t, original.Manifest.SourceURL, loaded.Manifest.SourceURL)
	assert.Equal(t, original.Manifest.CrawlTitle, loaded.Manifest.CrawlTitle)

	assert.Len(t, loaded.Characters, 2)
	assert.Equal(t, "Elara", loaded.Characters[0].Name)
	assert.Equal(t, "Crimson Lark", loaded.Characters[0].Epithet)
	assert.Equal(t, []string{"half-elf", "bard"}, loaded.Characters[0].Tags)
	assert.Equal(t, "cheerful", loaded.Characters[0].Personality)

	assert.Equal(t, "Kethric", loaded.Characters[1].Name)

	assert.NotEmpty(t, loaded.Prompts.SystemPrompt)
	assert.Len(t, loaded.Prompts.FieldPrompts, len(prompts.FieldIDs()))

	assert.Len(t, loaded.Lorebook, 2)
	assert.Equal(t, "Faction info", loaded.Lorebook[0].Comment)
	assert.Equal(t, []string{"Harpers"}, loaded.Lorebook[0].Key)
	assert.Equal(t, 100, loaded.Lorebook[0].Order)

	require.NotNil(t, loaded.CrawlCache)
	assert.Equal(t, "Test Character", loaded.CrawlCache.Title)
}

func TestWriteBundle_NoCrawlCache(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "nocrawl.slv")

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name: "No Crawl",
		},
		Characters: []compose.Character{
			{ID: 1, Name: "Test"},
		},
		Prompts: prompts.Defaults(),
	}

	err := WriteBundle(filePath, original)
	require.NoError(t, err)

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)
	assert.Nil(t, loaded.CrawlCache)
}

func TestReadBundle_MissingManifest(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "bad.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	f.Close()

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
}

func TestWriteBundle_EmptyBundle(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "empty.slv")

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name: "Empty",
		},
		Prompts: prompts.Defaults(),
	}

	err := WriteBundle(filePath, original)
	require.NoError(t, err)

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Empty", loaded.Manifest.Name)
	assert.Empty(t, loaded.Characters)
	assert.Nil(t, loaded.CrawlCache)
}

func TestReadBundle_NotFound(t *testing.T) {
	_, err := ReadBundle("/nonexistent/file.slv")
	assert.Error(t, err)
}

func TestSanitizeCharacter_EmptyArrays(t *testing.T) {
	ch := compose.Character{ID: 1, Name: "Test"}
	result := sanitizeCharacter(ch)
	assert.Equal(t, []string{}, result.Tags)
	assert.Equal(t, []string{}, result.Quotes)
	assert.Equal(t, []compose.StatKV{}, result.Stats)
}

func TestIsCharacterFile(t *testing.T) {
	assert.True(t, isCharacterFile("characters/1.json"))
	assert.True(t, isCharacterFile("characters/99.json"))
	assert.False(t, isCharacterFile("manifest.json"))
	assert.False(t, isCharacterFile("characters/1.txt"))
	assert.False(t, isCharacterFile("char/1.json"))
}
