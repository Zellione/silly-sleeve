package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
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

func TestCrawlPage_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"parse": map[string]any{
				"title": "Test_Page",
				"text":  map[string]any{"*": "<p>Hello world from wiki</p>"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	defer srv.Close()

	app := NewApp()
	result := app.CrawlPage(srv.URL+"/wiki/Test_Page", crawler.CrawlOptions{})

	assert.Equal(t, "Test_Page", result.Title)
	assert.Equal(t, srv.URL+"/wiki/Test_Page", result.URL)
	assert.NotEmpty(t, result.Domain)
	assert.Contains(t, result.RawHTML, "Hello world from wiki")
	assert.Equal(t, 200, result.StatusCode)
	assert.GreaterOrEqual(t, result.LatencyMs, int64(0))
	assert.GreaterOrEqual(t, result.WordCount, 0)
}

func TestCrawlPage_Error(t *testing.T) {
	app := NewApp()
	result := app.CrawlPage("://invalid", crawler.CrawlOptions{})

	assert.Equal(t, "://invalid", result.URL)
	assert.Zero(t, result.StatusCode)
	assert.GreaterOrEqual(t, result.LatencyMs, int64(0))
}

func TestCrawlPage_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	app := NewApp()
	result := app.CrawlPage(srv.URL+"/wiki/Test", crawler.CrawlOptions{})

	assert.Zero(t, result.StatusCode)
	assert.NotEmpty(t, result.Domain)
}

func TestGetCachedCrawl_NilByDefault(t *testing.T) {
	app := NewApp()
	assert.Nil(t, app.GetCachedCrawl())
}

func TestCrawlPage_CachesResult(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"parse": map[string]any{
				"title": "CacheTest",
				"text":  map[string]any{"*": "<p>cached content here</p>"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	defer srv.Close()

	app := NewApp()
	result := app.CrawlPage(srv.URL+"/wiki/CacheTest", crawler.CrawlOptions{})

	assert.Equal(t, "CacheTest", result.Title)

	cached := app.GetCachedCrawl()
	require.NotNil(t, cached)
	assert.Equal(t, "CacheTest", cached.Title)
}

func TestCrawlPage_CachePersistsToDisk(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"parse": map[string]any{
				"title": "DiskCache",
				"text":  map[string]any{"*": "<p>disk content</p>"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	defer srv.Close()

	app := NewApp()
	app.CrawlPage(srv.URL+"/wiki/DiskCache", crawler.CrawlOptions{})

	loaded, err := crawler.LoadCache()
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, "DiskCache", loaded.Title)
}

func TestStartup_LoadsCachedCrawl(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	require.NoError(t, crawler.SaveCache(crawler.CrawlResult{Title: "BootCache"}))

	app := NewApp()
	app.startup(context.Background())

	cached := app.GetCachedCrawl()
	require.NotNil(t, cached)
	assert.Equal(t, "BootCache", cached.Title)
}

func TestGetCachedCrawl_ReturnsNilForFailedCrawl(t *testing.T) {
	app := NewApp()
	app.CrawlPage("://invalid", crawler.CrawlOptions{})
	assert.Nil(t, app.GetCachedCrawl())
}

func TestCharacters_InitialState(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	chars := app.GetCharacters()
	require.Len(t, chars, 1)
	assert.Equal(t, 1, chars[0].ID)
	assert.Equal(t, "Untitled", chars[0].Name)
}

func TestAddCharacter(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	ch := app.AddCharacter()
	assert.Equal(t, 2, ch.ID)
	assert.Equal(t, "Untitled", ch.Name)

	chars := app.GetCharacters()
	assert.Len(t, chars, 2)
}

func TestUpdateCharacter(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	ch := app.GetActiveCharacter()
	ch.Name = "Elara"

	err := app.UpdateCharacter(ch)
	require.NoError(t, err)

	updated := app.GetActiveCharacter()
	assert.Equal(t, "Elara", updated.Name)
}

func TestUpdateCharacter_NotFound(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	err := app.UpdateCharacter(compose.Character{ID: 999})
	assert.Error(t, err)
}

func TestDeleteCharacter(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	app.AddCharacter()

	err := app.DeleteCharacter(1)
	require.NoError(t, err)

	chars := app.GetCharacters()
	assert.Len(t, chars, 1)
	assert.Equal(t, 2, chars[0].ID)
}

func TestDeleteCharacter_LastOneFails(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	err := app.DeleteCharacter(1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "last character")
}

func TestDeleteCharacter_NotFound(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	app.AddCharacter()

	err := app.DeleteCharacter(999)
	assert.Error(t, err)
}

func TestDeleteCharacter_UpdatesActive(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	app.AddCharacter()

	app.SetActiveCharacter(1)
	_ = app.DeleteCharacter(1)

	active := app.GetActiveCharacter()
	assert.Equal(t, 2, active.ID)
}

func TestGetActiveCharacter_Default(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	ch := app.GetActiveCharacter()
	assert.Equal(t, 1, ch.ID)
}

func TestSetActiveCharacter(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	app.AddCharacter()

	app.SetActiveCharacter(2)
	ch := app.GetActiveCharacter()
	assert.Equal(t, 2, ch.ID)
}

func TestSetActiveCharacter_Nonexistent(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	app.SetActiveCharacter(999)
	ch := app.GetActiveCharacter()
	assert.Equal(t, 0, ch.ID)
}

func TestCountTokens_Integration(t *testing.T) {
	app := NewApp()
	n := app.CountTokens("hello world")
	assert.Greater(t, n, 0)
}

func TestCountTokens_Empty(t *testing.T) {
	app := NewApp()
	n := app.CountTokens("")
	assert.Equal(t, 0, n)
}

func TestStartup_InitializesCharacters(t *testing.T) {
	app := NewApp()
	assert.Len(t, app.characters, 0)

	app.startup(context.Background())
	assert.Len(t, app.characters, 1)
	assert.Equal(t, 1, app.activeCharID)
}
