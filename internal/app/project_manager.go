package app

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"silly-sleeve/internal/bundle"
	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
)

// ProjectSnapshot is the project state captured (under App's lock) for
// serialization into a .slv bundle.
type ProjectSnapshot struct {
	Characters   []compose.Character
	ActiveCharID int
	Lorebook     []lorebook.Entry
	ProjectImage []byte
	Prompts      prompts.TemplateSet
	SourceURL    string
	CrawlTitle   string
	Status       string
	CrawlCache   *crawler.CrawlResult
	CrawlSet     *crawler.CrawlSet
	FieldEndpoints map[string]int

	CrawlFollowLinks int
	CrawlInclude     map[string]bool
	CrawlSelectors   string
	CrawlRoles       map[string]string
	CrawlSent        map[string]string
}

// ProjectManager owns project persistence decomposed out of App: the native
// save/open/export dialogs, .slv bundle assembly and reading, and SillyTavern
// character / world-info exports. It is stateless with respect to App's project
// store — callers pass a snapshot in and apply the loaded bundle out — so App
// keeps the mutex and state-store orchestration.
//
// ctx reads App's context lazily because it is only available after startup.
type ProjectManager struct {
	ctx func() context.Context
}

// PickSaveBundle opens a native save dialog for creating a .slv project bundle.
func (p *ProjectManager) PickSaveBundle() (string, error) {
	return runtime.SaveFileDialog(p.ctx(), runtime.SaveDialogOptions{
		Title:           "Save project bundle",
		DefaultFilename: "silly-sleeve-project.slv",
		Filters: []runtime.FileFilter{
			{DisplayName: "Silly Sleeve Bundle (*.slv)", Pattern: "*.slv"},
		},
	})
}

// PickOpenBundle opens a native file picker for loading a .slv project bundle.
func (p *ProjectManager) PickOpenBundle() (string, error) {
	return runtime.OpenFileDialog(p.ctx(), runtime.OpenDialogOptions{
		Title: "Open project bundle",
		Filters: []runtime.FileFilter{
			{DisplayName: "Silly Sleeve Bundle (*.slv)", Pattern: "*.slv"},
		},
	})
}

// PickLorebookFile opens a native file picker for importing a lorebook JSON.
func (p *ProjectManager) PickLorebookFile() (string, error) {
	return runtime.OpenFileDialog(p.ctx(), runtime.OpenDialogOptions{
		Title: "Import lorebook JSON",
		Filters: []runtime.FileFilter{
			{DisplayName: "Lorebook JSON (*.json)", Pattern: "*.json"},
		},
	})
}

// PickExportFolder opens a native folder picker for exporting characters.
func (p *ProjectManager) PickExportFolder() (string, error) {
	return runtime.OpenDirectoryDialog(p.ctx(), runtime.OpenDialogOptions{
		Title: "Choose export folder",
	})
}

// SaveBundle assembles a .slv bundle from a project snapshot and writes it.
// It returns the manifest it persisted (name, tags, status) so the caller can
// register the project in the library index.
func (p *ProjectManager) SaveBundle(filePath string, snap ProjectSnapshot) (project.ProjectManifest, error) {
	projectName := "Untitled Project"
	if len(snap.Characters) > 0 && snap.Characters[0].Name != "Untitled" {
		projectName = snap.Characters[0].Name
	}
	if snap.CrawlTitle != "" {
		projectName = snap.CrawlTitle
	}

	status := snap.Status
	if status == "" {
		status = "draft"
	}

	var tags []string
	for _, ch := range snap.Characters {
		if ch.ID == snap.ActiveCharID {
			tags = append([]string{}, ch.Tags...)
			break
		}
	}

	manifest := project.ProjectManifest{
		Name:         projectName,
		Status:       status,
		Tags:         tags,
		ActiveCharID: snap.ActiveCharID,
		SourceURL:    snap.SourceURL,
		CrawlTitle:   snap.CrawlTitle,
		ProjectImage: snap.ProjectImage,
		FieldEndpoints: snap.FieldEndpoints,
		CrawlFollowLinks: snap.CrawlFollowLinks,
		CrawlInclude:     snap.CrawlInclude,
		CrawlSelectors:   snap.CrawlSelectors,
		CrawlRoles:       snap.CrawlRoles,
		CrawlSent:        snap.CrawlSent,
	}

	b := bundle.Bundle{
		Manifest:   manifest,
		Characters: snap.Characters,
		Lorebook:   snap.Lorebook,
		Prompts:    snap.Prompts,
		CrawlCache: snap.CrawlCache,
		CrawlSet:   snap.CrawlSet,
	}
	if err := bundle.WriteBundle(filePath, b); err != nil {
		return project.ProjectManifest{}, err
	}
	return manifest, nil
}

// ReadBundle loads a .slv bundle from disk.
func (p *ProjectManager) ReadBundle(filePath string) (bundle.Bundle, error) {
	if filePath == "" {
		return bundle.Bundle{}, fmt.Errorf("no file selected")
	}
	return bundle.ReadBundle(filePath)
}

// ResolveCrawlCache returns the crawl result a loaded bundle should adopt, or
// nil if there is none to apply (caller leaves its current cache untouched).
// It prefers the bundle's embedded cache, otherwise reloads the on-disk cache
// when its title matches the manifest.
func (p *ProjectManager) ResolveCrawlCache(b bundle.Bundle) *crawler.CrawlResult {
	if b.CrawlCache != nil {
		return b.CrawlCache
	}
	if b.Manifest.CrawlTitle != "" {
		c, err := crawler.LoadCache()
		if err == nil && c != nil && c.Title == b.Manifest.CrawlTitle {
			return c
		}
	}
	return nil
}

// ExportCharacter writes a single character as SillyTavern-compatible JSON.
func (p *ProjectManager) ExportCharacter(ch compose.Character, folderPath string) (string, error) {
	return compose.ExportSillyTavernCard(ch, folderPath)
}

// ExportLorebook writes lorebook entries to a world_info.json file.
func (p *ProjectManager) ExportLorebook(entries []lorebook.Entry, folderPath string) (string, error) {
	filePath := folderPath + "/world_info.json"
	if err := lorebook.ExportWorldInfo(entries, filePath); err != nil {
		return "", err
	}
	return filePath, nil
}
