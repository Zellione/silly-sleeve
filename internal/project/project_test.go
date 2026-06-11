package project

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
)

func TestSaveProject_FilePermissions(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix file mode bits not meaningful on Windows")
	}
	dir := t.TempDir()
	require.NoError(t, SaveProject(dir, sampleManifest(), sampleCharacters()))

	mInfo, err := os.Stat(filepath.Join(dir, manifestFile))
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), mInfo.Mode().Perm(), "manifest")

	cInfo, err := os.Stat(filepath.Join(dir, charsDir, chFileName(1)))
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), cInfo.Mode().Perm(), "character file")
}

func sampleManifest() ProjectManifest {
	return ProjectManifest{
		Version:      ManifestVersion,
		Name:         "Test Project",
		ActiveCharID: 1,
		SourceURL:    "https://test.wiki/Test",
		CrawlTitle:   "Test_Page",
	}
}

func sampleCharacters() []compose.Character {
	return []compose.Character{
		{ID: 1, Name: "Alice", Epithet: "The Brave", Tags: []string{"hero"}},
		{ID: 2, Name: "Bob", Personality: "Friendly"},
	}
}

func TestSaveProject(t *testing.T) {
	dir := t.TempDir()
	m := sampleManifest()
	chars := sampleCharacters()

	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	// verify manifest
	mPath := filepath.Join(dir, manifestFile)
	_, err = os.Stat(mPath)
	require.NoError(t, err)

	// verify character files
	for _, ch := range chars {
		cPath := filepath.Join(dir, charsDir, chFileName(ch.ID))
		_, err = os.Stat(cPath)
		require.NoError(t, err, "character file %s should exist", cPath)
	}
}

func TestSaveProject_DefaultVersion(t *testing.T) {
	dir := t.TempDir()
	m := ProjectManifest{Name: "NoVersion"}
	chars := sampleCharacters()

	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	loaded, _, err := LoadProject(dir)
	require.NoError(t, err)
	assert.Equal(t, ManifestVersion, loaded.Version)
}

func TestSaveProject_SetsTimestamps(t *testing.T) {
	dir := t.TempDir()
	m := ProjectManifest{Name: "Timestamp"}
	chars := sampleCharacters()

	before := time.Now().UTC()
	err := SaveProject(dir, m, chars)
	require.NoError(t, err)
	after := time.Now().UTC()

	loaded, _, err := LoadProject(dir)
	require.NoError(t, err)
	assert.NotEmpty(t, loaded.CreatedAt)
	assert.NotEmpty(t, loaded.UpdatedAt)
	createdAt, err := time.Parse(time.RFC3339, loaded.CreatedAt)
	require.NoError(t, err)
	assert.True(t, createdAt.Before(after.Add(time.Second)))
	assert.True(t, createdAt.After(before.Add(-time.Second)))
}

func TestSaveProject_PreservesCreatedAt(t *testing.T) {
	dir := t.TempDir()
	fixed := "2024-01-15T12:00:00Z"
	m := ProjectManifest{Name: "Preserve", CreatedAt: fixed}
	chars := sampleCharacters()

	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	loaded, _, err := LoadProject(dir)
	require.NoError(t, err)
	assert.Equal(t, fixed, loaded.CreatedAt)
	assert.NotEqual(t, fixed, loaded.UpdatedAt)
}

func TestLoadProject(t *testing.T) {
	dir := t.TempDir()
	m := sampleManifest()
	m.CreatedAt = "2024-01-01T00:00:00Z"
	chars := sampleCharacters()

	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	loaded, loadedChars, err := LoadProject(dir)
	require.NoError(t, err)
	assert.Equal(t, m.Name, loaded.Name)
	assert.Equal(t, m.ActiveCharID, loaded.ActiveCharID)
	assert.Equal(t, m.SourceURL, loaded.SourceURL)
	assert.Equal(t, m.CrawlTitle, loaded.CrawlTitle)
	assert.Equal(t, m.Version, loaded.Version)
	assert.Equal(t, m.CreatedAt, loaded.CreatedAt)
	assert.NotZero(t, loaded.UpdatedAt)

	require.Len(t, loadedChars, 2)
	assert.Equal(t, "Alice", loadedChars[0].Name)
	assert.Equal(t, "Bob", loadedChars[1].Name)
}

func TestLoadProject_CharactersSortedByID(t *testing.T) {
	dir := t.TempDir()
	m := sampleManifest()
	chars := []compose.Character{
		{ID: 5, Name: "Fifth"},
		{ID: 1, Name: "First"},
		{ID: 3, Name: "Third"},
	}

	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	_, loaded, err := LoadProject(dir)
	require.NoError(t, err)
	require.Len(t, loaded, 3)
	assert.Equal(t, 1, loaded[0].ID)
	assert.Equal(t, 3, loaded[1].ID)
	assert.Equal(t, 5, loaded[2].ID)
}

func TestLoadProject_MissingManifest(t *testing.T) {
	dir := t.TempDir()
	_, _, err := LoadProject(dir)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "read manifest")
}

func TestLoadProject_MissingCharactersDir(t *testing.T) {
	dir := t.TempDir()
	m := sampleManifest()
	chars := sampleCharacters()
	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	os.RemoveAll(filepath.Join(dir, charsDir))

	_, _, err = LoadProject(dir)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "characters dir")
}

func TestLoadProject_EmptyCharactersDir(t *testing.T) {
	dir := t.TempDir()
	m := sampleManifest()
	chars := []compose.Character{}
	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	_, loaded, err := LoadProject(dir)
	require.NoError(t, err)
	assert.Len(t, loaded, 0)
}

func TestLoadProject_IgnoresNonJSON(t *testing.T) {
	dir := t.TempDir()
	m := sampleManifest()
	chars := sampleCharacters()

	err := SaveProject(dir, m, chars)
	require.NoError(t, err)

	// write a non-JSON file
	err = os.WriteFile(filepath.Join(dir, charsDir, "notes.txt"), []byte("hello"), 0o644)
	require.NoError(t, err)

	_, loaded, err := LoadProject(dir)
	require.NoError(t, err)
	assert.Len(t, loaded, 2)
}

func TestSaveProject_PermissionsError(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("skipping permission test as root")
	}
	dir := filepath.Join(t.TempDir(), "readonly")
	require.NoError(t, os.Mkdir(dir, 0o555))
	m := sampleManifest()
	err := SaveProject(dir, m, nil)
	assert.Error(t, err)
}

func TestParseCharID_Valid(t *testing.T) {
	id, err := ParseCharID("1.json")
	require.NoError(t, err)
	assert.Equal(t, 1, id)

	id, err = ParseCharID("42.json")
	require.NoError(t, err)
	assert.Equal(t, 42, id)
}

func TestParseCharID_Invalid(t *testing.T) {
	_, err := ParseCharID("abc.json")
	assert.Error(t, err)
}

func chFileName(id int) string {
	return itoa(id) + ".json"
}

func itoa(n int) string {
	s := ""
	if n == 0 {
		return "0"
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
