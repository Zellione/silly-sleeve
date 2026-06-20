package app

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
)

func newSendApp() *App {
	app := NewApp()
	app.characters = []compose.Character{compose.NewCharacter(1)} // existing untitled
	app.cachedCrawlSet = &crawler.CrawlSet{Results: []crawler.CrawlResult{
		{URL: "https://w/wiki/Hero", Title: "Hero", Sections: []crawler.Section{{Body: "hero bio"}}},
		{URL: "https://w/wiki/Lore", Title: "Lore", Sections: []crawler.Section{{Body: "world lore"}}},
	}}
	return app
}

func TestSendCrawlResult_CreatesCharacterAndLorebook(t *testing.T) {
	app := newSendApp()

	ch := app.SendCrawlResult("https://w/wiki/Hero", "character", false)
	assert.Equal(t, "created", ch.Status)
	assert.Equal(t, "character", ch.Kind)

	var hero *compose.Character
	for i := range ch.Result.Characters {
		if ch.Result.Characters[i].SourceURL == "https://w/wiki/Hero" {
			hero = &ch.Result.Characters[i]
		}
	}
	require.NotNil(t, hero)
	assert.Equal(t, "Hero", hero.Name)

	lb := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false)
	assert.Equal(t, "created", lb.Status)
	require.Len(t, lb.Result.Lorebook, 1)
	assert.Equal(t, "https://w/wiki/Lore", lb.Result.Lorebook[0].SourceURL)
	assert.Contains(t, lb.Result.Lorebook[0].Content, "world lore")
}

func TestGetCrawlForCharacter_TracksRequestedCharacterSource(t *testing.T) {
	app := newSendApp()

	// Send two distinct pages as separate characters; each gets its own SourceURL.
	require.Equal(t, "created", app.SendCrawlResult("https://w/wiki/Hero", "character", false).Status)
	require.Equal(t, "created", app.SendCrawlResult("https://w/wiki/Lore", "character", false).Status)

	var hero, lore compose.Character
	for _, c := range app.characters {
		switch c.SourceURL {
		case "https://w/wiki/Hero":
			hero = c
		case "https://w/wiki/Lore":
			lore = c
		}
	}
	require.NotZero(t, hero.ID)
	require.NotZero(t, lore.ID)

	// The source panel must follow the requested character, not always the root.
	gotHero := app.GetCrawlForCharacter(hero.ID)
	require.NotNil(t, gotHero)
	assert.Equal(t, "Hero", gotHero.Title)

	gotLore := app.GetCrawlForCharacter(lore.ID)
	require.NotNil(t, gotLore)
	assert.Equal(t, "Lore", gotLore.Title)
}

func TestSendCrawlResult_DuplicateCharacterNeedsConfirmThenOverwrites(t *testing.T) {
	app := newSendApp()

	first := app.SendCrawlResult("https://w/wiki/Hero", "character", false)
	require.Equal(t, "created", first.Status)
	assert.Len(t, first.Result.Characters, 2) // untitled + Hero

	// Same name again -> needs confirmation, no new character appended.
	dup := app.SendCrawlResult("https://w/wiki/Hero", "character", false)
	assert.Equal(t, "needs_confirm", dup.Status)
	assert.Equal(t, "Hero", dup.Name)
	assert.Empty(t, dup.Result.Characters, "no project state returned until confirmed")
	assert.Len(t, app.characters, 2, "no duplicate appended")

	// Confirm -> overwrites in place, still no duplicate.
	ow := app.SendCrawlResult("https://w/wiki/Hero", "character", true)
	assert.Equal(t, "overwritten", ow.Status)
	assert.Len(t, ow.Result.Characters, 2)
}

func TestSendCrawlResult_DuplicateLorebookNeedsConfirmThenOverwrites(t *testing.T) {
	app := newSendApp()

	require.Equal(t, "created", app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false).Status)

	dup := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false)
	assert.Equal(t, "needs_confirm", dup.Status)
	assert.Equal(t, "lorebook", dup.Kind)
	assert.Len(t, app.lorebookEntries, 1, "no duplicate appended")

	ow := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", true)
	assert.Equal(t, "overwritten", ow.Status)
	assert.Len(t, ow.Result.Lorebook, 1)
}

func TestSendCrawlResult_MissingPageOrRole(t *testing.T) {
	app := newSendApp()
	assert.Equal(t, "missing", app.SendCrawlResult("https://w/wiki/Nope", "character", false).Status)
	assert.Equal(t, "missing", app.SendCrawlResult("https://w/wiki/Hero", "bogus", false).Status)
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
	app.SaveCrawlState(CrawlState{
		URL: "https://w/wiki/A", FollowLinks: 2,
		Roles: map[string]string{"https://w/wiki/A": "lorebook"},
		Sent:  map[string]string{"https://w/wiki/A": "lorebook"},
	})

	app.ClearCrawl()

	got := app.GetCrawlState()
	assert.Nil(t, got.Set)
	assert.Empty(t, got.Roles)
	assert.Empty(t, got.Sent)
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
		Sent:        map[string]string{"https://w/wiki/A": "character"},
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
	assert.Equal(t, "character", got.Sent["https://w/wiki/A"])
	require.NotNil(t, got.Set)
	assert.Equal(t, "A", got.Set.Results[0].Title)
}
