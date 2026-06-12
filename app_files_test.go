package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeTempPNG(t *testing.T, name string) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 3, 3))
	img.Set(0, 0, color.RGBA{R: 10, G: 20, B: 30, A: 255})
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	path := filepath.Join(t.TempDir(), name)
	require.NoError(t, os.WriteFile(path, buf.Bytes(), 0o644))
	return path
}

func TestReadImageFile(t *testing.T) {
	app := NewApp()
	path := writeTempPNG(t, "portrait.png")

	got, err := app.ReadImageFile(path)
	require.NoError(t, err)
	assert.Equal(t, "portrait.png", got.Name)
	assert.Positive(t, got.Size)
	assert.True(t, strings.HasPrefix(got.DataURL, "data:image/png;base64,"), "got %q", got.DataURL[:30])
}

func TestReadImageFile_NotImage(t *testing.T) {
	app := NewApp()
	path := filepath.Join(t.TempDir(), "notes.txt")
	require.NoError(t, os.WriteFile(path, []byte("just some text, definitely not an image"), 0o644))

	_, err := app.ReadImageFile(path)
	assert.Error(t, err)
}

func TestReadImageFile_Missing(t *testing.T) {
	app := NewApp()
	_, err := app.ReadImageFile(filepath.Join(t.TempDir(), "nope.png"))
	assert.Error(t, err)
}
