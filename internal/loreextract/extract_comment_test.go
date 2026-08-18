package loreextract

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Local models drift on the title field's name despite the prompt asking for
// "comment"; the parser accepts the common aliases so entries never arrive
// untitled.

func TestExtract_AcceptsTitleAliasForComment(t *testing.T) {
	resp := `{"entries":[{"category":"location","title":"Denerim","key":["Denerim","the capital"],
	 "content":"Denerim sprawls along the coast, smoke and salt on the wind.","order":320}]}`
	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Denerim", got[0].Entry.Comment)
}

func TestExtract_AcceptsNameAliasForComment(t *testing.T) {
	resp := `{"entries":[{"category":"location","name":"Denerim","key":["Denerim","the capital"],
	 "content":"Denerim sprawls along the coast, smoke and salt on the wind.","order":320}]}`
	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Denerim", got[0].Entry.Comment)
}

func TestExtract_CommentWinsOverAliases(t *testing.T) {
	resp := `{"entries":[{"category":"location","comment":"Denerim","title":"Wrong","name":"Also wrong",
	 "key":["Denerim","the capital"],
	 "content":"Denerim sprawls along the coast, smoke and salt on the wind.","order":320}]}`
	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Denerim", got[0].Entry.Comment)
}
