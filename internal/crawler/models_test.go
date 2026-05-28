package crawler

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCrawlOptions_JSONRoundtrip(t *testing.T) {
	opts := CrawlOptions{
		FollowLinks: 1,
		Include:     map[string]bool{"infobox": true, "quotes": false},
	}
	data, err := json.Marshal(opts)
	require.NoError(t, err)

	var decoded CrawlOptions
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, 1, decoded.FollowLinks)
	assert.True(t, decoded.Include["infobox"])
	assert.False(t, decoded.Include["quotes"])
}

func TestSection_JSONRoundtrip(t *testing.T) {
	s := Section{
		Heading: "Introduction",
		Body:    "Some content",
		Level:   2,
	}
	data, err := json.Marshal(s)
	require.NoError(t, err)

	var decoded Section
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, "Introduction", decoded.Heading)
	assert.Equal(t, "Some content", decoded.Body)
	assert.Equal(t, 2, decoded.Level)
}

func TestInfoboxEntry_JSONRoundtrip(t *testing.T) {
	entry := InfoboxEntry{
		Key:   "race",
		Value: "Half-elf",
	}
	data, err := json.Marshal(entry)
	require.NoError(t, err)

	var decoded InfoboxEntry
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, "race", decoded.Key)
	assert.Equal(t, "Half-elf", decoded.Value)
}

func TestCrawlResult_JSONRoundtrip(t *testing.T) {
	result := CrawlResult{
		Title:     "test_page",
		URL:       "https://example.com/wiki/Test",
		Domain:    "example.com",
		RawHTML:   "<p>hello</p>",
		Sections:  []Section{{Heading: "Intro", Body: "text", Level: 1}},
		Infobox:   []InfoboxEntry{{Key: "type", Value: "character"}},
		WordCount: 42,
		StatusCode: 200,
		LatencyMs:  150,
	}
	data, err := json.Marshal(result)
	require.NoError(t, err)

	var decoded CrawlResult
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, "test_page", decoded.Title)
	assert.Equal(t, "https://example.com/wiki/Test", decoded.URL)
	assert.Equal(t, "example.com", decoded.Domain)
	assert.Equal(t, "<p>hello</p>", decoded.RawHTML)
	require.Len(t, decoded.Sections, 1)
	assert.Equal(t, "Intro", decoded.Sections[0].Heading)
	require.Len(t, decoded.Infobox, 1)
	assert.Equal(t, "type", decoded.Infobox[0].Key)
	assert.Equal(t, 42, decoded.WordCount)
	assert.Equal(t, 200, decoded.StatusCode)
	assert.Equal(t, int64(150), decoded.LatencyMs)
}

func TestCrawlResult_EmptySections(t *testing.T) {
	result := CrawlResult{
		Title: "empty",
	}
	assert.Empty(t, result.Sections)
	assert.Empty(t, result.Infobox)
	assert.Equal(t, 0, result.WordCount)
	assert.Equal(t, 0, result.StatusCode)
}

func TestCrawlOptions_ZeroValue(t *testing.T) {
	opts := CrawlOptions{}
	assert.Equal(t, 0, opts.FollowLinks)
	assert.Nil(t, opts.Include)
}

func TestSection_ZeroValue(t *testing.T) {
	s := Section{}
	assert.Empty(t, s.Heading)
	assert.Empty(t, s.Body)
	assert.Equal(t, 0, s.Level)
}
