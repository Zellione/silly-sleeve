package app

import (
	"context"
	"testing"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/prompts"
	"silly-sleeve/internal/settings"

	"github.com/stretchr/testify/assert"
)

func TestEndpointForSlot_Precedence(t *testing.T) {
	a := &App{
		settings: settings.Settings{
			Endpoints: []settings.LLMEndpoint{
				{ID: 1, Name: "default", URL: "http://default", IsDefault: true},
				{ID: 2, Name: "global", URL: "http://global"},
				{ID: 3, Name: "project", URL: "http://project"},
			},
			FieldEndpoints: map[string]int{"backstory": 2},
		},
		fieldEndpoints: map[string]int{"backstory": 3},
	}

	// Project override wins.
	assert.Equal(t, 3, a.endpointForSlot("backstory").ID)

	// Falls back to global default when no project override.
	a.fieldEndpoints = nil
	assert.Equal(t, 2, a.endpointForSlot("backstory").ID)

	// Falls back to the default endpoint when no global default.
	a.settings.FieldEndpoints = nil
	assert.Equal(t, 1, a.endpointForSlot("backstory").ID)
}

func TestEndpointForSlot_DanglingIDFallsThrough(t *testing.T) {
	a := &App{
		settings: settings.Settings{
			Endpoints:      []settings.LLMEndpoint{{ID: 1, URL: "http://default", IsDefault: true}},
			FieldEndpoints: map[string]int{"tags": 99}, // endpoint deleted
		},
		fieldEndpoints: map[string]int{"tags": 77}, // endpoint deleted
	}
	assert.Equal(t, 1, a.endpointForSlot("tags").ID)
}

func TestSetAndGetProjectFieldEndpoint(t *testing.T) {
	a := &App{}

	a.SetProjectFieldEndpoint("tags", 5)
	assert.Equal(t, map[string]int{"tags": 5}, a.GetProjectFieldEndpoints())

	// id <= 0 clears the slot.
	a.SetProjectFieldEndpoint("tags", 0)
	assert.Empty(t, a.GetProjectFieldEndpoints())
}

func TestGetProjectFieldEndpoints_ReturnsCopy(t *testing.T) {
	a := &App{fieldEndpoints: map[string]int{"bulk": 1}}
	got := a.GetProjectFieldEndpoints()
	got["bulk"] = 999 // mutating the returned map must not affect App state
	assert.Equal(t, 1, a.fieldEndpoints["bulk"])
}

type recordingCompleter struct{ gotURL string }

func (r *recordingCompleter) Complete(_ context.Context, ep llm.LLMEndpoint, _, _ string) (string, error) {
	r.gotURL = ep.URL
	return "Generated appearance text.", nil
}

func TestGenerateField_UsesResolvedEndpoint(t *testing.T) {
	rec := &recordingCompleter{}
	a := &App{
		settings: settings.Settings{
			Endpoints: []settings.LLMEndpoint{
				{ID: 1, URL: "http://default", IsDefault: true},
				{ID: 2, URL: "http://override"},
			},
			FieldEndpoints:  map[string]int{"appearance": 2},
			PromptTemplates: prompts.Defaults(),
		},
		cachedCrawl: &crawler.CrawlResult{
			Title: "Test Character",
			URL:   "https://example.com/test",
		},
		characters:   []compose.Character{compose.NewCharacter(1)},
		activeCharID: 1,
	}
	a.charGen = &CharacterGenerator{
		ctx:       func() context.Context { return context.Background() },
		completer: rec,
	}

	a.GenerateField("appearance", "")
	assert.Equal(t, "http://override", rec.gotURL)
}
