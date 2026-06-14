package bundle

import (
	"archive/zip"
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

func TestWriteBundle_PathIsDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	err := WriteBundle(tmpDir, Bundle{Manifest: project.ProjectManifest{Name: "Test"}, Prompts: prompts.Defaults()})
	assert.Error(t, err)
}

func TestReadBundle_NotAZip(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "notazip.slv")
	require.NoError(t, os.WriteFile(filePath, []byte("hello"), 0o644))

	_, err := ReadBundle(filePath)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "open bundle")
}

func TestReadBundle_CorruptZip(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "corrupt.slv")
	// Write 4 bytes of zip magic but nothing else
	require.NoError(t, os.WriteFile(filePath, []byte("PK\x03\x04"), 0o644))

	_, err := ReadBundle(filePath)
	assert.Error(t, err)
}

func TestReadBundle_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badjson.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)
	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name": "Test",`))
	require.NoError(t, err)
	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
}

func TestReadBundle_InvalidCharacterJSON(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badchar.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)

	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name":"Test","activeCharId":1}`))
	require.NoError(t, err)

	w2, err := zw.Create("characters/1.json")
	require.NoError(t, err)
	_, err = w2.Write([]byte(`{invalid`))
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "read character")
}

func TestReadBundle_InvalidLorebookJSON(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badlore.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)

	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name":"Test"}`))
	require.NoError(t, err)

	w2, err := zw.Create("lorebook.json")
	require.NoError(t, err)
	_, err = w2.Write([]byte(`{bad`))
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
}

func TestReadBundle_InvalidCrawlCacheJSON(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badcrawl.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)

	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name":"Test"}`))
	require.NoError(t, err)

	w2, err := zw.Create("crawl_cache.json")
	require.NoError(t, err)
	_, err = w2.Write([]byte(`{bad`))
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
}

func TestReadBundle_InvalidPromptsJSON(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badprompts.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)

	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name":"Test"}`))
	require.NoError(t, err)

	w2, err := zw.Create("prompts.json")
	require.NoError(t, err)
	_, err = w2.Write([]byte(`{bad`))
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
}

func TestReadBundle_InvalidJSON_UnmarshalTypeError(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badtype.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)

	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name": "Test"}`))
	require.NoError(t, err)

	w2, err := zw.Create("crawl_cache.json")
	require.NoError(t, err)
	_, err = w2.Write([]byte(`"not an object"`))
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
}

func TestWriteBundle_UnencodableValue_WriteJSON(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "badenc.slv")

	b := Bundle{
		Manifest: project.ProjectManifest{Name: "Test"},
		Characters: []compose.Character{
			{ID: 1, Name: "Bad", Tags: []string{"tag"}, Quotes: []string{"q"}, Stats: []compose.StatKV{{Key: "k", Value: "v"}}},
		},
		Prompts: prompts.Defaults(),
	}
	err := WriteBundle(filePath, b)
	require.NoError(t, err)

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)
	assert.Len(t, loaded.Characters, 1)
}

func TestWriteBundle_SanitizeCharacterEmptyArrays(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "sanitize.slv")
	b := Bundle{
		Manifest: project.ProjectManifest{Name: "Test"},
		Characters: []compose.Character{
			{ID: 1, Name: "E", Tags: nil, Quotes: nil, Stats: nil},
		},
		Prompts: prompts.Defaults(),
	}
	require.NoError(t, WriteBundle(filePath, b))

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)
	assert.Len(t, loaded.Characters, 1)
	assert.Equal(t, []string{}, loaded.Characters[0].Tags)
	assert.Equal(t, []string{}, loaded.Characters[0].Quotes)
	assert.Equal(t, []compose.StatKV{}, loaded.Characters[0].Stats)
}

func TestWriteBundle_MultipleCharacters(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "multi.slv")
	b := Bundle{
		Manifest: project.ProjectManifest{Name: "Multi", ActiveCharID: 2},
		Characters: []compose.Character{
			{ID: 1, Name: "Alpha"},
			{ID: 0, Name: "ZeroID"},
			{ID: 3, Name: "Gamma"},
		},
		Prompts: prompts.Defaults(),
	}
	require.NoError(t, WriteBundle(filePath, b))

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)
	assert.Len(t, loaded.Characters, 3)
	assert.Equal(t, "Gamma", loaded.Characters[2].Name)
}

func TestReadBundle_FileNotFound(t *testing.T) {
	_, err := ReadBundle(filepath.Join(t.TempDir(), "nonexistent.slv"))
	assert.Error(t, err)
}

func TestReadBundle_EmptyZip(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "empty.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)
	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	_, err = ReadBundle(filePath)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no manifest.json")
}

func TestReadBundle_UnknownFileIgnored(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "unknownfile.slv")

	f, err := os.Create(filePath)
	require.NoError(t, err)
	zw := zip.NewWriter(f)

	w, err := zw.Create("manifest.json")
	require.NoError(t, err)
	_, err = w.Write([]byte(`{"name":"Test"}`))
	require.NoError(t, err)

	w2, err := zw.Create(".gitkeep")
	require.NoError(t, err)
	_, err = w2.Write([]byte(`ignored`))
	require.NoError(t, err)

	require.NoError(t, zw.Close())
	require.NoError(t, f.Close())

	b, err := ReadBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Test", b.Manifest.Name)
}

func TestWriteReadRoundtrip_WithImages(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "withimages.slv")

	portrait1 := []byte{0x89, 0x50, 0x4E, 0x47, 0x01} // partial PNG header
	portrait2 := []byte("mock-image-data")
	projectImg := []byte{0x89, 0x50, 0x4E, 0x47, 0x02}

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name:         "Test Project",
			ActiveCharID: 1,
			ProjectImage: projectImg,
		},
		Characters: []compose.Character{
			{ID: 1, Name: "Elara", Portrait: portrait1},
			{ID: 2, Name: "Kethric", Portrait: portrait2},
			{ID: 3, Name: "NoPortrait"},
		},
		Prompts: prompts.Defaults(),
	}

	err := WriteBundle(filePath, original)
	require.NoError(t, err)

	loaded, err := ReadBundle(filePath)
	require.NoError(t, err)

	assert.Equal(t, projectImg, loaded.Manifest.ProjectImage)
	assert.Equal(t, portrait1, loaded.Characters[0].Portrait)
	assert.Equal(t, portrait2, loaded.Characters[1].Portrait)
	assert.Nil(t, loaded.Characters[2].Portrait)
}

func TestWriteReadRoundtrip_NoImages(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "noimages.slv")

	original := Bundle{
		Manifest: project.ProjectManifest{
			Name: "No Images",
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

	assert.Nil(t, loaded.Manifest.ProjectImage)
	assert.Nil(t, loaded.Characters[0].Portrait)
}

func TestIsPortraitFile(t *testing.T) {
	assert.True(t, isPortraitFile("images/portrait_1.png"))
	assert.True(t, isPortraitFile("images/portrait_99.png"))
	assert.False(t, isPortraitFile("images/project.png"))
	assert.False(t, isPortraitFile("images/portrait_1.json"))
	assert.False(t, isPortraitFile("characters/1.json"))
}

func TestPortraitIDFromName(t *testing.T) {
	id, err := portraitIDFromName("images/portrait_1.png")
	require.NoError(t, err)
	assert.Equal(t, 1, id)

	id, err = portraitIDFromName("images/portrait_42.png")
	require.NoError(t, err)
	assert.Equal(t, 42, id)

	_, err = portraitIDFromName("images/portrait_.png")
	assert.Error(t, err)

	_, err = portraitIDFromName("images/project.png")
	assert.Error(t, err)
}

func TestBundle_CrawlSetRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "p.slv")
	set := &crawler.CrawlSet{RootURL: "https://w/wiki/A", Results: []crawler.CrawlResult{{URL: "https://w/wiki/A", Title: "A"}}}
	assert.NoError(t, WriteBundle(path, Bundle{
		Manifest:   project.ProjectManifest{Name: "P"},
		Characters: []compose.Character{compose.NewCharacter(1)},
		CrawlSet:   set,
	}))
	b, err := ReadBundle(path)
	assert.NoError(t, err)
	assert.NotNil(t, b.CrawlSet)
	assert.Equal(t, "A", b.CrawlSet.Results[0].Title)
}

func TestBundle_LegacyCrawlCacheUpgrades(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "legacy.slv")
	assert.NoError(t, WriteBundle(path, Bundle{
		Manifest:   project.ProjectManifest{Name: "P"},
		Characters: []compose.Character{compose.NewCharacter(1)},
		CrawlCache: &crawler.CrawlResult{URL: "https://w/wiki/Old", Title: "Old"},
	}))
	b, err := ReadBundle(path)
	assert.NoError(t, err)
	assert.NotNil(t, b.CrawlSet)
	assert.Equal(t, "Old", b.CrawlSet.Results[0].Title)
}
