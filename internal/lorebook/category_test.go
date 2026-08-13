package lorebook

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func marshalEntry(t *testing.T, e Entry) []byte {
	t.Helper()
	data, err := json.Marshal(e)
	require.NoError(t, err)
	return data
}

func TestCategoryDefaults_MatchesSpec(t *testing.T) {
	tests := []struct {
		category         string
		position         int
		preventRecursion bool
		constant         bool
	}{
		{CategoryCharacter, PositionAfterCharDefs, true, false},
		{CategoryLocation, PositionBeforeCharDefs, false, false},
		{CategoryOrganization, PositionBeforeCharDefs, false, false},
		{CategoryItem, PositionBeforeCharDefs, true, false},
		{CategoryRule, PositionAuthorsNote, true, true},
		{CategoryEvent, PositionAtDepth, true, false},
		{CategoryConcept, PositionBeforeCharDefs, false, false},
	}

	for _, tc := range tests {
		t.Run(tc.category, func(t *testing.T) {
			s, ok := CategoryDefaults(tc.category)
			require.True(t, ok, "category should be recognised")
			assert.Equal(t, tc.position, s.Position)
			assert.Equal(t, tc.preventRecursion, s.PreventRecursion)
			assert.Equal(t, tc.constant, s.Constant)
			assert.NotEmpty(t, s.ContentHint, "every category needs prompt guidance")
		})
	}
}

func TestCategoryDefaults_UnknownFallsBackToConcept(t *testing.T) {
	concept, _ := CategoryDefaults(CategoryConcept)

	for _, name := range []string{"", "nonsense", "Character"} {
		s, ok := CategoryDefaults(name)
		assert.False(t, ok, "%q should not be recognised", name)
		assert.Equal(t, concept, s, "%q should fall back to concept settings", name)
	}
}

func TestCategories_CoversEverySettingsEntry(t *testing.T) {
	assert.Len(t, Categories(), len(categorySettings))
	for _, c := range Categories() {
		_, ok := CategoryDefaults(c)
		assert.True(t, ok, "%q listed but has no settings", c)
		assert.NotEqual(t, c, CategoryLabel(c), "%q has no display label", c)
	}
}

func TestCategoryLabel_UnknownReturnsInput(t *testing.T) {
	assert.Equal(t, "mystery", CategoryLabel("mystery"))
}

func TestTiers_AreContiguousAndDescending(t *testing.T) {
	tiers := Tiers()
	require.NotEmpty(t, tiers)

	for i, tier := range tiers {
		assert.Less(t, tier.Min, tier.Max, "%s has an inverted range", tier.Name)
		if i > 0 {
			prev := tiers[i-1]
			assert.Equal(t, prev.Min-1, tier.Max,
				"%s should end exactly where %s begins", tier.Name, prev.Name)
		}
	}
}

func TestTierFor(t *testing.T) {
	tests := []struct {
		order int
		want  string
		found bool
	}{
		{950, "nuclear", true},
		{900, "nuclear", true},
		{899, "critical", true},
		{300, "high", true},
		{100, "standard", true},
		{75, "background", true},
		{10, "flavor", true},
		{9, "", false},
		{0, "", false},
		{1000, "", false},
		{-5, "", false},
	}

	for _, tc := range tests {
		tier, ok := TierFor(tc.order)
		assert.Equal(t, tc.found, ok, "order %d", tc.order)
		assert.Equal(t, tc.want, tier.Name, "order %d", tc.order)
	}
}

func TestTierMid_LandsInsideTheTier(t *testing.T) {
	for _, tier := range Tiers() {
		mid := tier.Mid()
		assert.GreaterOrEqual(t, mid, tier.Min, "%s midpoint below range", tier.Name)
		assert.LessOrEqual(t, mid, tier.Max, "%s midpoint above range", tier.Name)
	}
}

func TestEntry_CategoryOmittedWhenEmpty(t *testing.T) {
	// Entries predating the category field must not gain a "category" key on
	// export, so existing world_info files round-trip unchanged.
	data := marshalEntry(t, NewEntry(1))
	assert.NotContains(t, string(data), "category")

	e := NewEntry(2)
	e.Category = CategoryLocation
	assert.Contains(t, string(marshalEntry(t, e)), `"category":"location"`)
}
