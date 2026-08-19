package lorebook

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// normalizeOne runs a single entry through Normalize and returns the result.
func normalizeOne(t *testing.T, e Entry) NormalizeResult {
	t.Helper()
	out := Normalize([]Entry{e}, 0)
	require.Len(t, out, 1)
	return out[0]
}

// hasAdjustment reports whether any adjustment message contains substr.
func hasAdjustment(adjustments []string, substr string) bool {
	for _, a := range adjustments {
		if strings.Contains(strings.ToLower(a), strings.ToLower(substr)) {
			return true
		}
	}
	return false
}

func TestIsCategoryMandated(t *testing.T) {
	assert.True(t, IsCategoryMandated("Position 0 → 1 (required for character entries)."))
	assert.True(t, IsCategoryMandated("Recursion prevention false → true (required for rule entries)."))
	assert.False(t, IsCategoryMandated("Only 1 keyword; 2 or more trigger more reliably."))
	assert.False(t, IsCategoryMandated(`Added the "RULE: " prefix required for rule entries.`))
	assert.False(t, IsCategoryMandated("Always-on false → true (rule entries are always constant)."))
}

// validEntry is a well-formed entry that should pass through untouched.
func validEntry() Entry {
	return Entry{
		UID:            1,
		Comment:        "The Rusty Flagon",
		Category:       CategoryLocation,
		Key:            []string{"Rusty Flagon", "the flagon"},
		Content:        "The Rusty Flagon hunches at the district's edge, reeking of spilled ale.",
		Order:          150,
		Position:       PositionBeforeCharDefs,
		Probability:    100,
		UseProbability: true,
		AddMemo:        true,
		Depth:          4,
	}
}

func TestNormalize_ValidEntryPassesThroughUnchanged(t *testing.T) {
	in := validEntry()
	got := normalizeOne(t, in)

	assert.Empty(t, got.Adjustments, "a spec-compliant entry should need no correction")
	assert.Equal(t, in.Order, got.Entry.Order)
	assert.Equal(t, in.Key, got.Entry.Key)
	assert.Equal(t, in.Content, got.Entry.Content)
	assert.Equal(t, CategoryLocation, got.Entry.Category)
}

func TestNormalize_CategoryCoercion(t *testing.T) {
	tests := []struct {
		name     string
		category string
		wantNote string
	}{
		{"empty", "", "no category given"},
		{"unknown", "spaceship", "unrecognised category"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			e := validEntry()
			e.Category = tc.category
			got := normalizeOne(t, e)

			assert.Equal(t, DefaultCategory, got.Entry.Category)
			assert.True(t, hasAdjustment(got.Adjustments, tc.wantNote),
				"expected a note about the category, got %v", got.Adjustments)
		})
	}
}

func TestNormalize_CategoryIsCaseAndSpaceInsensitive(t *testing.T) {
	e := validEntry()
	e.Category = "  LOCATION  "
	got := normalizeOne(t, e)

	assert.Equal(t, CategoryLocation, got.Entry.Category)
	assert.Empty(t, got.Adjustments, "a recognisable category should not be reported as changed")
}

func TestNormalize_ForcesPositionAndRecursionPerCategory(t *testing.T) {
	for _, category := range Categories() {
		t.Run(category, func(t *testing.T) {
			want, ok := CategoryDefaults(category)
			require.True(t, ok)

			e := validEntry()
			e.Category = category
			// Deliberately wrong values, as a non-compliant model would emit.
			e.Position = 2
			e.PreventRecursion = !want.PreventRecursion

			got := normalizeOne(t, e)

			assert.Equal(t, want.Position, got.Entry.Position)
			assert.Equal(t, want.PreventRecursion, got.Entry.PreventRecursion)
			assert.True(t, hasAdjustment(got.Adjustments, "position"))
			assert.True(t, hasAdjustment(got.Adjustments, "recursion prevention"))
		})
	}
}

func TestNormalize_RejectsGenericKeywords(t *testing.T) {
	e := validEntry()
	e.Key = []string{"sword", "house", "the", "Rusty Flagon"}

	got := normalizeOne(t, e)

	assert.Equal(t, []string{"Rusty Flagon"}, got.Entry.Key)
	assert.True(t, hasAdjustment(got.Adjustments, "dropped generic keywords"))
}

func TestNormalize_KeepsQualifiedMultiWordKeys(t *testing.T) {
	// The spec treats bare "queen" as generic but "the Queen" as valid:
	// qualifying a word is what makes it specific enough to match on.
	e := validEntry()
	e.Key = []string{"queen", "the Queen", "Queen Elara", "Patches' place"}

	got := normalizeOne(t, e)

	assert.Equal(t, []string{"the Queen", "Queen Elara", "Patches' place"}, got.Entry.Key)
}

func TestNormalize_DropsEmptyAndDuplicateKeys(t *testing.T) {
	e := validEntry()
	e.Key = []string{"Denerim", "  ", "denerim", "DENERIM", "the capital"}

	got := normalizeOne(t, e)

	assert.Equal(t, []string{"Denerim", "the capital"}, got.Entry.Key)
}

func TestNormalize_CapsKeysAtMax(t *testing.T) {
	e := validEntry()
	e.Key = []string{"Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf"}

	got := normalizeOne(t, e)

	assert.Len(t, got.Entry.Key, MaxKeys)
	assert.Equal(t, []string{"Alpha", "Bravo", "Charlie", "Delta", "Echo"}, got.Entry.Key)
	assert.True(t, hasAdjustment(got.Adjustments, "kept the first 5"))
}

func TestNormalize_ReportsTooFewKeysWithoutInventingAny(t *testing.T) {
	t.Run("one key", func(t *testing.T) {
		e := validEntry()
		e.Key = []string{"Denerim"}
		got := normalizeOne(t, e)

		assert.Equal(t, []string{"Denerim"}, got.Entry.Key, "the key must not be altered")
		assert.True(t, hasAdjustment(got.Adjustments, "only 1 keyword"))
	})

	t.Run("no usable keys", func(t *testing.T) {
		e := validEntry()
		e.Key = []string{"the", "house"}
		got := normalizeOne(t, e)

		assert.Empty(t, got.Entry.Key)
		assert.True(t, hasAdjustment(got.Adjustments, "can never trigger"))
	})
}

func TestNormalize_SelectiveRequiresSecondaryKeys(t *testing.T) {
	t.Run("cleared when secondary is empty", func(t *testing.T) {
		e := validEntry()
		e.Selective = true
		got := normalizeOne(t, e)

		assert.False(t, got.Entry.Selective)
		assert.True(t, hasAdjustment(got.Adjustments, "selective turned off"))
	})

	t.Run("kept when secondary is present", func(t *testing.T) {
		e := validEntry()
		e.Selective = true
		e.KeySecondary = []string{"Grey Warden"}
		got := normalizeOne(t, e)

		assert.True(t, got.Entry.Selective)
		assert.False(t, hasAdjustment(got.Adjustments, "selective turned off"))
	})
}

func TestNormalize_ConstantForcedByCategory(t *testing.T) {
	t.Run("rules become always-on", func(t *testing.T) {
		e := validEntry()
		e.Category = CategoryRule
		e.Constant = false
		got := normalizeOne(t, e)

		assert.True(t, got.Entry.Constant)
	})

	t.Run("non-rules are demoted", func(t *testing.T) {
		e := validEntry()
		e.Category = CategoryLocation
		e.Constant = true
		got := normalizeOne(t, e)

		assert.False(t, got.Entry.Constant, "only rules are always-on")
		assert.True(t, hasAdjustment(got.Adjustments, "always-on"))
	})
}

func TestNormalize_ConstantCapCountsExistingEntries(t *testing.T) {
	rule := func(uid int) Entry {
		e := validEntry()
		e.UID = uid
		e.Category = CategoryRule
		return e
	}

	t.Run("cap applies within a batch", func(t *testing.T) {
		out := Normalize([]Entry{rule(1), rule(2), rule(3), rule(4)}, 0)

		var on int
		for _, r := range out {
			if r.Entry.Constant {
				on++
			}
		}
		assert.Equal(t, MaxConstants, on)
		assert.True(t, hasAdjustment(out[3].Adjustments, "limit 3"))
	})

	t.Run("existing constants consume the budget", func(t *testing.T) {
		out := Normalize([]Entry{rule(1)}, MaxConstants)

		assert.False(t, out[0].Entry.Constant)
		assert.True(t, hasAdjustment(out[0].Adjustments, "already has 3"))
	})
}

func TestNormalize_RulePrefix(t *testing.T) {
	t.Run("added when missing", func(t *testing.T) {
		e := validEntry()
		e.Category = CategoryRule
		e.Content = "Magic cannot raise the dead."
		got := normalizeOne(t, e)

		assert.Equal(t, RulePrefix+"Magic cannot raise the dead.", got.Entry.Content)
		assert.True(t, hasAdjustment(got.Adjustments, "rule:"))
	})

	t.Run("not doubled when present", func(t *testing.T) {
		e := validEntry()
		e.Category = CategoryRule
		e.Content = RulePrefix + "Magic cannot raise the dead."
		got := normalizeOne(t, e)

		assert.Equal(t, RulePrefix+"Magic cannot raise the dead.", got.Entry.Content)
	})

	t.Run("not applied to other categories", func(t *testing.T) {
		e := validEntry()
		e.Category = CategoryLocation
		e.Content = "A quiet town."
		got := normalizeOne(t, e)

		assert.Equal(t, "A quiet town.", got.Entry.Content)
	})
}

func TestNormalize_ContentTrimmedAndEmptyReported(t *testing.T) {
	e := validEntry()
	e.Content = "   \n  "
	got := normalizeOne(t, e)

	assert.Equal(t, "", got.Entry.Content)
	assert.True(t, hasAdjustment(got.Adjustments, "empty content"))
}

func TestNormalize_OversizedContentIsFlaggedNotTruncated(t *testing.T) {
	long := strings.Repeat("word ", 400)
	e := validEntry()
	e.Content = long

	// A counter that reports one token per word, so the assertion does not
	// depend on the default estimate's character ratio.
	out := NormalizeWith([]Entry{e}, 0, func(s string) int { return len(strings.Fields(s)) })
	require.Len(t, out, 1)

	assert.Equal(t, strings.TrimSpace(long), out[0].Entry.Content, "content must not be cut")
	assert.True(t, hasAdjustment(out[0].Adjustments, "over the 200-token guideline"))
}

func TestNormalizeWith_NilCounterFallsBackToTheEstimate(t *testing.T) {
	e := validEntry()
	out := NormalizeWith([]Entry{e}, 0, nil)
	require.Len(t, out, 1)
	assert.Equal(t, e.Content, out[0].Entry.Content)
}

func TestNormalize_OutOfRangeOrderMovedToCategoryTier(t *testing.T) {
	tests := []struct {
		name  string
		order int
	}{
		{"above every tier", 5000},
		{"below every tier", 3},
		{"zero", 0},
		{"negative", -20},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			e := validEntry()
			e.Order = tc.order
			got := normalizeOne(t, e)

			tier, ok := TierFor(got.Entry.Order)
			assert.True(t, ok, "order %d is still outside every tier", got.Entry.Order)
			assert.Equal(t, TierStandard.Name, tier.Name, "location entries default to standard")
			assert.True(t, hasAdjustment(got.Adjustments, "outside every priority tier"))
		})
	}
}

func TestNormalize_InRangeOrderIsLeftAlone(t *testing.T) {
	e := validEntry()
	e.Order = 640
	got := normalizeOne(t, e)

	assert.Equal(t, 640, got.Entry.Order)
	assert.False(t, hasAdjustment(got.Adjustments, "order"))
}

func TestNormalize_RedistributesClusteredOrders(t *testing.T) {
	// The characteristic model failure: every entry stamped with the same
	// order, which leaves nothing to prioritise when the context fills up.
	entries := make([]Entry, 5)
	for i := range entries {
		e := validEntry()
		e.UID = i + 1
		e.Order = 100
		entries[i] = e
	}

	out := Normalize(entries, 0)

	seen := make(map[int]bool)
	for _, r := range out {
		assert.False(t, seen[r.Entry.Order], "order %d assigned twice", r.Entry.Order)
		seen[r.Entry.Order] = true

		tier, ok := TierFor(r.Entry.Order)
		assert.True(t, ok, "redistributed order %d fell outside every tier", r.Entry.Order)
		assert.Equal(t, TierStandard.Name, tier.Name)
		assert.True(t, hasAdjustment(r.Adjustments, "spread across the standard tier"))
	}
}

func TestNormalize_RedistributionFollowsCategory(t *testing.T) {
	// Clustered entries are spread into the tier their category implies, so
	// the redistribution reflects what the entries actually are.
	mk := func(uid int, category string) Entry {
		e := validEntry()
		e.UID = uid
		e.Category = category
		e.Order = 100
		return e
	}
	out := Normalize([]Entry{
		mk(1, CategoryRule),
		mk(2, CategoryRule),
		mk(3, CategoryItem),
		mk(4, CategoryItem),
	}, 0)

	wantTier := map[int]string{1: TierNuclear.Name, 2: TierNuclear.Name, 3: TierBackground.Name, 4: TierBackground.Name}
	for _, r := range out {
		tier, ok := TierFor(r.Entry.Order)
		require.True(t, ok)
		assert.Equal(t, wantTier[r.Entry.UID], tier.Name, "uid %d landed in %s", r.Entry.UID, tier.Name)
	}
}

func TestNormalize_DoesNotRedistributeDeliberateSpread(t *testing.T) {
	orders := []int{950, 600, 300, 150, 60}
	entries := make([]Entry, len(orders))
	for i, o := range orders {
		e := validEntry()
		e.UID = i + 1
		e.Order = o
		entries[i] = e
	}

	out := Normalize(entries, 0)

	for i, r := range out {
		assert.Equal(t, orders[i], r.Entry.Order, "a spread batch must be left alone")
	}
}

func TestNormalize_SmallBatchesAreNotRedistributed(t *testing.T) {
	// Two entries sharing an order is a tie, not a collapsed priority signal.
	entries := []Entry{validEntry(), validEntry()}
	out := Normalize(entries, 0)

	for _, r := range out {
		assert.Equal(t, 150, r.Entry.Order)
	}
}

func TestNormalize_BackfillsOmittedDefaults(t *testing.T) {
	e := Entry{UID: 1, Category: CategoryConcept, Key: []string{"Blight", "the Blight"}, Content: "x", Order: 150}
	got := normalizeOne(t, e)

	assert.Equal(t, 100, got.Entry.Probability)
	assert.Equal(t, 4, got.Entry.Depth)
	assert.True(t, got.Entry.UseProbability)
	assert.True(t, got.Entry.AddMemo)
}

func TestNormalize_NilSlicesBecomeEmptyForJSON(t *testing.T) {
	// The frontend indexes these directly, so they must marshal as [] not null.
	e := Entry{UID: 1, Category: CategoryConcept, Content: "x", Order: 150}
	got := normalizeOne(t, e)

	assert.NotNil(t, got.Entry.Key)
	assert.NotNil(t, got.Entry.KeySecondary)
	assert.NotNil(t, got.Entry.Characters)

	data := marshalEntry(t, got.Entry)
	assert.Contains(t, string(data), `"key":[]`)
	assert.Contains(t, string(data), `"characters":[]`)
	assert.NotContains(t, string(data), "null")
}

func TestNormalize_PreservesIdentityFields(t *testing.T) {
	e := validEntry()
	e.UID = 42
	e.SourceURL = "https://w.fandom.com/wiki/Flagon"
	e.Characters = []string{"1", "3"}
	got := normalizeOne(t, e)

	assert.Equal(t, 42, got.Entry.UID)
	assert.Equal(t, "https://w.fandom.com/wiki/Flagon", got.Entry.SourceURL)
	assert.Equal(t, []string{"1", "3"}, got.Entry.Characters)
	assert.Equal(t, "The Rusty Flagon", got.Entry.Comment)
}

func TestNormalize_EmptyInput(t *testing.T) {
	assert.Empty(t, Normalize(nil, 0))
	assert.Empty(t, Normalize([]Entry{}, 0))
}

func TestCountConstants(t *testing.T) {
	assert.Equal(t, 0, CountConstants(nil))
	assert.Equal(t, 2, CountConstants([]Entry{
		{Constant: true}, {Constant: false}, {Constant: true},
	}))
}
