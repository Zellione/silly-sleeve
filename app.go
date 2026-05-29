package main

import (
	"context"
	"fmt"
	"sync"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/settings"
)

// App struct
type App struct {
	ctx         context.Context
	settings    settings.Settings
	mu          sync.Mutex
	cachedCrawl *crawler.CrawlResult
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

	c, err := crawler.LoadCache()
	if err != nil {
		fmt.Println("cache load error:", err)
	}
	if c != nil {
		a.mu.Lock()
		a.cachedCrawl = c
		a.mu.Unlock()
	}
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
	sections, infobox := crawler.SectionsFromRawHTML(result.RawHTML, opts.Include)
	cr := crawler.CrawlResult{
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
	a.mu.Lock()
	a.cachedCrawl = &cr
	a.mu.Unlock()
	if err := crawler.SaveCache(cr); err != nil {
		fmt.Println("cache save error:", err)
	}
	return cr
}

// GetCachedCrawl returns the previously cached crawl result, if any.
func (a *App) GetCachedCrawl() *crawler.CrawlResult {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cachedCrawl
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
