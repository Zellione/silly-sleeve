package compose

// CardPreviewTokens holds the token budget for a character's "permanent"
// context — the fields injected into every generation, as opposed to
// FirstMes which is inserted once into chat history.
type CardPreviewTokens struct {
	Description int `json:"description"`
	Personality int `json:"personality"`
	Scenario    int `json:"scenario"`
	Examples    int `json:"examples"`
	Total       int `json:"total"`
}

// CardPreview bundles a character's assembled card fields with their token
// budget, for the Preview screen.
type CardPreview struct {
	Fields CardFields        `json:"fields"`
	Tokens CardPreviewTokens `json:"tokens"`
}

// BuildCardPreview assembles a character's card fields and computes the
// permanent-context token budget from them.
func BuildCardPreview(ch Character) CardPreview {
	f := BuildCardFields(ch)

	tokens := CardPreviewTokens{
		Description: CountTokens(f.Description),
		Personality: CountTokens(f.Personality),
		Scenario:    CountTokens(f.Scenario),
		Examples:    CountTokens(f.MesExample),
	}
	tokens.Total = tokens.Description + tokens.Personality + tokens.Scenario + tokens.Examples

	return CardPreview{Fields: f, Tokens: tokens}
}
