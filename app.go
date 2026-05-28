package main

import (
	"context"
	"fmt"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/settings"
)

// App struct
type App struct {
	ctx      context.Context
	settings settings.Settings
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	s, err := settings.Load()
	if err != nil {
		fmt.Println("settings load error:", err)
		s = settings.Settings{Endpoints: []settings.LLMEndpoint{}}
	}
	a.settings = s
}

// GetSettings returns the current settings.
func (a *App) GetSettings() settings.Settings {
	return a.settings
}

// SaveSettings persists settings to disk.
func (a *App) SaveSettings(s settings.Settings) error {
	if err := settings.Save(s); err != nil {
		return err
	}
	a.settings = s
	return nil
}

// TestLLMEndpoint verifies connectivity to an LLM endpoint.
func (a *App) TestLLMEndpoint(ep settings.LLMEndpoint) llm.TestResult {
	return llm.TestEndpoint(llm.LLMEndpoint{
		ID:           ep.ID,
		Name:         ep.Name,
		URL:          ep.URL,
		Model:        ep.Model,
		Key:          ep.Key,
		ContextSize:  ep.ContextSize,
		Temperature:  ep.Temperature,
		SystemPrompt: ep.SystemPrompt,
	})
}

var sampleInfobox = []crawler.InfoboxEntry{
	{Key: "race", Value: "Half-elf"},
	{Key: "class", Value: "Bard (College of Lore)"},
	{Key: "allegiance", Value: "The Harpers"},
	{Key: "weapon", Value: "Rapier · \"Songthorn\""},
	{Key: "height", Value: "5'8\" / 173 cm"},
	{Key: "eye color", Value: "Smoke grey"},
	{Key: "hair color", Value: "Auburn, shoulder-length"},
	{Key: "homeland", Value: "Baldur's Gate"},
}

// CrawlPage fetches and parses a wiki page. Returns sample data in this stub.
func (a *App) CrawlPage(url string, opts crawler.CrawlOptions) crawler.CrawlResult {
	return crawler.CrawlResult{
		Title:     "elara_wynd",
		URL:       url,
		Domain:    "baldursgate.fandom.com",
		Sections: []crawler.Section{
			{Heading: "Elara Wynd", Body: "Elara Wynd, called the Crimson Lark by the patrons of the Elfsong, is a half-elf bard who haunts the docks of Baldur's Gate. Once a chorister at the Temple of Lathander, she now collects ballads — and the secrets they carry — for the Harpers.", Level: 1},
			{Heading: "Appearance", Body: "Elara wears a sleeveless leather doublet stained the colour of dried wine, with the sigil of a lark tooled near the collar. Her left ear bears a notched scar from a duel in the Steel Watch barracks. She is rarely seen without her rapier \"Songthorn\" or her quill-case of folded ravensteel.", Level: 2},
			{Heading: "Personality", Body: "Cheerful in public houses, watchful in alleys. Elara collects names the way other bards collect rhymes — she remembers everyone she has met by their first lie. She drinks little, but matches every cup the table sets in front of her, then pours hers into a hidden flask.", Level: 2},
			{Heading: "History", Body: "Born in Reithwin Town the year of the Mind Flayer crisis, Elara survived the early Shadow-curse by sheltering in a wagon of refugees bound for the coast.", Level: 2},
		},
		Infobox:    sampleInfobox,
		WordCount:  1842,
		StatusCode: 200,
		LatencyMs:  412,
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
