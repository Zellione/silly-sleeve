package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/settings"
)

func TestNewApp(t *testing.T) {
	app := NewApp()
	require.NotNil(t, app)
	assert.Nil(t, app.ctx)
	assert.Empty(t, app.settings.Endpoints)
}

func TestGreet(t *testing.T) {
	app := NewApp()
	result := app.Greet("World")
	assert.Equal(t, "Hello World, It's show time!", result)

	result = app.Greet("Foo")
	assert.Equal(t, "Hello Foo, It's show time!", result)
}

func TestStartup_LoadsSettings(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	require.NoError(t, settings.Save(settings.Settings{
		Endpoints: []settings.LLMEndpoint{{ID: 1, Name: "StartupTest"}},
	}))

	app := NewApp()
	app.startup(context.Background())

	assert.NotNil(t, app.ctx)
	require.Len(t, app.settings.Endpoints, 1)
	assert.Equal(t, "StartupTest", app.settings.Endpoints[0].Name)
}

func TestStartup_FallbackOnError(t *testing.T) {
	tmpDir := t.TempDir()
	blockFile := tmpDir + "/block"
	require.NoError(t, os.WriteFile(blockFile, []byte("block"), 0o644))
	t.Setenv("XDG_CONFIG_HOME", blockFile)

	app := NewApp()
	app.startup(context.Background())

	assert.NotNil(t, app.ctx)
	assert.Empty(t, app.settings.Endpoints)
}

func TestGetSettings(t *testing.T) {
	app := NewApp()
	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{{ID: 42, Name: "GetTest"}},
	}

	s := app.GetSettings()
	require.Len(t, s.Endpoints, 1)
	assert.Equal(t, 42, s.Endpoints[0].ID)
}

func TestSaveSettings(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	app := NewApp()
	app.ctx = context.Background()

	s := settings.Settings{
		Endpoints: []settings.LLMEndpoint{{ID: 1, Name: "SaveAppTest"}},
	}
	err := app.SaveSettings(s)
	require.NoError(t, err)

	assert.Equal(t, "SaveAppTest", app.settings.Endpoints[0].Name)

	loaded, err := settings.Load()
	require.NoError(t, err)
	require.Len(t, loaded.Endpoints, 1)
	assert.Equal(t, "SaveAppTest", loaded.Endpoints[0].Name)
}

func TestSaveSettings_ErrorPropagation(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	app := NewApp()
	app.ctx = context.Background()

	// Save first to create dir structure
	require.NoError(t, app.SaveSettings(settings.Settings{
		Endpoints: []settings.LLMEndpoint{{ID: 999}},
	}))

	// Make settings.json a directory so WriteFile fails
	pathFromEnv := tmpDir + "/silly-sleeve/settings.json"
	os.Remove(pathFromEnv)
	require.NoError(t, os.Mkdir(pathFromEnv, 0o555))
	t.Cleanup(func() { os.RemoveAll(pathFromEnv) })

	err := app.SaveSettings(settings.Settings{
		Endpoints: []settings.LLMEndpoint{{ID: 1, Name: "WillFail"}},
	})
	assert.Error(t, err)
}

func TestTestLLMEndpoint_FieldMapping(t *testing.T) {
	var receivedAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(200)
	}))
	defer srv.Close()

	app := NewApp()
	key := "sk-app-test"
	ep := settings.LLMEndpoint{
		ID:           7,
		Name:         "AppMapping",
		URL:          srv.URL,
		Model:        "app-model",
		Key:          &key,
		ContextSize:  16384,
		Temperature:  0.5,
		SystemPrompt: "You are a test.",
		IsDefault:    true,
		Ok:           false,
	}

	result := app.TestLLMEndpoint(ep)
	assert.True(t, result.Ok)
	assert.Greater(t, result.Latency, int64(0))
	assert.Empty(t, result.Error)
	assert.Equal(t, "Bearer sk-app-test", receivedAuth)
}

func TestTestLLMEndpoint_ErrorMapping(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	app := NewApp()
	ep := settings.LLMEndpoint{
		ID:    1,
		URL:   srv.URL,
		Model: "err-model",
	}

	result := app.TestLLMEndpoint(ep)
	assert.False(t, result.Ok)
	assert.Equal(t, "HTTP 500", result.Error)
}

func TestTestLLMEndpoint_NilKey(t *testing.T) {
	var receivedAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(200)
	}))
	defer srv.Close()

	app := NewApp()
	ep := settings.LLMEndpoint{
		ID:    1,
		URL:   srv.URL,
		Model: "model",
		Key:   nil,
	}

	result := app.TestLLMEndpoint(ep)
	assert.True(t, result.Ok)
	assert.Empty(t, receivedAuth)
}

func TestTestLLMEndpoint_ReturnsLLMTestResult(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	app := NewApp()
	ep := settings.LLMEndpoint{
		ID:    1,
		URL:   srv.URL,
		Model: "model",
	}

	result := app.TestLLMEndpoint(ep)
	assert.IsType(t, llm.TestResult{}, result)
	assert.True(t, result.Ok)
}

func TestCrawlPage_ReturnsSampleData(t *testing.T) {
	app := NewApp()
	opts := crawler.CrawlOptions{
		FollowLinks: 0,
		Include:     map[string]bool{"infobox": true},
	}
	result := app.CrawlPage("https://baldursgate.fandom.com/wiki/Test", opts)

	assert.Equal(t, "elara_wynd", result.Title)
	assert.NotEmpty(t, result.URL)
	assert.Equal(t, "baldursgate.fandom.com", result.Domain)
	assert.NotEmpty(t, result.Sections)
	assert.Equal(t, 1842, result.WordCount)
	assert.Equal(t, 200, result.StatusCode)
	assert.Equal(t, int64(412), result.LatencyMs)
}

func TestCrawlPage_UsesProvidedURL(t *testing.T) {
	app := NewApp()
	result := app.CrawlPage("https://custom.wiki.com/wiki/Foo", crawler.CrawlOptions{})

	assert.Equal(t, "https://custom.wiki.com/wiki/Foo", result.URL)
}

func TestCrawlPage_ReturnsInfoboxEntries(t *testing.T) {
	app := NewApp()
	result := app.CrawlPage("", crawler.CrawlOptions{})

	assert.Len(t, result.Infobox, 8)
	assert.Equal(t, "race", result.Infobox[0].Key)
	assert.Equal(t, "Half-elf", result.Infobox[0].Value)
}

func TestCrawlPage_SectionsHaveLevels(t *testing.T) {
	app := NewApp()
	result := app.CrawlPage("", crawler.CrawlOptions{})

	require.Len(t, result.Sections, 4)
	assert.Equal(t, 1, result.Sections[0].Level)
	assert.Equal(t, 2, result.Sections[1].Level)
}
