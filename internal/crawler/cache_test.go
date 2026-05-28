package crawler

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveCache_Success(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	r := CrawlResult{
		Title:     "Test Page",
		URL:       "https://example.com/wiki/Test",
		Domain:    "example.com",
		RawHTML:   "<p>content</p>",
		Sections:  []Section{{Heading: "Intro", Body: "Hello", Level: 1}},
		Infobox:   []InfoboxEntry{{Key: "race", Value: "Elf"}},
		WordCount: 42,
		StatusCode: 200,
		LatencyMs:  150,
	}
	require.NoError(t, SaveCache(r))

	cp, err := cachePath()
	require.NoError(t, err)

	data, err := os.ReadFile(cp)
	require.NoError(t, err)

	var loaded CrawlResult
	require.NoError(t, json.Unmarshal(data, &loaded))
	assert.Equal(t, "Test Page", loaded.Title)
	assert.Equal(t, "https://example.com/wiki/Test", loaded.URL)
	assert.Equal(t, "<p>content</p>", loaded.RawHTML)
	assert.Len(t, loaded.Sections, 1)
	assert.Len(t, loaded.Infobox, 1)
	assert.Equal(t, 42, loaded.WordCount)
}

func TestLoadCache_NoFile(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	r, err := LoadCache()
	require.NoError(t, err)
	assert.Nil(t, r)
}

func TestLoadCache_Roundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	r := CrawlResult{
		Title:     "Roundtrip",
		URL:       "https://rt.example.com/wiki/Test",
		Domain:    "rt.example.com",
		WordCount: 10,
	}
	require.NoError(t, SaveCache(r))

	loaded, err := LoadCache()
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, "Roundtrip", loaded.Title)
	assert.Equal(t, "https://rt.example.com/wiki/Test", loaded.URL)
	assert.Equal(t, 10, loaded.WordCount)
}

func TestLoadCache_CorruptJSON(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	cp, err := cachePath()
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(cp, []byte("not json"), 0o644))

	_, err = LoadCache()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse cache")
}

func TestClearCache_RemovesFile(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	r := CrawlResult{Title: "WillClear"}
	require.NoError(t, SaveCache(r))

	require.NoError(t, ClearCache())

	loaded, err := LoadCache()
	require.NoError(t, err)
	assert.Nil(t, loaded)
}

func TestClearCache_NoFile(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	require.NoError(t, ClearCache())
}

func TestSaveCache_UnwritablePath(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	cp, err := cachePath()
	require.NoError(t, err)
	require.NoError(t, os.MkdirAll(filepath.Dir(cp), 0o755))

	os.Remove(cp)
	require.NoError(t, os.Mkdir(cp, 0o555))
	t.Cleanup(func() { os.RemoveAll(cp) })

	err = SaveCache(CrawlResult{Title: "Fail"})
	assert.Error(t, err)
}

func TestCacheConcurrent_SaveAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r := CrawlResult{
				Title:     "Concurrent",
				WordCount: i,
			}
			_ = SaveCache(r)
		}(i)
	}
	wg.Wait()

	// After concurrent writes, loading should work
	loaded, err := LoadCache()
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, "Concurrent", loaded.Title)
}
