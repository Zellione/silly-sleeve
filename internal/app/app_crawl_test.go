package app

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/loreextract"
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
	assert.Equal(t, "staged", lb.Status)
	assert.Empty(t, lb.Result.Lorebook,
		"a lorebook send must create no entry — the page is staged for extraction first")

	require.Len(t, lb.Result.Staged, 1)
	assert.Equal(t, "https://w/wiki/Lore", lb.Result.Staged[0].URL)
	assert.Equal(t, "Lore", lb.Result.Staged[0].Title)
	assert.Equal(t, loreextract.ModeSplit, lb.Result.Staged[0].Mode, "split is the default mode")
	assert.False(t, lb.Result.Staged[0].Extracted)
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

func TestSendCrawlResult_DuplicateLorebookNeedsConfirmThenRestages(t *testing.T) {
	app := newSendApp()

	require.Equal(t, "staged", app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false).Status)

	dup := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false)
	assert.Equal(t, "needs_confirm", dup.Status)
	assert.Equal(t, "lorebook", dup.Kind)
	assert.Len(t, app.stagedSources, 1, "no duplicate staged")

	ow := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", true)
	assert.Equal(t, "restaged", ow.Status)
	assert.Len(t, ow.Result.Staged, 1)
}

func TestSendCrawlResult_RestagingResetsExtractionState(t *testing.T) {
	// Re-sending a page the user has already extracted must start over rather
	// than leave the old candidates to be approved alongside fresh ones.
	app := newSendApp()
	require.Equal(t, "staged", app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false).Status)

	app.stagedSources[0].Extracted = true
	app.loreCandidates = []loreextract.Candidate{
		{SourceURL: "https://w/wiki/Lore"},
		{SourceURL: "https://w/wiki/Other"},
	}

	require.Equal(t, "restaged", app.SendCrawlResult("https://w/wiki/Lore", "lorebook", true).Status)

	assert.False(t, app.stagedSources[0].Extracted)
	require.Len(t, app.loreCandidates, 1, "only this page's candidates are discarded")
	assert.Equal(t, "https://w/wiki/Other", app.loreCandidates[0].SourceURL)
}

func TestSendCrawlResult_LorebookNeedsConfirmWhenEntriesWereAlreadyApproved(t *testing.T) {
	// The page is no longer staged — its candidates were approved into the
	// lorebook — so the duplicate check has to look at the entries too.
	app := newSendApp()
	app.lorebookEntries = []lorebook.Entry{{UID: 1, Comment: "Lore", SourceURL: "https://w/wiki/Lore"}}

	dup := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false)
	assert.Equal(t, "needs_confirm", dup.Status)
	assert.Empty(t, app.stagedSources)

	again := app.SendCrawlResult("https://w/wiki/Lore", "lorebook", true)
	assert.Equal(t, "staged", again.Status)
	assert.Len(t, app.stagedSources, 1)
	assert.Len(t, app.lorebookEntries, 1, "approved entries are left alone")
}

func TestClearCrawl_DiscardsStagingButKeepsApprovedEntries(t *testing.T) {
	app := newSendApp()
	require.Equal(t, "staged", app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false).Status)
	app.loreCandidates = []loreextract.Candidate{{SourceURL: "https://w/wiki/Lore"}}
	app.lorebookEntries = []lorebook.Entry{{UID: 1, Comment: "Approved"}}

	app.ClearCrawl()

	assert.Empty(t, app.stagedSources, "staging cannot outlive the crawl it reads from")
	assert.Empty(t, app.loreCandidates)
	assert.Len(t, app.lorebookEntries, 1, "approved entries belong to the lorebook now")
}

func TestRemoveCrawlResult_DiscardsThatPagesStaging(t *testing.T) {
	app := newSendApp()
	require.Equal(t, "staged", app.SendCrawlResult("https://w/wiki/Lore", "lorebook", false).Status)
	require.Equal(t, "staged", app.SendCrawlResult("https://w/wiki/Hero", "lorebook", false).Status)
	app.loreCandidates = []loreextract.Candidate{
		{SourceURL: "https://w/wiki/Lore"},
		{SourceURL: "https://w/wiki/Hero"},
	}

	app.RemoveCrawlResult("https://w/wiki/Lore")

	require.Len(t, app.stagedSources, 1)
	assert.Equal(t, "https://w/wiki/Hero", app.stagedSources[0].URL)
	require.Len(t, app.loreCandidates, 1)
	assert.Equal(t, "https://w/wiki/Hero", app.loreCandidates[0].SourceURL)
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
