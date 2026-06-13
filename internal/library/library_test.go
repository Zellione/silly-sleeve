package library

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadMissingReturnsEmpty(t *testing.T) {
	idx, err := Load(t.TempDir())
	require.NoError(t, err)
	assert.Empty(t, idx.Entries)
}

func TestSaveLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	idx := Index{Entries: []Entry{{Path: "/a.slv", Name: "A", Status: StatusDraft}}}
	require.NoError(t, Save(dir, idx))
	got, err := Load(dir)
	require.NoError(t, err)
	require.Len(t, got.Entries, 1)
	assert.Equal(t, "A", got.Entries[0].Name)
}

func TestUpsertReplaces(t *testing.T) {
	idx := Index{}
	idx.Upsert(Entry{Path: "/a.slv", Name: "A"})
	idx.Upsert(Entry{Path: "/a.slv", Name: "A2"})
	require.Len(t, idx.Entries, 1)
	assert.Equal(t, "A2", idx.Entries[0].Name)
}

func TestRemoveAndSetStatus(t *testing.T) {
	idx := Index{Entries: []Entry{{Path: "/a.slv", Status: StatusDraft}}}
	assert.True(t, idx.SetStatus("/a.slv", StatusReady))
	assert.Equal(t, StatusReady, idx.Entries[0].Status)
	assert.False(t, idx.SetStatus("/missing.slv", StatusReady))
	assert.True(t, idx.Remove("/a.slv"))
	assert.False(t, idx.Remove("/a.slv"))
}

func TestValidStatus(t *testing.T) {
	assert.True(t, ValidStatus(StatusArchived))
	assert.False(t, ValidStatus("bogus"))
}

func TestLoadCorruptErrors(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, writeFile(filepath.Join(dir, indexFile), "{not json"))
	_, err := Load(dir)
	assert.Error(t, err)
}

func writeFile(path, content string) error {
	return os.WriteFile(path, []byte(content), 0o600)
}
