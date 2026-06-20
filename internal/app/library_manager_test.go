package app

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/project"
)

func newTestLibrary(t *testing.T) *LibraryManager {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp) // Linux/CI: os.UserConfigDir honors this
	lm, err := NewLibraryManager()
	require.NoError(t, err)
	return lm
}

func TestLibraryRegisterAndList(t *testing.T) {
	lm := newTestLibrary(t)
	path := filepath.Join(lm.LibraryDir(), "Ciri.slv")
	require.NoError(t, os.WriteFile(path, []byte("zip"), 0o600))

	m := project.ProjectManifest{
		Name: "Ciri", Status: "ready", Tags: []string{"witcher"},
		SourceURL: "https://witcher.fandom.com/wiki/Ciri", UpdatedAt: "2026-06-13",
		ProjectImage: []byte{1, 2, 3},
	}
	active := compose.Character{ID: 1, Name: "Ciri", Appearance: "ashen hair"}
	require.NoError(t, lm.Register(path, m, active))

	list, err := lm.List()
	require.NoError(t, err)
	require.Len(t, list, 1)
	e := list[0]
	assert.Equal(t, "Ciri", e.Name)
	assert.Equal(t, "ready", e.Status)
	assert.Equal(t, "witcher · wiki", e.SourceShort)
	assert.True(t, e.HasThumbnail)
	assert.Equal(t, []byte{1, 2, 3}, lm.Thumbnail(path))
	assert.Greater(t, e.Tokens, 0)
}

func TestLibrarySetStatusAndRemove(t *testing.T) {
	lm := newTestLibrary(t)
	path := filepath.Join(lm.LibraryDir(), "X.slv")
	require.NoError(t, os.WriteFile(path, []byte("zip"), 0o600))
	require.NoError(t, lm.Register(path, project.ProjectManifest{Name: "X"}, compose.Character{ID: 1}))

	require.NoError(t, lm.SetStatus(path, "archived"))
	assert.Error(t, lm.SetStatus(path, "bogus"))
	assert.Error(t, lm.SetStatus(filepath.Join(lm.LibraryDir(), "nope.slv"), "ready"))

	require.NoError(t, lm.Remove(path, true))
	_, statErr := os.Stat(path)
	assert.True(t, os.IsNotExist(statErr))
	list, err := lm.List()
	require.NoError(t, err)
	assert.Empty(t, list)
}
