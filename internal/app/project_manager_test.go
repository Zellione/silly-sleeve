package app

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/bundle"
	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/project"
)

func newTestProjectManager() *ProjectManager {
	return &ProjectManager{ctx: func() context.Context { return context.Background() }}
}

func TestProjectManager_SaveAndReadBundle_RoundTrip(t *testing.T) {
	pm := newTestProjectManager()
	path := filepath.Join(t.TempDir(), "proj.slv")

	snap := ProjectSnapshot{
		Characters:   []compose.Character{{ID: 7, Name: "Elara"}},
		ActiveCharID: 7,
		Lorebook:     []lorebook.Entry{{}},
		ProjectImage: []byte{1, 2, 3},
	}
	manifest, err := pm.SaveBundle(path, snap)
	require.NoError(t, err)
	assert.Equal(t, "Elara", manifest.Name)
	assert.Equal(t, "draft", manifest.Status)

	b, err := pm.ReadBundle(path)
	require.NoError(t, err)
	assert.Equal(t, "Elara", b.Manifest.Name)
	assert.Equal(t, 7, b.Manifest.ActiveCharID)
	assert.Equal(t, []byte{1, 2, 3}, b.Manifest.ProjectImage)
	require.Len(t, b.Characters, 1)
	assert.Equal(t, "Elara", b.Characters[0].Name)
	assert.Len(t, b.Lorebook, 1)
}

func TestProjectManager_SaveBundle_ProjectNameDerivation(t *testing.T) {
	cases := []struct {
		name  string
		snap  ProjectSnapshot
		wantN string
	}{
		{"empty falls back", ProjectSnapshot{}, "Untitled Project"},
		{"first char name", ProjectSnapshot{Characters: []compose.Character{{Name: "Elara"}}}, "Elara"},
		{"placeholder name falls back", ProjectSnapshot{Characters: []compose.Character{{Name: "Untitled"}}}, "Untitled Project"},
		{"crawl title wins", ProjectSnapshot{Characters: []compose.Character{{Name: "Elara"}}, CrawlTitle: "Wiki Page"}, "Wiki Page"},
		{"explicit name beats all", ProjectSnapshot{Name: "Harper cell", Characters: []compose.Character{{Name: "Elara"}}, CrawlTitle: "Wiki Page"}, "Harper cell"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			pm := newTestProjectManager()
			path := filepath.Join(t.TempDir(), "p.slv")
			manifest, err := pm.SaveBundle(path, c.snap)
			require.NoError(t, err)
			assert.Equal(t, c.wantN, manifest.Name)
			b, err := pm.ReadBundle(path)
			require.NoError(t, err)
			assert.Equal(t, c.wantN, b.Manifest.Name)
		})
	}
}

func TestProjectManager_ReadBundle_EmptyPath(t *testing.T) {
	_, err := newTestProjectManager().ReadBundle("")
	assert.Error(t, err)
}

func TestProjectManager_ResolveCrawlCache(t *testing.T) {
	pm := newTestProjectManager()

	embedded := &crawler.CrawlResult{Title: "Embedded"}
	got := pm.ResolveCrawlCache(bundle.Bundle{CrawlCache: embedded})
	assert.Same(t, embedded, got, "embedded cache is preferred")

	assert.Nil(t, pm.ResolveCrawlCache(bundle.Bundle{}), "no cache and no title resolves to nil")

	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	noMatch := bundle.Bundle{Manifest: project.ProjectManifest{CrawlTitle: "Missing"}}
	assert.Nil(t, pm.ResolveCrawlCache(noMatch), "title with no on-disk match resolves to nil")

	require.NoError(t, crawler.SaveCache(crawler.CrawlResult{Title: "OnDisk", URL: "http://x"}))
	matched := bundle.Bundle{Manifest: project.ProjectManifest{CrawlTitle: "OnDisk"}}
	resolved := pm.ResolveCrawlCache(matched)
	require.NotNil(t, resolved, "matching on-disk cache is reloaded")
	assert.Equal(t, "OnDisk", resolved.Title)
}

func TestProjectManager_ExportCharacter(t *testing.T) {
	pm := newTestProjectManager()
	dir := t.TempDir()

	path, err := pm.ExportCharacter(compose.Character{ID: 1, Name: "Elara"}, dir)
	require.NoError(t, err)
	assert.FileExists(t, path)
}

func TestProjectManager_ExportLorebook(t *testing.T) {
	pm := newTestProjectManager()
	dir := t.TempDir()

	path, err := pm.ExportLorebook([]lorebook.Entry{{}}, dir)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(dir, "world_info.json"), filepath.Clean(path))
	assert.FileExists(t, path)
}

func TestSaveBundle_StampsTimestamps(t *testing.T) {
	pm := newTestProjectManager()
	path := filepath.Join(t.TempDir(), "p.slv")

	m1, err := pm.SaveBundle(path, ProjectSnapshot{})
	require.NoError(t, err)
	created, err := time.Parse(time.RFC3339, m1.CreatedAt)
	require.NoError(t, err, "createdAt must be RFC3339, got %q", m1.CreatedAt)
	updated, err := time.Parse(time.RFC3339, m1.UpdatedAt)
	require.NoError(t, err, "updatedAt must be RFC3339, got %q", m1.UpdatedAt)
	assert.WithinDuration(t, time.Now(), created, time.Minute)
	assert.WithinDuration(t, time.Now(), updated, time.Minute)

	// Re-saving preserves the original creation time and refreshes updatedAt.
	m2, err := pm.SaveBundle(path, ProjectSnapshot{})
	require.NoError(t, err)
	assert.Equal(t, m1.CreatedAt, m2.CreatedAt)
	u2, err := time.Parse(time.RFC3339, m2.UpdatedAt)
	require.NoError(t, err)
	assert.False(t, u2.Before(updated))
}

func TestSaveBundle_ReplacesZeroTimeCreatedAtFromOldBundles(t *testing.T) {
	pm := newTestProjectManager()
	path := filepath.Join(t.TempDir(), "p.slv")

	// Bundles written before timestamps existed carry the zero time.
	require.NoError(t, bundle.WriteBundle(path, bundle.Bundle{
		Manifest: project.ProjectManifest{Name: "Old", CreatedAt: "0001-01-01T00:00:00Z"},
	}))

	m, err := pm.SaveBundle(path, ProjectSnapshot{})
	require.NoError(t, err)
	created, perr := time.Parse(time.RFC3339, m.CreatedAt)
	require.NoError(t, perr)
	assert.WithinDuration(t, time.Now(), created, time.Minute)
}

func TestSaveBundle_RoundTripsFieldEndpoints(t *testing.T) {
	pm := newTestProjectManager()
	path := filepath.Join(t.TempDir(), "p.slv")
	snap := ProjectSnapshot{
		Characters:     []compose.Character{{ID: 1, Name: "Elara"}},
		ActiveCharID:   1,
		FieldEndpoints: map[string]int{"bulk": 2, "tags": 3},
	}
	_, err := pm.SaveBundle(path, snap)
	require.NoError(t, err)

	b, err := pm.ReadBundle(path)
	require.NoError(t, err)
	assert.Equal(t, map[string]int{"bulk": 2, "tags": 3}, b.Manifest.FieldEndpoints)
}
