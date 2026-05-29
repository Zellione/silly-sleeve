package main

import (
	"context"
	"fmt"
	"sync"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/settings"
)

// App struct
type App struct {
	ctx          context.Context
	settings     settings.Settings
	mu           sync.Mutex
	cachedCrawl  *crawler.CrawlResult
	characters   []compose.Character
	activeCharID int
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

	a.characters = []compose.Character{compose.NewCharacter(1)}
	a.activeCharID = 1
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

// GetCharacters returns all characters in the current project.
func (a *App) GetCharacters() []compose.Character {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.characters
}

// AddCharacter creates a new character and returns it.
func (a *App) AddCharacter() compose.Character {
	a.mu.Lock()
	defer a.mu.Unlock()
	nextID := a.nextCharID()
	ch := compose.NewCharacter(nextID)
	a.characters = append(a.characters, ch)
	a.activeCharID = nextID
	return ch
}

// UpdateCharacter replaces a character by ID with the given data.
func (a *App) UpdateCharacter(ch compose.Character) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, c := range a.characters {
		if c.ID == ch.ID {
			a.characters[i] = ch
			return nil
		}
	}
	return fmt.Errorf("character %d not found", ch.ID)
}

// DeleteCharacter removes a character by ID.
func (a *App) DeleteCharacter(id int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.characters) <= 1 {
		return fmt.Errorf("cannot delete the last character")
	}
	for i, c := range a.characters {
		if c.ID == id {
			a.characters = append(a.characters[:i], a.characters[i+1:]...)
			if a.activeCharID == id {
				if i >= len(a.characters) {
					a.activeCharID = a.characters[0].ID
				} else {
					a.activeCharID = a.characters[i].ID
				}
			}
			return nil
		}
	}
	return fmt.Errorf("character %d not found", id)
}

// GetActiveCharacter returns the currently active character.
func (a *App) GetActiveCharacter() compose.Character {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, c := range a.characters {
		if c.ID == a.activeCharID {
			return c
		}
	}
	return compose.Character{}
}

// SetActiveCharacter switches the active character by ID.
func (a *App) SetActiveCharacter(id int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.activeCharID = id
}

// CountTokens returns the approximate token count for text.
func (a *App) CountTokens(text string) int {
	return compose.CountTokens(text)
}

func (a *App) nextCharID() int {
	max := 0
	for _, c := range a.characters {
		if c.ID > max {
			max = c.ID
		}
	}
	return max + 1
}
