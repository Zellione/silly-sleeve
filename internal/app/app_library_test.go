package app

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
)

func TestAppLibraryNilSafe(t *testing.T) {
	a := &App{} // no library wired
	list, err := a.ListProjects()
	require.NoError(t, err)
	assert.Empty(t, list)
	assert.NoError(t, a.SetProjectStatus("/x", "ready"))
	assert.NoError(t, a.RemoveProject("/x", false))
	assert.Nil(t, a.GetProjectThumbnail("/x"))
}

func TestAppNewProjectResets(t *testing.T) {
	a := &App{
		characters:      []compose.Character{{ID: 5, Name: "Old"}, {ID: 6}},
		activeCharID:    6,
		lorebookEntries: nil,
		projectImage:    []byte{1},
		projectDir:      "/some/path.slv",
	}
	a.NewProject("  Harper cell  ")
	require.Len(t, a.characters, 1)
	assert.Equal(t, 1, a.characters[0].ID)
	assert.Equal(t, "Untitled", a.characters[0].Name)
	assert.Equal(t, 1, a.activeCharID)
	assert.Empty(t, a.projectImage)
	assert.Equal(t, "", a.projectDir)
	assert.Equal(t, "Harper cell", a.GetProjectName())
}

func TestAppNewProjectEmptyNameStaysUnnamed(t *testing.T) {
	a := &App{projectName: "Old name"}
	a.NewProject("   ")
	assert.Equal(t, "", a.GetProjectName())
}

func TestAppNewProjectSavesBundleImmediately(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	a := NewApp()
	a.startup(context.Background())

	path, err := a.NewProject("Akame")
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(a.library.LibraryDir(), "Akame.slv"), path)
	assert.FileExists(t, path)
	assert.Equal(t, path, a.projectDir)

	list, err := a.ListProjects()
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "Akame", list[0].Name)
}

func TestAppNewProjectUniquifiesFilename(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	a := NewApp()
	a.startup(context.Background())

	first, err := a.NewProject("Akame")
	require.NoError(t, err)
	second, err := a.NewProject("Akame")
	require.NoError(t, err)

	assert.Equal(t, filepath.Join(a.library.LibraryDir(), "Akame-2.slv"), second)
	assert.FileExists(t, first)
	assert.FileExists(t, second)
}

func TestAppNewProjectEmptyNameUsesUntitled(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	a := NewApp()
	a.startup(context.Background())

	path, err := a.NewProject("   ")
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(a.library.LibraryDir(), "Untitled.slv"), path)
	assert.FileExists(t, path)
}

func TestAppNewProjectSanitizesFilename(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	a := NewApp()
	a.startup(context.Background())

	path, err := a.NewProject(`a/b\c:d*e?f"g<h>i|j`)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(a.library.LibraryDir(), "abcdefghij.slv"), path)
	assert.FileExists(t, path)
}

func TestAppNewProjectNilLibrarySkipsSave(t *testing.T) {
	a := &App{}
	path, err := a.NewProject("Akame")
	require.NoError(t, err)
	assert.Equal(t, "", path)
}

func TestAppListProjectsViaLibrary(t *testing.T) {
	lm := newTestLibrary(t) // from library_manager_test.go
	a := &App{library: lm}
	list, err := a.ListProjects()
	require.NoError(t, err)
	assert.Empty(t, list)
}
