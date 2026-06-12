package cardexport

import (
	"encoding/json"
	"slices"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
)

// Options controls how a character card is assembled for export. They mirror
// the embedding checkboxes on the export hub screen.
type Options struct {
	// EmbedLorebook attaches the (optionally scoped) lorebook as a
	// character_book inside the card data.
	EmbedLorebook bool
	// ScopePerChar keeps only lorebook entries linked to the exported
	// character (entries with no character links are always kept).
	ScopePerChar bool
	// IncludeGreetings keeps first_mes and alternate_greetings; when false
	// they are cleared.
	IncludeGreetings bool
	// StripMetadata clears generation metadata (creator, version, notes).
	StripMetadata bool
}

const (
	creatorName   = "Silly Sleeve"
	characterVer  = "1.0"
	specV2        = "chara_card_v2"
	specV3        = "chara_card_v3"
	specVersionV2 = "2.0"
	specVersionV3 = "3.0"
)

// cardData is the SillyTavern Character Card v2 data object. v3 embeds it and
// adds a handful of fields.
type cardData struct {
	Name                    string         `json:"name"`
	Description             string         `json:"description"`
	Personality             string         `json:"personality"`
	Scenario                string         `json:"scenario"`
	FirstMes                string         `json:"first_mes"`
	MesExample              string         `json:"mes_example"`
	CreatorNotes            string         `json:"creator_notes"`
	SystemPrompt            string         `json:"system_prompt"`
	PostHistoryInstructions string         `json:"post_history_instructions"`
	AlternateGreetings      []string       `json:"alternate_greetings"`
	CharacterBook           *characterBook `json:"character_book,omitempty"`
	Tags                    []string       `json:"tags"`
	Creator                 string         `json:"creator"`
	CharacterVersion        string         `json:"character_version"`
	Extensions              map[string]any `json:"extensions"`
}

type cardV2 struct {
	Spec        string   `json:"spec"`
	SpecVersion string   `json:"spec_version"`
	Data        cardData `json:"data"`
}

type asset struct {
	Type string `json:"type"`
	URI  string `json:"uri"`
	Name string `json:"name"`
	Ext  string `json:"ext"`
}

type cardDataV3 struct {
	cardData
	Assets             []asset  `json:"assets"`
	Nickname           string   `json:"nickname,omitempty"`
	GroupOnlyGreetings []string `json:"group_only_greetings"`
}

type cardV3 struct {
	Spec        string     `json:"spec"`
	SpecVersion string     `json:"spec_version"`
	Data        cardDataV3 `json:"data"`
}

// characterBook is the embedded lorebook structure of a v2/v3 card.
type characterBook struct {
	Name       string         `json:"name"`
	Entries    []bookEntry    `json:"entries"`
	Extensions map[string]any `json:"extensions"`
}

type bookEntry struct {
	Keys           []string       `json:"keys"`
	SecondaryKeys  []string       `json:"secondary_keys"`
	Content        string         `json:"content"`
	Comment        string         `json:"comment"`
	Name           string         `json:"name"`
	Enabled        bool           `json:"enabled"`
	InsertionOrder int            `json:"insertion_order"`
	CaseSensitive  bool           `json:"case_sensitive"`
	Selective      bool           `json:"selective"`
	Constant       bool           `json:"constant"`
	Position       string         `json:"position"`
	ID             int            `json:"id"`
	Extensions     map[string]any `json:"extensions"`
}

// buildData assembles the shared v2 card data for a character.
func buildData(ch compose.Character, entries []lorebook.Entry, charKey string, opts Options) cardData {
	f := compose.BuildCardFields(ch)

	d := cardData{
		Name:               f.Name,
		Description:        f.Description,
		Personality:        f.Personality,
		Scenario:           f.Scenario,
		FirstMes:           f.FirstMes,
		MesExample:         f.MesExample,
		AlternateGreetings: []string{},
		Tags:               f.Tags,
		Creator:            creatorName,
		CharacterVersion:   characterVer,
		CreatorNotes:       f.Epithet,
		Extensions:         map[string]any{},
	}

	if !opts.IncludeGreetings {
		d.FirstMes = ""
		d.AlternateGreetings = []string{}
	}
	if opts.StripMetadata {
		d.Creator = ""
		d.CharacterVersion = ""
		d.CreatorNotes = ""
	}
	if opts.EmbedLorebook {
		d.CharacterBook = buildCharacterBook(filterEntries(entries, charKey, opts.ScopePerChar))
	}
	return d
}

// CardV2JSON returns the Character Card v2 JSON for the "chara" tEXt chunk.
func CardV2JSON(ch compose.Character, entries []lorebook.Entry, charKey string, opts Options) ([]byte, error) {
	card := cardV2{
		Spec:        specV2,
		SpecVersion: specVersionV2,
		Data:        buildData(ch, entries, charKey, opts),
	}
	return json.Marshal(card)
}

// CardV3JSON returns the Character Card v3 JSON for the "ccv3" tEXt chunk.
func CardV3JSON(ch compose.Character, entries []lorebook.Entry, charKey string, opts Options) ([]byte, error) {
	card := cardV3{
		Spec:        specV3,
		SpecVersion: specVersionV3,
		Data: cardDataV3{
			cardData:           buildData(ch, entries, charKey, opts),
			Assets:             []asset{{Type: "icon", URI: "ccdefault:", Name: "main", Ext: "png"}},
			GroupOnlyGreetings: []string{},
		},
	}
	return json.Marshal(card)
}

// filterEntries returns the lorebook entries to embed for a character. When
// scoping is on, entries with no character links are kept (global), and the
// rest are kept only if they reference charKey.
func filterEntries(entries []lorebook.Entry, charKey string, scope bool) []lorebook.Entry {
	if !scope {
		return entries
	}
	var out []lorebook.Entry
	for _, e := range entries {
		if len(e.Characters) == 0 || slices.Contains(e.Characters, charKey) {
			out = append(out, e)
		}
	}
	return out
}

// buildCharacterBook converts lorebook entries into the embedded character_book.
func buildCharacterBook(entries []lorebook.Entry) *characterBook {
	book := &characterBook{
		Entries:    make([]bookEntry, 0, len(entries)),
		Extensions: map[string]any{},
	}
	for _, e := range entries {
		book.Entries = append(book.Entries, bookEntry{
			Keys:           nonNil(e.Key),
			SecondaryKeys:  nonNil(e.KeySecondary),
			Content:        e.Content,
			Comment:        e.Comment,
			Name:           e.Comment,
			Enabled:        !e.Disable,
			InsertionOrder: e.Order,
			Selective:      e.Selective,
			Constant:       e.Constant,
			Position:       positionString(e.Position),
			ID:             e.UID,
			Extensions:     map[string]any{},
		})
	}
	return book
}

// positionString maps a SillyTavern world-info position to the character_book
// enum. 0 is before the character definition, 1 is after; anything else falls
// back to before_char.
func positionString(pos int) string {
	if pos == 1 {
		return "after_char"
	}
	return "before_char"
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
