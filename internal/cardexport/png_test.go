package cardexport

import (
	"bytes"
	"encoding/binary"
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

func TestReadTextChunksRejectsMaliciousChunkSize(t *testing.T) {
	// Create a PNG with a chunk claiming an oversized length.
	// This tests that we reject huge claimed sizes without trying to read that much data.
	src := makePNG(t)

	// Build a malicious PNG: valid signature + valid IHDR, then a fake tEXt chunk
	// claiming maxPNGChunkBytes + 1 bytes.
	malicious := make([]byte, 0, len(src)+20)
	malicious = append(malicious, src...)

	// Truncate to just after IHDR to safely insert our chunk
	// PNG format: signature(8) + IHDR(25 bytes total) + chunks...
	if len(malicious) > 33 {
		malicious = malicious[:33]
	}

	// Craft a fake tEXt chunk with excessive length
	fakeChunk := make([]byte, 16)
	binary.BigEndian.PutUint32(fakeChunk[0:4], uint32(maxPNGChunkBytes+1))
	copy(fakeChunk[4:8], []byte("tEXt"))
	// Rest is fake data, but we won't read it

	malicious = append(malicious, fakeChunk...)

	// Add IEND chunk to make it look more valid
	iendChunk := []byte{0, 0, 0, 0, 'I', 'E', 'N', 'D', 0xae, 0x42, 0x60, 0x82}
	malicious = append(malicious, iendChunk...)

	_, err := ReadTextChunks(malicious)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds maximum")
}

func TestReadTextChunksAcceptsLargeButValidChunk(t *testing.T) {
	// Test that we can read a legitimately large chunk (but within limits).
	// We'll use InjectTextChunk to create a proper PNG with known data.
	src := makePNG(t)

	// Create a 1 MB payload
	payload := make([]byte, 1<<20)
	for i := range payload {
		payload[i] = 'A' + byte(i%26)
	}

	out, err := InjectTextChunk(src, "test", string(payload))
	require.NoError(t, err)

	chunks, err := ReadTextChunks(out)
	require.NoError(t, err)
	assert.Equal(t, string(payload), chunks["test"])
}

func TestFindChunkRejectsMaliciousSize(t *testing.T) {
	// Similar to ReadTextChunks, findChunk should also reject oversized chunks.
	src := makePNG(t)

	malicious := make([]byte, 0, len(src)+20)
	malicious = append(malicious, src...)
	if len(malicious) > 33 {
		malicious = malicious[:33]
	}

	// Craft a fake chunk claiming oversized length
	fakeChunk := make([]byte, 16)
	binary.BigEndian.PutUint32(fakeChunk[0:4], uint32(maxPNGChunkBytes+1))
	copy(fakeChunk[4:8], []byte("IEND"))

	malicious = append(malicious, fakeChunk...)

	_, err := findChunk(malicious, "IEND")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds maximum")
}
