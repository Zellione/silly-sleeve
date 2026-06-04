package lorebook

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEntry(t *testing.T) {
	e := NewEntry(5)
	assert.Equal(t, 5, e.UID)
	assert.Equal(t, "New entry", e.Comment)
	assert.True(t, e.AddMemo)
	assert.Equal(t, 100, e.Order)
	assert.Equal(t, 100, e.Probability)
	assert.True(t, e.UseProbability)
}

func TestNextUID(t *testing.T) {
	assert.Equal(t, 0, NextUID(nil))
	assert.Equal(t, 0, NextUID([]Entry{}))

	entries := []Entry{
		{UID: 3},
		{UID: 7},
		{UID: 2},
	}
	assert.Equal(t, 8, NextUID(entries))
}

func TestExportWorldInfo(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "world_info.json")

	entries := []Entry{
		{UID: 0, Comment: "Test entry", Key: []string{"trigger1"}, Content: "content"},
		{UID: 1, Comment: "Second", Key: []string{"trigger2"}, Content: "more"},
	}

	err := ExportWorldInfo(entries, filePath)
	require.NoError(t, err)

	data, err := os.ReadFile(filePath)
	require.NoError(t, err)

	content := string(data)
	assert.Contains(t, content, `"entries"`)
	assert.Contains(t, content, `"0"`)
	assert.Contains(t, content, `"1"`)
	assert.Contains(t, content, `"trigger1"`)
	assert.Contains(t, content, `"content"`)
}

func TestExportWorldInfo_Empty(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "empty_world_info.json")

	err := ExportWorldInfo(nil, filePath)
	require.NoError(t, err)

	data, err := os.ReadFile(filePath)
	require.NoError(t, err)

	assert.Contains(t, string(data), `"entries"`)
	assert.Contains(t, string(data), "{}")
}
