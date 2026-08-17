package app

import (
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/library"
)

// ListProjects returns the synced library index for the dashboard grid.
func (a *App) ListProjects() ([]library.Entry, error) {
	if a.library == nil {
		return []library.Entry{}, nil
	}
	return a.library.List()
}

// NewProject resets in-memory project state to a single empty character.
// The given name (may be empty) becomes the project's display name and is
// persisted in the bundle manifest on save.
func (a *App) NewProject(name string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.characters = []compose.Character{compose.NewCharacter(1)}
	a.activeCharID = 1
	a.lorebookEntries = nil
	a.projectImage = nil
	a.cachedCrawl = nil
	a.cachedCrawlSet = nil
	a.crawlInputs = CrawlState{}
	a.projectDir = ""
	a.projectName = strings.TrimSpace(name)
}

// GetProjectName returns the current project's display name ("" when unnamed).
func (a *App) GetProjectName() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.projectName
}

// SetProjectStatus updates a project's status in the library index.
func (a *App) SetProjectStatus(path, status string) error {
	if a.library == nil {
		return nil
	}
	return a.library.SetStatus(path, status)
}

// RemoveProject forgets a project (and deletes the bundle file when deleteFile).
func (a *App) RemoveProject(path string, deleteFile bool) error {
	if a.library == nil {
		return nil
	}
	return a.library.Remove(path, deleteFile)
}

// GetProjectThumbnail returns cached thumbnail bytes for a project path.
func (a *App) GetProjectThumbnail(path string) []byte {
	if a.library == nil {
		return nil
	}
	return a.library.Thumbnail(path)
}
