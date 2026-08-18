package lorebook

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalize_DerivesCommentFromFirstKey(t *testing.T) {
	e := validEntry()
	e.Comment = "   "
	got := normalizeOne(t, e)

	assert.Equal(t, "Rusty Flagon", got.Entry.Comment)
	assert.True(t, hasAdjustment(got.Adjustments, "used the first key"),
		"deriving the title must be reported, got: %v", got.Adjustments)
}

func TestNormalize_EmptyCommentWithoutKeysStaysEmpty(t *testing.T) {
	e := validEntry()
	e.Comment = ""
	e.Key = nil
	got := normalizeOne(t, e)

	assert.Equal(t, "", got.Entry.Comment)
	assert.False(t, hasAdjustment(got.Adjustments, "used the first key"))
}
