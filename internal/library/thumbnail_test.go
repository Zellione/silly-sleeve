package library

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestThumbnailRoundTrip(t *testing.T) {
	dir := t.TempDir()
	ref, err := WriteThumbnail(dir, "/p/a.slv", []byte{1, 2, 3})
	require.NoError(t, err)
	assert.Equal(t, ThumbRef("/p/a.slv"), ref)
	assert.Equal(t, []byte{1, 2, 3}, ReadThumbnail(dir, ref))
	DeleteThumbnail(dir, ref)
	assert.Nil(t, ReadThumbnail(dir, ref))
}

func TestWriteThumbnailEmpty(t *testing.T) {
	ref, err := WriteThumbnail(t.TempDir(), "/p/a.slv", nil)
	require.NoError(t, err)
	assert.Equal(t, "", ref)
}

func TestReadThumbnailMissing(t *testing.T) {
	assert.Nil(t, ReadThumbnail(t.TempDir(), "nope.png"))
	assert.Nil(t, ReadThumbnail(t.TempDir(), ""))
}

func TestDeleteThumbnailEmpty(t *testing.T) {
	// Should not panic on empty ref
	DeleteThumbnail(t.TempDir(), "")
}

func TestWriteThumbnailCreatesDir(t *testing.T) {
	dir := t.TempDir()
	subdir := filepath.Join(dir, "sub", "nested")
	ref, err := WriteThumbnail(subdir, "/p/test.slv", []byte{42})
	require.NoError(t, err)
	assert.NotEmpty(t, ref)
	// Verify we can read it back
	assert.Equal(t, []byte{42}, ReadThumbnail(subdir, ref))
}

func TestThumbRefConsistent(t *testing.T) {
	// Same path should produce same ref
	ref1 := ThumbRef("/path/to/project.slv")
	ref2 := ThumbRef("/path/to/project.slv")
	assert.Equal(t, ref1, ref2)
	// Different path should produce different ref
	ref3 := ThumbRef("/different/path.slv")
	assert.NotEqual(t, ref1, ref3)
}

func TestDeleteThumbnailMissing(t *testing.T) {
	// Should not error on missing file
	DeleteThumbnail(t.TempDir(), "nonexistent.png")
}
