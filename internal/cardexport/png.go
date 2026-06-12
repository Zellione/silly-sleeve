// Package cardexport builds production SillyTavern artifacts: Character Card
// v2/v3 PNGs with embedded JSON (tEXt chunks). It sits above the compose and
// lorebook packages, reusing their card-field derivation. It is named
// cardexport rather than export because "export" is a reserved word in
// TypeScript and breaks the Wails-generated frontend bindings.
package cardexport

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"image"
	"image/color"
	"image/png"
)

// pngSignature is the 8-byte magic header that begins every PNG file.
var pngSignature = []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}

// InjectTextChunk returns a copy of pngData with a new tEXt chunk (keyword +
// text) spliced in immediately before the terminating IEND chunk. SillyTavern
// stores character JSON this way under the "chara" (v2) and "ccv3" keywords.
func InjectTextChunk(pngData []byte, keyword, text string) ([]byte, error) {
	if !bytes.HasPrefix(pngData, pngSignature) {
		return nil, fmt.Errorf("not a PNG file")
	}
	iendOffset, err := findChunk(pngData, "IEND")
	if err != nil {
		return nil, err
	}

	chunk := textChunk(keyword, text)
	out := make([]byte, 0, len(pngData)+len(chunk))
	out = append(out, pngData[:iendOffset]...)
	out = append(out, chunk...)
	out = append(out, pngData[iendOffset:]...)
	return out, nil
}

// ReadTextChunks parses every tEXt chunk out of a PNG, keyed by keyword. It is
// the inverse of InjectTextChunk and underpins round-trip verification (and,
// later, card re-import).
func ReadTextChunks(pngData []byte) (map[string]string, error) {
	if !bytes.HasPrefix(pngData, pngSignature) {
		return nil, fmt.Errorf("not a PNG file")
	}
	result := make(map[string]string)
	offset := len(pngSignature)
	for offset+8 <= len(pngData) {
		length := int(binary.BigEndian.Uint32(pngData[offset : offset+4]))
		typ := string(pngData[offset+4 : offset+8])
		dataStart := offset + 8
		dataEnd := dataStart + length
		if dataEnd+4 > len(pngData) {
			return nil, fmt.Errorf("truncated %q chunk", typ)
		}
		if typ == "tEXt" {
			data := pngData[dataStart:dataEnd]
			if keyword, value, found := bytes.Cut(data, []byte{0}); found {
				result[string(keyword)] = string(value)
			}
		}
		if typ == "IEND" {
			break
		}
		offset = dataEnd + 4 // skip CRC
	}
	return result, nil
}

// findChunk returns the byte offset where the first chunk of the given type
// begins (at its 4-byte length field).
func findChunk(pngData []byte, want string) (int, error) {
	offset := len(pngSignature)
	for offset+8 <= len(pngData) {
		length := int(binary.BigEndian.Uint32(pngData[offset : offset+4]))
		typ := string(pngData[offset+4 : offset+8])
		if typ == want {
			return offset, nil
		}
		offset += 12 + length // length(4) + type(4) + data + crc(4)
	}
	return 0, fmt.Errorf("%q chunk not found", want)
}

// textChunk encodes a PNG tEXt chunk: length, "tEXt", keyword\0text, CRC32.
func textChunk(keyword, text string) []byte {
	data := make([]byte, 0, len(keyword)+1+len(text))
	data = append(data, keyword...)
	data = append(data, 0)
	data = append(data, text...)

	typeAndData := append([]byte("tEXt"), data...)

	var lenBuf, crcBuf [4]byte
	binary.BigEndian.PutUint32(lenBuf[:], uint32(len(data)))
	binary.BigEndian.PutUint32(crcBuf[:], crc32.ChecksumIEEE(typeAndData))

	out := make([]byte, 0, 8+len(data)+4)
	out = append(out, lenBuf[:]...)
	out = append(out, typeAndData...)
	out = append(out, crcBuf[:]...)
	return out
}

// placeholderPNG renders a neutral square used when a character has no portrait,
// so PNG export still produces a valid, importable card.
func placeholderPNG() []byte {
	const size = 512
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	fill := color.RGBA{R: 0x2a, G: 0x2a, B: 0x33, A: 0xff}
	for y := range size {
		for x := range size {
			img.Set(x, y, fill)
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}
