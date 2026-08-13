package lorebook

// Entry categories. A category is not part of the SillyTavern world_info spec —
// it is our own classification, carried in the Entry's "category" key, which
// SillyTavern ignores on import. It exists because the mechanical settings an
// entry needs (where it is inserted, whether it may cascade into other entries)
// follow directly from what kind of thing the entry describes. Storing the
// category explicitly keeps that intent recoverable: Position and
// PreventRecursion alone cannot distinguish a location from an organization
// from a concept, since all three share the same pair of values.
const (
	CategoryCharacter    = "character"
	CategoryLocation     = "location"
	CategoryOrganization = "organization"
	CategoryItem         = "item"
	CategoryRule         = "rule"
	CategoryEvent        = "event"
	CategoryConcept      = "concept"
)

// DefaultCategory is used for entries whose category is missing or unrecognised.
// Concept is the safe fallback: it inserts before character definitions and
// allows recursion, which is the least surprising behaviour for general lore.
const DefaultCategory = CategoryConcept

// SillyTavern insertion positions, used by CategorySettings.Position.
const (
	PositionBeforeCharDefs = 0
	PositionAfterCharDefs  = 1
	PositionAfterExamples  = 2
	PositionAtDepth        = 3
	PositionAuthorsNote    = 4
)

// Tier is a named order range. SillyTavern inserts higher-order entries first,
// so the tier an entry lands in decides what survives when the context budget
// runs out. Entries should be spread across tiers rather than clustered on a
// single value, which is what a model left to its own devices tends to do.
type Tier struct {
	Name string
	Min  int
	Max  int
}

// Order tiers, highest priority first.
var (
	TierNuclear    = Tier{Name: "nuclear", Min: 900, Max: 999}
	TierCritical   = Tier{Name: "critical", Min: 500, Max: 899}
	TierHigh       = Tier{Name: "high", Min: 200, Max: 499}
	TierStandard   = Tier{Name: "standard", Min: 100, Max: 199}
	TierBackground = Tier{Name: "background", Min: 50, Max: 99}
	TierFlavor     = Tier{Name: "flavor", Min: 10, Max: 49}
)

// Tiers returns the order tiers from highest to lowest priority.
func Tiers() []Tier {
	return []Tier{TierNuclear, TierCritical, TierHigh, TierStandard, TierBackground, TierFlavor}
}

// TierFor returns the tier containing order, and whether one was found. Orders
// below the lowest tier or above the highest fall outside every range.
func TierFor(order int) (Tier, bool) {
	for _, t := range Tiers() {
		if order >= t.Min && order <= t.Max {
			return t, true
		}
	}
	return Tier{}, false
}

// Mid returns the midpoint of the tier, used when an out-of-range order has to
// be pulled back onto a valid value.
func (t Tier) Mid() int {
	return t.Min + (t.Max-t.Min)/2
}

// CategorySettings are the mechanical entry settings implied by a category.
// Position and PreventRecursion are authoritative — the normaliser overrides
// whatever the model produced. Constant and DefaultTier are starting points the
// user may override in review.
type CategorySettings struct {
	// Position is the SillyTavern insertion point for entries of this category.
	Position int
	// PreventRecursion stops this entry from being triggered by another entry's
	// content. Categories that describe a container of other things (locations,
	// organizations, concepts) leave it off so mentioning a member cascades into
	// that member's entry; leaf categories switch it on to terminate the chain.
	PreventRecursion bool
	// Constant marks entries always present in context regardless of keywords.
	Constant bool
	// DefaultTier is the order tier to fall back to when the model's order is
	// unusable.
	DefaultTier Tier
	// ContentHint is guidance surfaced in the extraction prompt and the review UI.
	ContentHint string
}

var categorySettings = map[string]CategorySettings{
	CategoryCharacter: {
		Position:         PositionAfterCharDefs,
		PreventRecursion: true,
		DefaultTier:      TierHigh,
		ContentHint:      "A person. Append bracketed metadata: [ role(value); personality(trait, trait); relationships(Name(dynamic)); ]",
	},
	CategoryLocation: {
		Position:         PositionBeforeCharDefs,
		PreventRecursion: false,
		DefaultTier:      TierStandard,
		ContentHint:      "A place. Must mention the NPCs and items found there by name so recursion reaches their entries.",
	},
	CategoryOrganization: {
		Position:         PositionBeforeCharDefs,
		PreventRecursion: false,
		DefaultTier:      TierHigh,
		ContentHint:      "A faction or group. Must mention its key members by name so recursion reaches their entries.",
	},
	CategoryItem: {
		Position:         PositionBeforeCharDefs,
		PreventRecursion: true,
		DefaultTier:      TierBackground,
		ContentHint:      "An object or artifact. A terminal node — it should not cascade further.",
	},
	CategoryRule: {
		Position:         PositionAuthorsNote,
		PreventRecursion: true,
		Constant:         true,
		DefaultTier:      TierNuclear,
		ContentHint:      "A hard world mechanic. Under 100 tokens, phrased imperatively, prefixed \"RULE: \".",
	},
	CategoryEvent: {
		Position:         PositionAtDepth,
		PreventRecursion: true,
		DefaultTier:      TierStandard,
		ContentHint:      "A temporary state, scene condition or quest hook.",
	},
	CategoryConcept: {
		Position:         PositionBeforeCharDefs,
		PreventRecursion: false,
		DefaultTier:      TierStandard,
		ContentHint:      "History, lore or doctrine. May cascade into the entities it names.",
	},
}

// Categories returns the category identifiers in display order.
func Categories() []string {
	return []string{
		CategoryCharacter,
		CategoryLocation,
		CategoryOrganization,
		CategoryItem,
		CategoryRule,
		CategoryEvent,
		CategoryConcept,
	}
}

// CategoryDefaults returns the settings for a category, and whether the category
// is recognised. Unrecognised categories return the settings for DefaultCategory
// so callers can use the result unconditionally.
func CategoryDefaults(category string) (CategorySettings, bool) {
	if s, ok := categorySettings[category]; ok {
		return s, true
	}
	return categorySettings[DefaultCategory], false
}

// CategoryLabel returns the display label for a category.
func CategoryLabel(category string) string {
	if l, ok := categoryLabels[category]; ok {
		return l
	}
	return category
}

var categoryLabels = map[string]string{
	CategoryCharacter:    "Character",
	CategoryLocation:     "Location",
	CategoryOrganization: "Organization",
	CategoryItem:         "Item",
	CategoryRule:         "Rule",
	CategoryEvent:        "Event",
	CategoryConcept:      "Concept",
}
