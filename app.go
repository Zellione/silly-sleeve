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

// CrawlPage fetches a wiki page via the MediaWiki API and returns parsed content.
func (a *App) CrawlPage(pageURL string, opts crawler.CrawlOptions) crawler.CrawlResult {
	result := crawler.FetchPage(pageURL)
	if result.Error != nil {
		return crawler.CrawlResult{
			URL:        pageURL,
			Domain:     result.Domain,
			StatusCode: 0,
			LatencyMs:  result.LatencyMs,
		}
	}
	sections, infobox := crawler.SectionsFromRawHTML(result.RawHTML)
	return crawler.CrawlResult{
		Title:      result.Title,
		URL:        pageURL,
		Domain:     result.Domain,
		RawHTML:    result.RawHTML,
		Sections:   sections,
		Infobox:    infobox,
		WordCount:  crawler.TotalWordCount(sections, infobox),
		StatusCode: 200,
		LatencyMs:  result.LatencyMs,
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
