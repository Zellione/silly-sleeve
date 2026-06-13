package main

import (
	"testing"

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
