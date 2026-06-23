// Package cardimport parses existing SillyTavern character cards (PNG v2/v3 with
// embedded tEXt chunks, or JSON v1/v2/v3) back into Silly Sleeve characters. It is
// the inverse of internal/cardexport and is named cardimport rather than import
// because "import" is a TypeScript reserved word that breaks the Wails bindings.
package cardimport

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"silly-sleeve/internal/cardexport"
)

// ParsedCard is the normalized intermediate between a raw card and a character.
type ParsedCard struct {
	Name               string
	Description        string
	Personality        string
	FirstMes           string
	MesExample         string
	CreatorNotes       string
	Tags               []string
	AlternateGreetings []string
	CharacterBook      *CharacterBook
	Portrait           []byte
	SpecVersion        string
}

// CharacterBook mirrors the embedded character_book of a v2/v3 card.
type CharacterBook struct {
	Name    string      `json:"name"`
	Entries []BookEntry `json:"entries"`
}

// BookEntry mirrors a character_book entry. Enabled is a pointer so an absent
// field defaults to enabled (the SillyTavern convention) rather than disabled.
type BookEntry struct {
	Keys           []string `json:"keys"`
	SecondaryKeys  []string `json:"secondary_keys"`
	Content        string   `json:"content"`
	Comment        string   `json:"comment"`
	Name           string   `json:"name"`
	Enabled        *bool    `json:"enabled"`
	InsertionOrder int      `json:"insertion_order"`
	Selective      bool     `json:"selective"`
	Constant       bool     `json:"constant"`
	Position       string   `json:"position"`
	ID             int      `json:"id"`
}

// ParseCard auto-detects the card format (PNG or JSON) and returns a ParsedCard.
func ParseCard(data []byte) (*ParsedCard, error) {
	if bytes.HasPrefix(data, pngSignature) {
		return parsePNG(data)
	}
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) > 0 && trimmed[0] == '{' {
		return parseJSON(trimmed)
	}
	return nil, fmt.Errorf("unrecognized card format: expected PNG or JSON")
}

// cardEnvelope detects the v2/v3 spec wrapper. v1 cards have no "spec".
type cardEnvelope struct {
	Spec string          `json:"spec"`
	Data json.RawMessage `json:"data"`
}

// cardJSON is the flat field set shared by v1 (top level) and v2/v3 (under data).
type cardJSON struct {
	Name               string         `json:"name"`
	Description        string         `json:"description"`
	Personality        string         `json:"personality"`
	FirstMes           string         `json:"first_mes"`
	MesExample         string         `json:"mes_example"`
	CreatorNotes       string         `json:"creator_notes"`
	Creatorcomment     string         `json:"creatorcomment"`
	Tags               []string       `json:"tags"`
	AlternateGreetings []string       `json:"alternate_greetings"`
	CharacterBook      *CharacterBook `json:"character_book"`
}

func parseJSON(data []byte) (*ParsedCard, error) {
	var env cardEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		return nil, fmt.Errorf("parse card JSON: %w", err)
	}
	raw, spec := data, "v1"
	switch env.Spec {
	case "chara_card_v3":
		raw, spec = env.Data, "v3"
	case "chara_card_v2":
		raw, spec = env.Data, "v2"
	}
	var c cardJSON
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, fmt.Errorf("parse card data: %w", err)
	}
	notes := c.CreatorNotes
	if notes == "" {
		notes = c.Creatorcomment
	}
	return &ParsedCard{
		Name:               c.Name,
		Description:        c.Description,
		Personality:        c.Personality,
		FirstMes:           c.FirstMes,
		MesExample:         c.MesExample,
		CreatorNotes:       notes,
		Tags:               c.Tags,
		AlternateGreetings: c.AlternateGreetings,
		CharacterBook:      c.CharacterBook,
		SpecVersion:        spec,
	}, nil
}

var pngSignature = []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}

func parsePNG(data []byte) (*ParsedCard, error) {
	chunks, err := cardexport.ReadTextChunks(data)
	if err != nil {
		return nil, err
	}
	raw, ok := chunkJSON(chunks, "ccv3")
	if !ok {
		raw, ok = chunkJSON(chunks, "chara")
	}
	if !ok {
		return nil, fmt.Errorf("no character data (chara/ccv3 tEXt chunk) in PNG")
	}
	pc, err := parseJSON(raw)
	if err != nil {
		return nil, err
	}
	pc.Portrait = data
	return pc, nil
}

// chunkJSON returns the JSON bytes for a tEXt keyword, base64-decoding the stored
// value (SillyTavern's convention) and falling back to the raw value when the
// decode does not yield a JSON object.
func chunkJSON(chunks map[string]string, key string) ([]byte, bool) {
	v, ok := chunks[key]
	if !ok || v == "" {
		return nil, false
	}
	if decoded, err := base64.StdEncoding.DecodeString(v); err == nil {
		if t := bytes.TrimSpace(decoded); len(t) > 0 && t[0] == '{' {
			return decoded, true
		}
	}
	return []byte(v), true
}
