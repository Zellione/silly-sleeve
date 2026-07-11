package compose

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildCardPreview_Fields(t *testing.T) {
	ch := Character{
		Name:         "Alice",
		Appearance:   "Tall.",
		Personality:  "Cheerful.",
		Quotes:       []string{"Hello there!", "Stand back."},
		AltGreetings: []string{"Oh, it's you."},
	}
	p := BuildCardPreview(ch)

	assert.Equal(t, BuildCardFields(ch), p.Fields)
}

func TestBuildCardPreview_TokenCounts(t *testing.T) {
	ch := Character{
		Name:        "Alice",
		Appearance:  "Tall.",
		Personality: "Cheerful and brave.",
		Quotes:      []string{"Hello there!", "Stand back.", "Never again."},
	}
	f := BuildCardFields(ch)
	p := BuildCardPreview(ch)

	assert.Equal(t, CountTokens(f.Description), p.Tokens.Description)
	assert.Equal(t, CountTokens(f.Personality), p.Tokens.Personality)
	assert.Equal(t, CountTokens(f.Scenario), p.Tokens.Scenario)
	assert.Equal(t, CountTokens(f.MesExample), p.Tokens.Examples)
	assert.Equal(t, p.Tokens.Description+p.Tokens.Personality+p.Tokens.Scenario+p.Tokens.Examples, p.Tokens.Total)
	assert.Greater(t, p.Tokens.Total, 0)
}

func TestBuildCardPreview_EmptyCharacter(t *testing.T) {
	p := BuildCardPreview(Character{})
	assert.Equal(t, 0, p.Tokens.Total)
	assert.Equal(t, 0, p.Tokens.Description)
	assert.Equal(t, 0, p.Tokens.Personality)
	assert.Equal(t, 0, p.Tokens.Scenario)
	assert.Equal(t, 0, p.Tokens.Examples)
}
