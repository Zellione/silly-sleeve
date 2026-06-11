package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/settings"
)

func newTestCharacterGenerator() *CharacterGenerator {
	return &CharacterGenerator{ctx: func() context.Context { return context.Background() }}
}

// chatServer returns an httptest server that replies with a single chat
// completion choice carrying the given content.
func chatServer(t *testing.T, content string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": content}},
			},
		})
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestToLLMEndpoint_MapsAllFields(t *testing.T) {
	key := "secret"
	ep := toLLMEndpoint(settings.LLMEndpoint{
		ID: 1, Name: "local", URL: "http://x", Model: "m",
		Key: &key, ContextSize: 4096, Temperature: 0.7, SystemPrompt: "sys",
	})
	assert.Equal(t, 1, ep.ID)
	assert.Equal(t, "local", ep.Name)
	assert.Equal(t, "http://x", ep.URL)
	assert.Equal(t, "m", ep.Model)
	require.NotNil(t, ep.Key)
	assert.Equal(t, "secret", *ep.Key)
	assert.Equal(t, 4096, ep.ContextSize)
	assert.InDelta(t, 0.7, ep.Temperature, 1e-9)
	assert.Equal(t, "sys", ep.SystemPrompt)
}

func TestCharacterGenerator_GenerateImagePrompt(t *testing.T) {
	srv := chatServer(t, "POSITIVE: 1girl, auburn hair, leather doublet\nNEGATIVE: blurry, lowres")
	gen := newTestCharacterGenerator()

	pos, neg, err := gen.GenerateImagePrompt(
		compose.Character{Name: "Elara", Appearance: "auburn hair"},
		settings.LLMEndpoint{URL: srv.URL},
		"natural",
	)
	require.NoError(t, err)
	assert.Equal(t, "1girl, auburn hair, leather doublet", pos)
	assert.Equal(t, "blurry, lowres", neg)
}

func TestCharacterGenerator_GenerateImagePrompt_FallsBackOnMissingMarkers(t *testing.T) {
	srv := chatServer(t, "a lone wanderer beneath a stormy sky")
	gen := newTestCharacterGenerator()

	pos, neg, err := gen.GenerateImagePrompt(
		compose.Character{Name: "Elara"},
		settings.LLMEndpoint{URL: srv.URL},
		"natural",
	)
	require.NoError(t, err)
	assert.Equal(t, "a lone wanderer beneath a stormy sky", pos, "falls back to raw lines when no POSITIVE marker")
	assert.Equal(t, defaultNegativePrompt, neg, "falls back to the default negative prompt")
}

func TestCharacterGenerator_GenerateImagePrompt_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)
	gen := newTestCharacterGenerator()

	_, _, err := gen.GenerateImagePrompt(compose.Character{Name: "Elara"}, settings.LLMEndpoint{URL: srv.URL}, "natural")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "generate image prompt")
}
