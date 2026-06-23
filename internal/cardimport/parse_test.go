package cardimport

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"silly-sleeve/internal/cardexport"
	"silly-sleeve/internal/compose"
)

func TestParseCard_JSONv2(t *testing.T) {
	data := []byte(`{"spec":"chara_card_v2","spec_version":"2.0","data":{
		"name":"Ada","description":"### Appearance\ntall","personality":"calm",
		"first_mes":"Hi","tags":["sci-fi"],"creator_notes":"The Pilot"}}`)
	pc, err := ParseCard(data)
	require.NoError(t, err)
	assert.Equal(t, "v2", pc.SpecVersion)
	assert.Equal(t, "Ada", pc.Name)
	assert.Equal(t, "### Appearance\ntall", pc.Description)
	assert.Equal(t, "calm", pc.Personality)
	assert.Equal(t, "Hi", pc.FirstMes)
	assert.Equal(t, []string{"sci-fi"}, pc.Tags)
	assert.Equal(t, "The Pilot", pc.CreatorNotes)
}

func TestParseCard_JSONv1Flat(t *testing.T) {
	data := []byte(`{"name":"Bo","description":"d","first_mes":"yo","creatorcomment":"Cmt"}`)
	pc, err := ParseCard(data)
	require.NoError(t, err)
	assert.Equal(t, "v1", pc.SpecVersion)
	assert.Equal(t, "Bo", pc.Name)
	assert.Equal(t, "Cmt", pc.CreatorNotes)
}

func TestParseCard_Unrecognized(t *testing.T) {
	_, err := ParseCard([]byte("not a card"))
	assert.Error(t, err)
}

func TestParseCard_MalformedJSON(t *testing.T) {
	_, err := ParseCard([]byte("{bad"))
	assert.Error(t, err)
}

// composeStub returns a minimal Character for testing.
func composeStub() compose.Character {
	return compose.NewCharacter(0)
}

// minimalPNGNoChunks builds a bare PNG without any tEXt chunks.
func minimalPNGNoChunks(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func TestParseCard_PNGBase64(t *testing.T) {
	body := `{"spec":"chara_card_v2","spec_version":"2.0","data":{"name":"Pix","description":"d"}}`
	base, err := cardexport.BuildCharacterPNG(composeStub(), nil, "v2", cardexport.Options{})
	require.NoError(t, err)
	// Re-inject our own chara chunk (base64), as SillyTavern does.
	png, err := cardexport.InjectTextChunk(base, "chara", base64.StdEncoding.EncodeToString([]byte(body)))
	require.NoError(t, err)
	pc, err := ParseCard(png)
	require.NoError(t, err)
	assert.Equal(t, "Pix", pc.Name)
	assert.NotEmpty(t, pc.Portrait)
}

func TestParseCard_PNGRawFallback(t *testing.T) {
	body := `{"name":"Raw","description":"d"}`
	base, err := cardexport.BuildCharacterPNG(composeStub(), nil, "v2", cardexport.Options{})
	require.NoError(t, err)
	png, err := cardexport.InjectTextChunk(base, "chara", body) // not base64
	require.NoError(t, err)
	pc, err := ParseCard(png)
	require.NoError(t, err)
	assert.Equal(t, "Raw", pc.Name)
}

func TestParseCard_PNGNoChunk(t *testing.T) {
	// A PNG with no chara/ccv3 chunk.
	bare := minimalPNGNoChunks(t)
	_, err := ParseCard(bare)
	assert.Error(t, err)
}
