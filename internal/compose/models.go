package compose

// StatKV is a key/value pair used in character stat blocks.
type StatKV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Character holds all fields for a single character card.
type Character struct {
	ID            int       `json:"id"`
	Name          string    `json:"name"`
	Epithet       string    `json:"epithet"`
	Tags          []string  `json:"tags"`
	Appearance    string    `json:"appearance"`
	Personality   string    `json:"personality"`
	Backstory     string    `json:"backstory"`
	Abilities     string    `json:"abilities"`
	Relationships string    `json:"relationships"`
	Quotes        []string  `json:"quotes"`
	Stats         []StatKV  `json:"stats"`
	Dirty         bool      `json:"dirty"`
}

// NewCharacter creates a fresh character with empty fields.
func NewCharacter(id int) Character {
	return Character{
		ID:    id,
		Name:  "Untitled",
		Tags:  []string{},
		Quotes: []string{""},
		Stats: []StatKV{{Key: "", Value: ""}},
	}
}

// FieldIDs returns the ordered list of field identifiers for rendering.
func FieldIDs() []string {
	return []string{
		"name", "epithet", "tags", "appearance", "personality",
		"backstory", "abilities", "relationships", "quotes", "stats",
	}
}

// FieldLabel returns the human-readable label for a field ID.
func FieldLabel(id string) string {
	m := map[string]string{
		"name":          "Name",
		"epithet":       "Title / epithet",
		"tags":          "Tags",
		"appearance":    "Appearance",
		"personality":   "Personality",
		"backstory":     "Backstory",
		"abilities":     "Abilities & skills",
		"relationships": "Relationships",
		"quotes":        "Example quotes",
		"stats":         "Stat block",
	}
	if v, ok := m[id]; ok {
		return v
	}
	return id
}

// FieldRequired returns true if the field is mandatory.
func FieldRequired(id string) bool {
	return id == "name" || id == "appearance" || id == "personality"
}

// FieldType returns the input type for a field ID.
func FieldType(id string) string {
	m := map[string]string{
		"name":    "line",
		"epithet": "line",
		"tags":    "tags",
		"quotes":  "quotes",
		"stats":   "stats",
	}
	if v, ok := m[id]; ok {
		return v
	}
	return "text"
}
