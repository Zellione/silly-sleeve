package crawler

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseSummaryText_LedeAndSections(t *testing.T) {
	text := "A half-elf bard on the docks.\n\n## Personality\nCheerful in taverns.\n\nWatchful in alleys.\n## History\nBorn in Reithwin."
	got := ParseSummaryText(text)
	require.Len(t, got, 3)
	assert.Equal(t, Section{Heading: "", Body: "A half-elf bard on the docks.", Level: 1}, got[0])
	assert.Equal(t, Section{Heading: "Personality", Body: "Cheerful in taverns.\n\nWatchful in alleys.", Level: 2}, got[1])
	assert.Equal(t, Section{Heading: "History", Body: "Born in Reithwin.", Level: 2}, got[2])
}

func TestParseSummaryText_NoLede(t *testing.T) {
	got := ParseSummaryText("## Only\nbody")
	require.Len(t, got, 1)
	assert.Equal(t, "Only", got[0].Heading)
	assert.Equal(t, "body", got[0].Body)
	assert.Equal(t, 2, got[0].Level)
}

func TestParseSummaryText_EmptyAndWhitespace(t *testing.T) {
	assert.Empty(t, ParseSummaryText(""))
	assert.Empty(t, ParseSummaryText("  \n\n  "))
	// An empty-bodied heading survives (the user may fill it in later).
	got := ParseSummaryText("## Kept")
	require.Len(t, got, 1)
	assert.Equal(t, "Kept", got[0].Heading)
	assert.Equal(t, "", got[0].Body)
}

func TestParseSummaryText_RoundTripsSectionSerialisation(t *testing.T) {
	// The frontend serialises sections as "## Heading\nBody" joined by blank
	// lines; parsing that must reproduce the sections.
	sections := []Section{
		{Heading: "", Body: "Lede paragraph.", Level: 1},
		{Heading: "Personality", Body: "First.\n\nSecond.", Level: 2},
	}
	text := "Lede paragraph.\n\n## Personality\nFirst.\n\nSecond."
	assert.Equal(t, sections, ParseSummaryText(text))
}
