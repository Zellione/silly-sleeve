package main

import (
	"testing"

	"github.com/stretchr/testify/assert"

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
