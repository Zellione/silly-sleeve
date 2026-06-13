package library

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSyncAutoRegistersAndMarksMissing(t *testing.T) {
	base := t.TempDir()
	libDir := t.TempDir()

	// A real bundle file on disk in the library folder.
	present := filepath.Join(libDir, "Ciri.slv")
	require.NoError(t, os.WriteFile(present, []byte("zip"), 0o600))

	// Pre-existing index entry whose file does not exist.
	require.NoError(t, Save(base, Index{Entries: []Entry{
		{Path: filepath.Join(libDir, "Gone.slv"), Name: "Gone", Status: StatusReady},
	}}))

	idx, err := Sync(base, libDir)
	require.NoError(t, err)

	ciri := idx.Find(present)
	require.NotNil(t, ciri)
	assert.Equal(t, "Ciri", ciri.Name)
	assert.False(t, ciri.Missing)

	gone := idx.Find(filepath.Join(libDir, "Gone.slv"))
	require.NotNil(t, gone)
	assert.True(t, gone.Missing)
}

func TestSyncMissingLibraryDirIsOK(t *testing.T) {
	base := t.TempDir()
	idx, err := Sync(base, filepath.Join(base, "does-not-exist"))
	require.NoError(t, err)
	assert.Empty(t, idx.Entries)
}

func TestConfigDir(t *testing.T) {
	dir, err := ConfigDir()
	require.NoError(t, err)
	require.NotEmpty(t, dir)
	assert.Contains(t, dir, "silly-sleeve")
	// Verify directory exists and is accessible
	info, err := os.Stat(dir)
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}

func TestDefaultLibraryDir(t *testing.T) {
	dir, err := DefaultLibraryDir()
	require.NoError(t, err)
	require.NotEmpty(t, dir)
	assert.Contains(t, dir, "projects")
	// Verify directory exists
	info, err := os.Stat(dir)
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}
