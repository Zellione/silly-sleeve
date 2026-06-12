package cardexport

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
)

func charWithPortrait(t *testing.T) compose.Character {
	t.Helper()
	ch := sampleChar()
	ch.Portrait = makePNG(t)
	return ch
}

// embeddedCard decodes a base64 tEXt payload back into a generic card map.
func embeddedCard(t *testing.T, payload string) map[string]any {
	t.Helper()
	raw, err := base64.StdEncoding.DecodeString(payload)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	return m
}

func TestBuildCharacterPNGV2(t *testing.T) {
	out, err := BuildCharacterPNG(charWithPortrait(t), nil, "v2", Options{IncludeGreetings: true})
	require.NoError(t, err)

	_, err = png.Decode(bytes.NewReader(out))
	require.NoError(t, err)

	chunks, err := ReadTextChunks(out)
	require.NoError(t, err)
	require.Contains(t, chunks, "chara")
	assert.NotContains(t, chunks, "ccv3")

	card := embeddedCard(t, chunks["chara"])
	assert.Equal(t, "chara_card_v2", card["spec"])
}

func TestBuildCharacterPNGV3HasBothChunks(t *testing.T) {
	out, err := BuildCharacterPNG(charWithPortrait(t), nil, "v3", Options{IncludeGreetings: true})
	require.NoError(t, err)

	chunks, err := ReadTextChunks(out)
	require.NoError(t, err)
	require.Contains(t, chunks, "chara")
	require.Contains(t, chunks, "ccv3")

	assert.Equal(t, "chara_card_v2", embeddedCard(t, chunks["chara"])["spec"])
	assert.Equal(t, "chara_card_v3", embeddedCard(t, chunks["ccv3"])["spec"])
}

func TestBuildCharacterPNGPlaceholderWhenNoPortrait(t *testing.T) {
	ch := sampleChar() // no Portrait
	out, err := BuildCharacterPNG(ch, nil, "v2", Options{})
	require.NoError(t, err)

	_, err = png.Decode(bytes.NewReader(out))
	assert.NoError(t, err)
}

func TestBuildCharacterPNGRejectsInvalidPortrait(t *testing.T) {
	ch := sampleChar()
	ch.Portrait = []byte("not a real image")
	_, err := BuildCharacterPNG(ch, nil, "v2", Options{})
	assert.Error(t, err)
}

func TestBuildCharacterPNGRejectsUnknownSpec(t *testing.T) {
	_, err := BuildCharacterPNG(charWithPortrait(t), nil, "v9", Options{})
	assert.Error(t, err)
}

func TestExportCharacterPNGWritesFile(t *testing.T) {
	dir := t.TempDir()
	path, err := ExportCharacterPNG(charWithPortrait(t), nil, "v2", Options{IncludeGreetings: true}, dir)
	require.NoError(t, err)

	assert.Equal(t, filepath.Join(dir, "alice.png"), path)
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	_, err = png.Decode(bytes.NewReader(data))
	assert.NoError(t, err)
}

func TestExportCharacterPNGUnnamedCharacter(t *testing.T) {
	dir := t.TempDir()
	ch := charWithPortrait(t)
	ch.Name = ""
	path, err := ExportCharacterPNG(ch, nil, "v2", Options{}, dir)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(dir, "character.png"), path)
}
