package app

import (
	"fmt"
	"os"
	"path/filepath"
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

// NewProject resets in-memory project state to a single empty character and
// immediately saves the fresh project as a bundle in the managed library
// folder, returning the bundle path. The given name (may be empty) becomes the
// project's display name and the basis for the bundle's file name. Without a
// library (headless init failure) the project stays in-memory only and the
// returned path is empty.
func (a *App) NewProject(name string) (string, error) {
	a.mu.Lock()
	a.characters = []compose.Character{compose.NewCharacter(1)}
	a.activeCharID = 1
	a.lorebookEntries = nil
	a.projectImage = nil
	a.cachedCrawl = nil
	a.cachedCrawlSet = nil
	a.crawlInputs = CrawlState{}
	a.projectDir = ""
	a.projectName = strings.TrimSpace(name)
	a.mu.Unlock()

	if a.library == nil {
		return "", nil
	}
	path, err := nextBundlePath(a.library.LibraryDir(), a.projectName)
	if err != nil {
		return "", err
	}
	if err := a.SaveProjectBundle(path); err != nil {
		return "", err
	}
	return path, nil
}

// sanitizeBundleName strips filesystem-unsafe characters from a project name,
// keeping unicode (e.g. CJK names) intact. Empty results fall back to
// "Untitled".
func sanitizeBundleName(name string) string {
	cleaned := strings.Map(func(r rune) rune {
		if r < 0x20 || strings.ContainsRune(`/\:*?"<>|`, r) {
			return -1
		}
		return r
	}, name)
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		return "Untitled"
	}
	return cleaned
}

// nextBundlePath returns the first free "<name>.slv" path in dir, appending
// "-2", "-3", … when the plain name is already taken.
func nextBundlePath(dir, name string) (string, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	base := sanitizeBundleName(name)
	for i := 1; ; i++ {
		fileName := base
		if i > 1 {
			fileName = fmt.Sprintf("%s-%d", base, i)
		}
		path := filepath.Join(dir, fileName+".slv")
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return path, nil
		} else if err != nil {
			return "", err
		}
	}
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
