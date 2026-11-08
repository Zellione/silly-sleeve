package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"silly-sleeve/internal/bundle"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newStoreTestApp builds an App with a fresh temp config dir, so the managed
// store (projects/, exports/, uploads/) is isolated per test.
func newStoreTestApp(t *testing.T) (*App, string) {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp)
	a := NewApp()
	a.Startup(context.Background())
	require.NotNil(t, a.library)
	return a, tmp
}

func TestSaveProjectAsName_SavesIntoManagedFolder(t *testing.T) {
	a, tmp := newStoreTestApp(t)
	a.characters[0].Name = "Elara"

	path, err := a.SaveProjectAsName("Elara Project")
	require.NoError(t, err)
	require.Contains(t, path, filepath.Join("projects", "Elara Project.slv"))
	require.FileExists(t, path)

	// The bundle round-trips through the reader.
	m, err := bundle.ReadManifest(path)
	require.NoError(t, err)
	assert.Equal(t, "Elara Project", m.Name)
	assert.Contains(t, path, tmp)
}

func TestSaveProjectAsName_SequencesDuplicateNames(t *testing.T) {
	a, _ := newStoreTestApp(t)

	first, err := a.SaveProjectAsName("Same")
	require.NoError(t, err)
	second, err := a.SaveProjectAsName("Same")
	require.NoError(t, err)

	assert.NotEqual(t, first, second)
	assert.Contains(t, second, "Same-2.slv")
}

func TestSaveProjectAsName_NoLibrary(t *testing.T) {
	a := NewApp()
	_, err := a.SaveProjectAsName("x")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unavailable")
}

func TestGetExportDir_CreatesManagedExportsFolder(t *testing.T) {
	a, tmp := newStoreTestApp(t)

	dir, err := a.GetExportDir()
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(tmp, "silly-sleeve", "exports"), dir)
	info, err := os.Stat(dir)
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}

func TestImportCardData(t *testing.T) {
	a, _ := newStoreTestApp(t)

	// A minimal SillyTavern V2 JSON card.
	card := []byte(`{
		"spec": "chara_card_v2",
		"spec_version": "2.0",
		"data": {
			"name": "Imported",
			"description": "A test character.",
			"personality": "Calm."
		}
	}`)

	res, err := a.ImportCardData(card)
	require.NoError(t, err)
	assert.Equal(t, "Imported", res.Character.Name)
	assert.NotZero(t, res.Character.ID)
	assert.Equal(t, 0, res.ImportedEntries)

	chars := a.GetCharacters()
	last := chars[len(chars)-1]
	assert.Equal(t, res.Character.ID, last.ID)
}

func TestImportCardData_Invalid(t *testing.T) {
	a, _ := newStoreTestApp(t)
	_, err := a.ImportCardData([]byte("not a card at all"))
	require.Error(t, err)
}

func TestImportLorebookData(t *testing.T) {
	a, _ := newStoreTestApp(t)

	data := []byte(`{
		"entries": [
			{
				"key": ["Aldencrest"],
				"content": "A coastal city.",
				"comment": ""
			}
		]
	}`)

	entries, err := a.ImportLorebookData(data)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	require.NotEmpty(t, entries[0].Key)
	assert.Equal(t, "Aldencrest", entries[0].Key[0])

	// Parse only: app state is untouched.
	assert.Empty(t, a.GetLorebook())
}

func TestImportLorebookData_Invalid(t *testing.T) {
	a, _ := newStoreTestApp(t)
	_, err := a.ImportLorebookData([]byte("{nope"))
	require.Error(t, err)
}
