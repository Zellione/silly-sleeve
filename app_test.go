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
	"silly-sleeve/internal/bundle"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
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

func TestLLMEndpoint_DelegatesToPackage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	app := NewApp()
	key := "sk-wrapper"
	ep := settings.LLMEndpoint{
		ID:    1,
		Name:  "wrapper",
		URL:   srv.URL,
		Model: "m",
		Key:   &key,
	}

	result := app.TestLLMEndpoint(ep)
	assert.True(t, result.Ok)
	assert.GreaterOrEqual(t, result.Latency, int64(0))
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

func TestDefaultEndpoint_ReturnsDefault(t *testing.T) {
	app := NewApp()
	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{
			{ID: 1, Name: "first", IsDefault: false},
			{ID: 2, Name: "second", IsDefault: true},
		},
	}

	ep := app.defaultEndpoint()
	assert.Equal(t, 2, ep.ID)
	assert.Equal(t, "second", ep.Name)
}

func TestDefaultEndpoint_FirstWhenNone(t *testing.T) {
	app := NewApp()
	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{
			{ID: 1, Name: "only"},
		},
	}

	ep := app.defaultEndpoint()
	assert.Equal(t, 1, ep.ID)
}

func TestDefaultEndpoint_EmptySettings(t *testing.T) {
	app := NewApp()
	ep := app.defaultEndpoint()
	assert.Equal(t, 0, ep.ID)
}

func TestGenerateCharacterBulk_NoCrawl(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())

	ch := app.GenerateCharacterBulk(nil)
	assert.Equal(t, "Untitled", ch.Name)
}

func TestGenerateCharacterBulk_WithCrawl(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"name":          "Generated",
			"epithet":       "Gen",
			"tags":          []string{"tag1"},
			"appearance":    "app",
			"personality":   "pers",
			"backstory":     "back",
			"abilities":     "abil",
			"relationships": "rel",
			"quotes":        []string{"q1"},
			"stats":         [][]string{{"K", "V"}},
		}
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": mustMarshal(t, resp)}},
			},
		})
	}))
	defer srv.Close()

	app := NewApp()
	app.startup(context.Background())

	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{{
			ID:          1,
			Name:        "test",
			URL:         srv.URL,
			Model:       "model",
			IsDefault:   true,
			Temperature: 0.8,
		}},
	}

	app.cachedCrawl = &crawler.CrawlResult{
		Title: "Test Page",
	}

	ch := app.GenerateCharacterBulk(nil)
	assert.Equal(t, "Generated", ch.Name)
	assert.True(t, ch.Dirty)
}

func TestGenerateCharacterBulk_LLMErrorReturnsExisting(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	app := NewApp()
	app.startup(context.Background())

	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{{
			ID: 1, Name: "err", URL: srv.URL, Model: "model", IsDefault: true,
		}},
	}

	app.cachedCrawl = &crawler.CrawlResult{Title: "Page"}
	app.characters[0].Name = "Original"

	ch := app.GenerateCharacterBulk(nil)
	assert.Equal(t, "Original", ch.Name)
}

func TestSaveProjectBundle(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())
	app.characters = []compose.Character{
		{ID: 1, Name: "Alice", Epithet: "Brave"},
		{ID: 2, Name: "Bob"},
	}
	app.activeCharID = 1
	app.cachedCrawl = &crawler.CrawlResult{URL: "https://test.wiki/Alice", Title: "Alice_Wiki"}

	filePath := tmpDir + "/alice-project.slv"
	err := app.SaveProjectBundle(filePath)
	require.NoError(t, err)

	assert.Equal(t, filePath, app.projectDir)

	b, err := bundle.ReadBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Alice_Wiki", b.Manifest.Name)
	assert.Equal(t, 1, b.Manifest.ActiveCharID)
	assert.Equal(t, "https://test.wiki/Alice", b.Manifest.SourceURL)
	assert.Len(t, b.Characters, 2)
}

func TestSaveProjectBundle_NoCrawlTitle(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())
	app.characters = []compose.Character{
		{ID: 1, Name: "Untitled"},
	}

	filePath := tmpDir + "/project.slv"
	err := app.SaveProjectBundle(filePath)
	require.NoError(t, err)

	b, err := bundle.ReadBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Untitled Project", b.Manifest.Name)
}

func TestSaveProjectBundle_NoCharacters(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())
	app.characters = nil

	filePath := tmpDir + "/empty.slv"
	err := app.SaveProjectBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, filePath, app.projectDir)
}

func TestOpenProjectBundle_LoadsCharacters(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())
	app.characters[0].Name = "Elara"

	filePath := tmpDir + "/load-test.slv"
	err := app.SaveProjectBundle(filePath)
	require.NoError(t, err)

	b, err := bundle.ReadBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Elara", b.Manifest.Name)
	assert.Len(t, b.Characters, 1)
	assert.Equal(t, "Elara", b.Characters[0].Name)
}

func TestOpenProjectBundle_EmptyCharactersDefaults(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())
	app.characters = []compose.Character{}

	filePath := tmpDir + "/empty-char.slv"
	err := app.SaveProjectBundle(filePath)
	require.NoError(t, err)

	b, err := bundle.ReadBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Untitled Project", b.Manifest.Name)
	assert.Len(t, b.Characters, 0)

	chars := []compose.Character{compose.NewCharacter(1)}
	assert.Len(t, chars, 1)
	assert.Equal(t, 1, chars[0].ID)
}

func TestExportCharacter(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())
	app.characters = []compose.Character{
		{
			ID:            1,
			Name:          "Alice",
			Epithet:       "The Brave",
			Tags:          []string{"hero", "elf"},
			Appearance:    "Tall and slender.",
			Personality:   "Cheerful and brave.",
			Backstory:     "Born in a forest.",
			Abilities:     "Archery, tracking.",
			Relationships: "Bob — ally.",
			Quotes:        []string{"Let's go!", "I won't give up."},
			Stats:         []compose.StatKV{{Key: "STR", Value: "12"}, {Key: "DEX", Value: "18"}},
		},
	}

	filePath, err := app.ExportCharacter(1, tmpDir)
	require.NoError(t, err)
	assert.Contains(t, filePath, ".json")

	data, err := os.ReadFile(filePath)
	require.NoError(t, err)

	var st map[string]any
	require.NoError(t, json.Unmarshal(data, &st))

	assert.Equal(t, "Alice", st["name"])
	assert.Equal(t, "Cheerful and brave.", st["personality"])
	assert.Equal(t, "Let's go!", st["first_mes"])
	assert.Contains(t, st["mes_example"], "I won't give up.")
	assert.Contains(t, st["description"], "Appearance")
	assert.Contains(t, st["description"], "Personality")
	assert.Contains(t, st["description"], "Backstory")
	assert.Contains(t, st["description"], "Abilities")
	assert.Contains(t, st["description"], "Relationships")
	assert.Contains(t, st["description"], "Stats")
	assert.Contains(t, st["description"], "STR")
	assert.Equal(t, "Silly Sleeve", st["creator"])
	assert.Equal(t, "The Brave", st["creatorcomment"])
	assert.Equal(t, "1.0", st["character_version"])

	tags := st["tags"].([]interface{})
	assert.Len(t, tags, 2)
}

func TestExportCharacter_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.startup(context.Background())

	_, err := app.ExportCharacter(999, t.TempDir())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func mustMarshal(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return string(b)
}

/* ── Prompt templates ────────────────────────────────── */

func TestGetDefaultPromptTemplates_ReturnsDefaults(t *testing.T) {
	app := NewApp()
	tmpl := app.GetDefaultPromptTemplates()
	assert.NotEmpty(t, tmpl.SystemPrompt)
	assert.Len(t, tmpl.FieldPrompts, len(prompts.FieldIDs()))
	for _, id := range prompts.FieldIDs() {
		assert.NotEmpty(t, tmpl.FieldPrompts[id], "field %s should have a default prompt", id)
	}
}

func TestGetPromptTemplates_ReturnsDefaultsWhenEmpty(t *testing.T) {
	app := NewApp()
	tmpl := app.GetPromptTemplates()
	assert.NotEmpty(t, tmpl.SystemPrompt)
	assert.Len(t, tmpl.FieldPrompts, len(prompts.FieldIDs()))
}

func TestGetPromptTemplates_ReturnsCustom(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	custom := prompts.Defaults()
	custom.SystemPrompt = "Custom system"
	app.settings.PromptTemplates = custom

	tmpl := app.GetPromptTemplates()
	assert.Equal(t, "Custom system", tmpl.SystemPrompt)
}

func TestSavePromptTemplates_Persists(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	app := NewApp()
	app.ctx = context.Background()
	app.settings = settings.Settings{Endpoints: []settings.LLMEndpoint{}}

	tmpl := prompts.Defaults()
	tmpl.SystemPrompt = "Saved system"
	err := app.SavePromptTemplates(tmpl)
	require.NoError(t, err)

	assert.Equal(t, "Saved system", app.settings.PromptTemplates.SystemPrompt)

	loaded, err := settings.Load()
	require.NoError(t, err)
	assert.Equal(t, "Saved system", loaded.PromptTemplates.SystemPrompt)
}

/* ── GenerateField (app.go wrapper) ──────────────────── */

func TestGenerateField_NoCrawl(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	app.characters[0].Name = "KeepMe"

	ch := app.GenerateField("appearance", "")
	assert.Equal(t, "KeepMe", ch.Name)
}

func TestGenerateField_Success(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": `{"appearance": "Tall and lean."}`}},
			},
		})
	}))
	defer srv.Close()

	app := NewApp()
	app.startup(context.Background())
	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{{
			ID: 1, Name: "test", URL: srv.URL, Model: "m", IsDefault: true,
		}},
	}
	app.cachedCrawl = &crawler.CrawlResult{Title: "Elara", URL: "https://wiki.test/Elara"}

	ch := app.GenerateField("appearance", "")
	assert.Equal(t, "Tall and lean.", ch.Appearance)
	assert.True(t, ch.Dirty)
}

func TestGenerateField_LLMErrorReturnsExisting(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	app := NewApp()
	app.startup(context.Background())
	app.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{{
			ID: 1, Name: "err", URL: srv.URL, Model: "m", IsDefault: true,
		}},
	}
	app.cachedCrawl = &crawler.CrawlResult{Title: "Test"}
	app.characters[0].Name = "Original"

	ch := app.GenerateField("appearance", "")
	assert.Equal(t, "Original", ch.Name)
}

/* ── Lorebook operations ─────────────────────────────── */

func TestGetLorebook_Empty(t *testing.T) {
	app := NewApp()
	entries := app.GetLorebook()
	assert.Len(t, entries, 0)
}

func TestGetLorebook_WithEntries(t *testing.T) {
	app := NewApp()
	app.lorebookEntries = []lorebook.Entry{
		{UID: 1, Comment: "Test", Content: "content"},
	}
	entries := app.GetLorebook()
	assert.Len(t, entries, 1)
	assert.Equal(t, "Test", entries[0].Comment)
}

func TestSaveLorebook_Replaces(t *testing.T) {
	app := NewApp()
	app.lorebookEntries = []lorebook.Entry{{UID: 1, Comment: "old"}}

	newEntries := []lorebook.Entry{
		{UID: 2, Comment: "new1"},
		{UID: 3, Comment: "new2"},
	}
	app.SaveLorebook(newEntries)
	assert.Len(t, app.lorebookEntries, 2)
	assert.Equal(t, "new1", app.lorebookEntries[0].Comment)
}

func TestExportLorebook(t *testing.T) {
	tmpDir := t.TempDir()
	app := NewApp()
	app.lorebookEntries = []lorebook.Entry{
		{UID: 0, Comment: "Faction", Key: []string{"Harpers"}, Content: "secret network", Order: 100},
	}

	filePath, err := app.ExportLorebook(tmpDir)
	require.NoError(t, err)
	assert.Equal(t, tmpDir+"/world_info.json", filePath)

	data, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Contains(t, string(data), "Faction")
	assert.Contains(t, string(data), "Harpers")
}

func TestExportLorebook_WriteError(t *testing.T) {
	tmpDir := t.TempDir()
	blockFile := tmpDir + "/world_info.json"
	require.NoError(t, os.Mkdir(blockFile, 0o555))
	t.Cleanup(func() { os.RemoveAll(blockFile) })

	app := NewApp()
	app.lorebookEntries = []lorebook.Entry{
		{UID: 0, Comment: "Test"},
	}

	_, err := app.ExportLorebook(tmpDir)
	assert.Error(t, err)
}

/* ── OpenProjectBundle extended ──────────────────────── */

func TestOpenProjectBundle_WithLorebook(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	filePath := tmpDir + "/lore-bundle.slv"
	err := bundle.WriteBundle(filePath, bundle.Bundle{
		Manifest: project.ProjectManifest{Name: "LoreTest", ActiveCharID: 1},
		Characters: []compose.Character{
			{ID: 1, Name: "Elara"},
		},
		Prompts: prompts.Defaults(),
		Lorebook: []lorebook.Entry{
			{UID: 1, Comment: "Entry1"},
			{UID: 2, Comment: "Entry2"},
		},
	})
	require.NoError(t, err)

	app := NewApp()
	app.startup(context.Background())

	m, err := app.OpenProjectBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "LoreTest", m.Name)

	assert.Len(t, app.lorebookEntries, 2)
	assert.Equal(t, "Entry1", app.lorebookEntries[0].Comment)
}

func TestOpenProjectBundle_WithPrompts(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	customPrompts := prompts.Defaults()
	customPrompts.SystemPrompt = "Bundled system prompt"

	filePath := tmpDir + "/prompt-bundle.slv"
	err := bundle.WriteBundle(filePath, bundle.Bundle{
		Manifest:   project.ProjectManifest{Name: "PromptTest", ActiveCharID: 1},
		Characters: []compose.Character{{ID: 1, Name: "Test"}},
		Prompts:    customPrompts,
	})
	require.NoError(t, err)

	app := NewApp()
	app.startup(context.Background())

	_, err = app.OpenProjectBundle(filePath)
	require.NoError(t, err)
	assert.Equal(t, "Bundled system prompt", app.settings.PromptTemplates.SystemPrompt)
}

func TestOpenProjectBundle_NoFileSelected(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())

	_, err := app.OpenProjectBundle("")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no file selected")
}

func TestOpenProjectBundle_RestoresCrawlFromBundle(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	filePath := tmpDir + "/crawl-bundle.slv"
	err := bundle.WriteBundle(filePath, bundle.Bundle{
		Manifest: project.ProjectManifest{
			Name:       "CrawlTest",
			ActiveCharID: 1,
			SourceURL:  "https://wiki.test/Elara",
			CrawlTitle: "Elara_Wiki",
		},
		Characters: []compose.Character{{ID: 1, Name: "Elara"}},
		Prompts:    prompts.Defaults(),
		CrawlCache: &crawler.CrawlResult{
			Title: "Elara_Wiki",
			URL:   "https://wiki.test/Elara",
		},
	})
	require.NoError(t, err)

	app := NewApp()
	app.startup(context.Background())

	_, err = app.OpenProjectBundle(filePath)
	require.NoError(t, err)

	cached := app.GetCachedCrawl()
	require.NotNil(t, cached)
	assert.Equal(t, "Elara_Wiki", cached.Title)
}

func TestOpenProjectBundle_RestoresCrawlFromDisk(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	require.NoError(t, crawler.SaveCache(crawler.CrawlResult{
		Title: "DiskCrawl",
		URL:   "https://wiki.test/DiskCrawl",
	}))

	filePath := tmpDir + "/disk-bundle.slv"
	err := bundle.WriteBundle(filePath, bundle.Bundle{
		Manifest: project.ProjectManifest{
			Name:        "DiskTest",
			ActiveCharID: 1,
			CrawlTitle:  "DiskCrawl",
		},
		Characters: []compose.Character{{ID: 1, Name: "Test"}},
		Prompts:    prompts.Defaults(),
		CrawlCache: nil,
	})
	require.NoError(t, err)

	app := NewApp()
	app.startup(context.Background())

	_, err = app.OpenProjectBundle(filePath)
	require.NoError(t, err)

	cached := app.GetCachedCrawl()
	require.NotNil(t, cached)
	assert.Equal(t, "DiskCrawl", cached.Title)
}

func TestOpenProjectBundle_EmptyCharactersFromBundle(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	filePath := tmpDir + "/empty-chars.slv"
	err := bundle.WriteBundle(filePath, bundle.Bundle{
		Manifest:   project.ProjectManifest{Name: "EmptyChars", ActiveCharID: 1},
		Characters: []compose.Character{},
		Prompts:    prompts.Defaults(),
	})
	require.NoError(t, err)

	app := NewApp()
	app.startup(context.Background())

	_, err = app.OpenProjectBundle(filePath)
	require.NoError(t, err)

	chars := app.GetCharacters()
	assert.Len(t, chars, 1)
	assert.Equal(t, 1, chars[0].ID)
}
