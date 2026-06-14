package main

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
)

func TestSendCrawlToProject_CreatesStubs(t *testing.T) {
	app := NewApp()
	app.characters = []compose.Character{compose.NewCharacter(1)} // existing untitled
	app.cachedCrawlSet = &crawler.CrawlSet{Results: []crawler.CrawlResult{
		{URL: "https://w/wiki/Hero", Title: "Hero", Sections: []crawler.Section{{Body: "hero bio"}}},
		{URL: "https://w/wiki/Lore", Title: "Lore", Sections: []crawler.Section{{Body: "world lore"}}},
		{URL: "https://w/wiki/Skip", Title: "Skip"},
	}}

	res := app.SendCrawlToProject([]CrawlAssignment{
		{URL: "https://w/wiki/Hero", Role: "character"},
		{URL: "https://w/wiki/Lore", Role: "lorebook"},
		{URL: "https://w/wiki/Skip", Role: "skip"},
	})

	var hero *compose.Character
	for i := range res.Characters {
		if res.Characters[i].SourceURL == "https://w/wiki/Hero" {
			hero = &res.Characters[i]
		}
	}
	assert.NotNil(t, hero)
	assert.Equal(t, "Hero", hero.Name)
	assert.Len(t, res.Lorebook, 1)
	assert.Equal(t, "https://w/wiki/Lore", res.Lorebook[0].SourceURL)
	assert.Contains(t, res.Lorebook[0].Content, "world lore")
}

func TestRemoveCrawlResult_DropsPageAndResyncsRoot(t *testing.T) {
	app := NewApp()
	app.cachedCrawlSet = &crawler.CrawlSet{
		RootURL: "https://w/wiki/Root",
		Results: []crawler.CrawlResult{
			{URL: "https://w/wiki/Root", Title: "Root"},
			{URL: "https://w/wiki/B", Title: "B"},
		},
	}
	app.cachedCrawl = &crawler.CrawlResult{URL: "https://w/wiki/Root", Title: "Root"}

	set := app.RemoveCrawlResult("https://w/wiki/Root")
	assert.Len(t, set.Results, 1)
	assert.Equal(t, "https://w/wiki/B", set.Results[0].URL)
	// legacy single cache re-synced to the new root.
	assert.NotNil(t, app.cachedCrawl)
	assert.Equal(t, "https://w/wiki/B", app.cachedCrawl.URL)
}

func TestRemoveCrawlResult_LastPageClearsCache(t *testing.T) {
	app := NewApp()
	app.cachedCrawlSet = &crawler.CrawlSet{
		Results: []crawler.CrawlResult{{URL: "https://w/wiki/Only", Title: "Only"}},
	}
	app.cachedCrawl = &crawler.CrawlResult{URL: "https://w/wiki/Only"}

	set := app.RemoveCrawlResult("https://w/wiki/Only")
	assert.Empty(t, set.Results)
	assert.Nil(t, app.cachedCrawl)
}

func TestRemoveCrawlResult_NoSetReturnsEmpty(t *testing.T) {
	app := NewApp()
	set := app.RemoveCrawlResult("https://w/wiki/Anything")
	assert.Empty(t, set.Results)
}

func TestSaveAndGetCrawlState_RoundTrips(t *testing.T) {
	app := NewApp()
	app.cachedCrawlSet = &crawler.CrawlSet{Results: []crawler.CrawlResult{{URL: "https://w/wiki/A", Title: "A"}}}
	app.SaveCrawlState(CrawlState{
		URL:         "https://w/wiki/A",
		FollowLinks: 2,
		Include:     map[string]bool{"infobox": true},
		Selectors:   ".mw-parser-output > p",
		Roles:       map[string]string{"https://w/wiki/A": "character"},
		Set:         &crawler.CrawlSet{Results: []crawler.CrawlResult{{URL: "ignored"}}}, // Set is ignored on save
	})

	got := app.GetCrawlState()
	assert.Equal(t, "https://w/wiki/A", got.URL)
	assert.Equal(t, 2, got.FollowLinks)
	assert.Equal(t, ".mw-parser-output > p", got.Selectors)
	assert.Equal(t, "character", got.Roles["https://w/wiki/A"])
	// Set comes from cachedCrawlSet, not the saved state.
	assert.NotNil(t, got.Set)
	assert.Equal(t, "A", got.Set.Results[0].Title)
}

func TestClearCrawl_EmptiesListKeepsParams(t *testing.T) {
	app := NewApp()
	app.cachedCrawlSet = &crawler.CrawlSet{Results: []crawler.CrawlResult{{URL: "https://w/wiki/A"}}}
	app.SaveCrawlState(CrawlState{URL: "https://w/wiki/A", FollowLinks: 2, Roles: map[string]string{"https://w/wiki/A": "lorebook"}})

	app.ClearCrawl()

	got := app.GetCrawlState()
	assert.Nil(t, got.Set)
	assert.Empty(t, got.Roles)
	assert.Equal(t, "https://w/wiki/A", got.URL, "params survive a list clear")
	assert.Equal(t, 2, got.FollowLinks)
}

func TestProjectBundle_RestoresCrawlState(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "p.slv")

	app := NewApp()
	app.characters = []compose.Character{compose.NewCharacter(1)}
	app.cachedCrawlSet = &crawler.CrawlSet{
		RootURL: "https://w/wiki/A",
		Results: []crawler.CrawlResult{{URL: "https://w/wiki/A", Title: "A"}},
	}
	app.SaveCrawlState(CrawlState{
		URL:         "https://w/wiki/A",
		FollowLinks: 2,
		Include:     map[string]bool{"infobox": true},
		Selectors:   ".sel",
		Roles:       map[string]string{"https://w/wiki/A": "character"},
	})
	require.NoError(t, app.SaveProjectBundle(path))

	reopened := NewApp()
	_, err := reopened.OpenProjectBundle(path)
	require.NoError(t, err)

	got := reopened.GetCrawlState()
	assert.Equal(t, "https://w/wiki/A", got.URL)
	assert.Equal(t, 2, got.FollowLinks)
	assert.Equal(t, ".sel", got.Selectors)
	assert.True(t, got.Include["infobox"])
	assert.Equal(t, "character", got.Roles["https://w/wiki/A"])
	require.NotNil(t, got.Set)
	assert.Equal(t, "A", got.Set.Results[0].Title)
}
