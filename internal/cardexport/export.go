package cardexport

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"os"
	"path/filepath"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
)

// BuildCharacterPNG renders a SillyTavern-ready character card PNG: the
// character's portrait (or a placeholder) with the card JSON embedded in tEXt
// chunks. spec selects the embedding: "v2" injects only the "chara" chunk;
// "v3" injects "chara" (for backward compatibility) plus the richer "ccv3"
// chunk that carries the embedded lorebook and asset library.
func BuildCharacterPNG(ch compose.Character, entries []lorebook.Entry, spec string, opts Options) ([]byte, error) {
	if spec != "v2" && spec != "v3" {
		return nil, fmt.Errorf("unknown card spec %q", spec)
	}

	base, err := portraitPNG(ch.Portrait)
	if err != nil {
		return nil, err
	}

	charKey := fmt.Sprintf("%d", ch.ID)

	v2, err := CardV2JSON(ch, entries, charKey, opts)
	if err != nil {
		return nil, err
	}
	out, err := InjectTextChunk(base, "chara", base64.StdEncoding.EncodeToString(v2))
	if err != nil {
		return nil, err
	}

	if spec == "v3" {
		v3, err := CardV3JSON(ch, entries, charKey, opts)
		if err != nil {
			return nil, err
		}
		out, err = InjectTextChunk(out, "ccv3", base64.StdEncoding.EncodeToString(v3))
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

// ExportCharacterPNG builds the card PNG and writes it into folderPath as
// <slug>.png, returning the written path.
func ExportCharacterPNG(ch compose.Character, entries []lorebook.Entry, spec string, opts Options, folderPath string) (string, error) {
	data, err := BuildCharacterPNG(ch, entries, spec, opts)
	if err != nil {
		return "", err
	}

	name := compose.Slugify(ch.Name)
	if name == "" {
		name = "character"
	}
	outPath := filepath.Join(folderPath, name+".png")
	if err := os.WriteFile(outPath, data, 0o644); err != nil {
		return "", fmt.Errorf("write character PNG: %w", err)
	}
	return outPath, nil
}

// portraitPNG validates the portrait bytes as PNG, or returns a placeholder
// when no portrait is set. A non-empty but undecodable portrait is an error
// rather than a silent fallback, so corrupt data is surfaced.
func portraitPNG(portrait []byte) ([]byte, error) {
	if len(portrait) == 0 {
		return placeholderPNG(), nil
	}
	if _, err := png.Decode(bytes.NewReader(portrait)); err != nil {
		return nil, fmt.Errorf("portrait is not a valid PNG: %w", err)
	}
	return portrait, nil
}
