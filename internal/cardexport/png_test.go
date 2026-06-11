package cardexport

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// makePNG builds a tiny valid PNG for testing.
func makePNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func TestInjectTextChunkRejectsNonPNG(t *testing.T) {
	_, err := InjectTextChunk([]byte("not a png"), "chara", "data")
	assert.Error(t, err)
}

func TestInjectTextChunkProducesDecodablePNG(t *testing.T) {
	src := makePNG(t)
	out, err := InjectTextChunk(src, "chara", "hello")
	require.NoError(t, err)

	// The result must still decode as a valid PNG image.
	_, err = png.Decode(bytes.NewReader(out))
	assert.NoError(t, err)

	// The output is larger than the source (a chunk was added).
	assert.Greater(t, len(out), len(src))
}

func TestInjectTextChunkRoundTrip(t *testing.T) {
	src := makePNG(t)
	out, err := InjectTextChunk(src, "chara", "embedded-value")
	require.NoError(t, err)

	chunks, err := ReadTextChunks(out)
	require.NoError(t, err)
	assert.Equal(t, "embedded-value", chunks["chara"])
}

func TestInjectMultipleChunks(t *testing.T) {
	src := makePNG(t)
	out, err := InjectTextChunk(src, "chara", "v2-payload")
	require.NoError(t, err)
	out, err = InjectTextChunk(out, "ccv3", "v3-payload")
	require.NoError(t, err)

	chunks, err := ReadTextChunks(out)
	require.NoError(t, err)
	assert.Equal(t, "v2-payload", chunks["chara"])
	assert.Equal(t, "v3-payload", chunks["ccv3"])
}

func TestReadTextChunksRejectsNonPNG(t *testing.T) {
	_, err := ReadTextChunks([]byte("nope"))
	assert.Error(t, err)
}

func TestReadTextChunksTruncated(t *testing.T) {
	src := makePNG(t)
	// Chop off the trailing bytes to corrupt the final chunk.
	_, err := ReadTextChunks(src[:len(src)-3])
	assert.Error(t, err)
}

func TestPlaceholderPNGIsValid(t *testing.T) {
	data := placeholderPNG()
	img, err := png.Decode(bytes.NewReader(data))
	require.NoError(t, err)
	assert.Positive(t, img.Bounds().Dx())
}
