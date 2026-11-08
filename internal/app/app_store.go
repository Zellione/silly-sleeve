package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"silly-sleeve/internal/library"
	"silly-sleeve/internal/lorebook"
)

// The file flows of the browser bridge. Browsers cannot open native file
// dialogs or write to arbitrary paths, so the server owns a small managed
// area under the user config directory: projects/ (library bundles),
// exports/ (SillyTavern output) and uploads/ (bytes the browser sent in).
// The UI never sees raw paths of its choosing — it works with names,
// server-generated paths, and downloads.

// SaveProjectAsName saves the current project into the managed library folder
// under the given display name, returning the bundle path (the first free
// "<name>.slv", "-2", …). It is the browser replacement for the old native
// save dialog: the UI asks for a name, the server picks the path. The name
// also becomes the project's display name (restored on failure).
func (a *App) SaveProjectAsName(name string) (string, error) {
	if a.library == nil {
		return "", fmt.Errorf("project store unavailable")
	}
	path, err := nextBundlePath(a.library.LibraryDir(), name)
	if err != nil {
		return "", err
	}

	a.mu.Lock()
	previous := a.projectName
	a.projectName = strings.TrimSpace(name)
	a.mu.Unlock()

	if err := a.SaveProjectBundle(path); err != nil {
		a.mu.Lock()
		a.projectName = previous
		a.mu.Unlock()
		return "", err
	}
	return path, nil
}

// GetExportDir returns the managed exports directory, creating it if needed.
// Exports written by the app are downloaded from there through the server.
func (a *App) GetExportDir() (string, error) {
	dir, err := library.ConfigDir()
	if err != nil {
		return "", err
	}
	dir = filepath.Join(dir, "exports")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

// ImportCardData parses SillyTavern card bytes (PNG v2/v3 or JSON), adds the
// character to the current project, and merges any embedded character_book
// entries into the lorebook. The browser sends the bytes of a file picked
// with a standard file dialog or drag-and-drop.
func (a *App) ImportCardData(data []byte) (*ImportCardResult, error) {
	return a.importCardData(data)
}

// ImportLorebookData parses lorebook JSON bytes into entries WITHOUT mutating
// app state; merge/replace is decided by the frontend.
func (a *App) ImportLorebookData(data []byte) ([]lorebook.Entry, error) {
	return lorebook.ParseWorldInfo(data)
}
