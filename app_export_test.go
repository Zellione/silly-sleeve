package main

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/cardexport"
	"silly-sleeve/internal/lorebook"
)

func testPNGBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 200, A: 255})
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func appWithChars(t *testing.T) *App {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	app := NewApp()
	app.startup(context.Background())
	app.characters = []compose.Character{
		{ID: 1, Name: "Alice", Personality: "Brave.", Appearance: "Tall.", Portrait: testPNGBytes(t)},
		{ID: 2, Name: "Bob", Personality: "Calm.", Appearance: "Short."},
	}
	app.lorebookEntries = []lorebook.Entry{
		{UID: 0, Comment: "World", Key: []string{"world"}, Content: "A place.", Order: 100},
	}
	return app
}

func TestExportCharacterPNG(t *testing.T) {
	app := appWithChars(t)
	dir := t.TempDir()

	path, err := app.ExportCharacterPNG(1, "v3", cardexport.Options{EmbedLorebook: true, IncludeGreetings: true}, dir)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(dir, "alice.png"), path)

	data, err := os.ReadFile(path)
	require.NoError(t, err)
	chunks, err := cardexport.ReadTextChunks(data)
	require.NoError(t, err)
	assert.Contains(t, chunks, "chara")
	assert.Contains(t, chunks, "ccv3")
}

func TestExportCharacterPNG_NotFound(t *testing.T) {
	app := appWithChars(t)
	_, err := app.ExportCharacterPNG(999, "v2", cardexport.Options{}, t.TempDir())
	assert.Error(t, err)
}

func TestExportCharactersBulk_PNG(t *testing.T) {
	app := appWithChars(t)
	dir := t.TempDir()

	res, err := app.ExportCharactersBulk([]int{1, 2}, "png-v2", cardexport.Options{}, dir)
	require.NoError(t, err)
	assert.Equal(t, 2, res.Exported)
	assert.Equal(t, 0, res.Failed)
	assert.Len(t, res.Paths, 2)

	for _, p := range res.Paths {
		_, err := os.Stat(p)
		assert.NoError(t, err)
	}
}

func TestExportCharactersBulk_JSON(t *testing.T) {
	app := appWithChars(t)
	dir := t.TempDir()

	res, err := app.ExportCharactersBulk([]int{1}, "json", cardexport.Options{}, dir)
	require.NoError(t, err)
	assert.Equal(t, 1, res.Exported)
	assert.Contains(t, res.Paths[0], ".json")
}

func TestExportCharactersBulk_PartialFailure(t *testing.T) {
	app := appWithChars(t)
	res, err := app.ExportCharactersBulk([]int{1, 999}, "png-v2", cardexport.Options{}, t.TempDir())
	require.NoError(t, err)
	assert.Equal(t, 1, res.Exported)
	assert.Equal(t, 1, res.Failed)
}

func TestExportCharactersBulk_UnknownFormat(t *testing.T) {
	app := appWithChars(t)
	res, err := app.ExportCharactersBulk([]int{1}, "bogus", cardexport.Options{}, t.TempDir())
	require.NoError(t, err)
	assert.Equal(t, 0, res.Exported)
	assert.Equal(t, 1, res.Failed)
}
