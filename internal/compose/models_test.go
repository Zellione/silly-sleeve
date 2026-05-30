package compose

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewCharacter_Defaults(t *testing.T) {
	c := NewCharacter(1)
	assert.Equal(t, 1, c.ID)
	assert.Equal(t, "Untitled", c.Name)
	assert.Empty(t, c.Epithet)
	assert.Empty(t, c.Tags)
	assert.Empty(t, c.Appearance)
	assert.Empty(t, c.Personality)
	assert.Empty(t, c.Backstory)
	assert.Empty(t, c.Abilities)
	assert.Empty(t, c.Relationships)
	assert.Equal(t, []string{""}, c.Quotes)
	assert.Len(t, c.Stats, 1)
	assert.Equal(t, "", c.Stats[0].Key)
	assert.Equal(t, "", c.Stats[0].Value)
	assert.False(t, c.Dirty)
}

func TestFieldIDs_Order(t *testing.T) {
	ids := FieldIDs()
	assert.Len(t, ids, 10)
	assert.Equal(t, "name", ids[0])
	assert.Equal(t, "stats", ids[9])
}

func TestFieldLabel_Known(t *testing.T) {
	assert.Equal(t, "Name", FieldLabel("name"))
	assert.Equal(t, "Title / epithet", FieldLabel("epithet"))
	assert.Equal(t, "Appearance", FieldLabel("appearance"))
	assert.Equal(t, "Personality", FieldLabel("personality"))
	assert.Equal(t, "Stat block", FieldLabel("stats"))
}

func TestFieldLabel_Fallback(t *testing.T) {
	assert.Equal(t, "unknown", FieldLabel("unknown"))
}

func TestFieldRequired(t *testing.T) {
	assert.True(t, FieldRequired("name"))
	assert.True(t, FieldRequired("appearance"))
	assert.True(t, FieldRequired("personality"))
	assert.False(t, FieldRequired("epithet"))
	assert.False(t, FieldRequired("tags"))
	assert.False(t, FieldRequired("stats"))
}

func TestFieldType(t *testing.T) {
	assert.Equal(t, "line", FieldType("name"))
	assert.Equal(t, "line", FieldType("epithet"))
	assert.Equal(t, "tags", FieldType("tags"))
	assert.Equal(t, "text", FieldType("appearance"))
	assert.Equal(t, "text", FieldType("personality"))
	assert.Equal(t, "quotes", FieldType("quotes"))
	assert.Equal(t, "stats", FieldType("stats"))
}
