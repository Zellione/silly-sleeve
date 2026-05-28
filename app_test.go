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
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	app := NewApp()
	result := app.CrawlPage(srv.URL+"/wiki/Test_Page", crawler.CrawlOptions{})

	assert.Equal(t, "Test_Page", result.Title)
	assert.Equal(t, srv.URL+"/wiki/Test_Page", result.URL)
	assert.NotEmpty(t, result.Domain)
	assert.Contains(t, result.RawHTML, "Hello world from wiki")
	assert.Equal(t, 200, result.StatusCode)
	assert.Greater(t, result.LatencyMs, int64(0))
	assert.Greater(t, result.WordCount, 0)
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

func TestCountWords_Empty(t *testing.T) {
	assert.Equal(t, 0, countWords(""))
}

func TestCountWords_HTML(t *testing.T) {
	assert.Greater(t, countWords("<p>Hello world</p>"), 0)
}

func TestCountWords_PlainText(t *testing.T) {
	assert.Equal(t, 5, countWords("One two three four five"))
}
