package main

import (
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
	a.NewProject()
	require.Len(t, a.characters, 1)
	assert.Equal(t, 1, a.characters[0].ID)
	assert.Equal(t, "Untitled", a.characters[0].Name)
	assert.Equal(t, 1, a.activeCharID)
	assert.Empty(t, a.projectImage)
	assert.Equal(t, "", a.projectDir)
}

func TestAppListProjectsViaLibrary(t *testing.T) {
	lm := newTestLibrary(t) // from library_manager_test.go
	a := &App{library: lm}
	list, err := a.ListProjects()
	require.NoError(t, err)
	assert.Empty(t, list)
}
