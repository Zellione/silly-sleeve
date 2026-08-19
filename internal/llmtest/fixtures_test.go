package llmtest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
)

func TestFixtureCrawl_HasUsableContent(t *testing.T) {
	crawl := FixtureCrawl()

	assert.NotEmpty(t, crawl.Title)
	assert.NotEmpty(t, crawl.URL)
	require.NotEmpty(t, crawl.Sections, "sections drive the crawl context sent to the LLM")
	for _, s := range crawl.Sections {
		assert.NotEmpty(t, s.Heading)
		assert.NotEmpty(t, s.Body)
	}
	assert.NotEmpty(t, crawl.Infobox)
	assert.Positive(t, crawl.WordCount)
}

func TestFixtureCharacters_FirstMatchesFixtureCharacter(t *testing.T) {
	chars := FixtureCharacters()

	require.NotEmpty(t, chars)
	assert.Equal(t, FixtureCharacter(), chars[0])
	for _, ch := range chars {
		assert.NotEmpty(t, ch.Name)
		assert.NotEmpty(t, ch.Appearance, "image prompt scenarios need appearance text")
		assert.NotZero(t, ch.ID)
	}
}

func TestFixtureCharacter_HasFilledRequiredFields(t *testing.T) {
	ch := FixtureCharacter()

	for _, id := range compose.FieldIDs() {
		if compose.FieldRequired(id) && compose.FieldType(id) != "tags" {
			assert.NotEmpty(t, FieldText(ch, id), "required field %s should be filled", id)
		}
	}
}

func TestFixtureEntries_AreConnectable(t *testing.T) {
	entries := FixtureEntries()

	require.GreaterOrEqual(t, len(entries), 3)
	uids := map[int]bool{}
	keyless := 0
	for _, e := range entries {
		assert.False(t, uids[e.UID], "entry UIDs must be unique")
		uids[e.UID] = true
		assert.NotEmpty(t, e.Content)
		assert.NotEmpty(t, e.Comment)
		if len(e.Key) == 0 {
			keyless++
		}
	}
	assert.Positive(t, keyless, "at least one keyless entry gives the connect pass something to fix")
}
