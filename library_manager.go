package main

import (
	"fmt"
	"os"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/library"
	"silly-sleeve/internal/project"
)

// LibraryManager is the thin Wails-facing wrapper over internal/library. It
// resolves the config + managed-library directories once and delegates all
// index/thumbnail logic to the package.
type LibraryManager struct {
	baseDir    string
	libraryDir string
}

// NewLibraryManager resolves the config dir and the managed projects folder.
func NewLibraryManager() (*LibraryManager, error) {
	base, err := library.ConfigDir()
	if err != nil {
		return nil, err
	}
	libDir, err := library.DefaultLibraryDir()
	if err != nil {
		return nil, err
	}
	return &LibraryManager{baseDir: base, libraryDir: libDir}, nil
}

// List returns the synced index entries for the dashboard grid.
func (l *LibraryManager) List() ([]library.Entry, error) {
	idx, err := library.Sync(l.baseDir, l.libraryDir)
	if err != nil {
		return nil, err
	}
	return idx.Entries, nil
}

// LibraryDir is the default folder new bundles are saved into.
func (l *LibraryManager) LibraryDir() string { return l.libraryDir }

// Register upserts an index entry for a saved/opened project, caching a
// thumbnail (project cover art, else the active character's portrait).
func (l *LibraryManager) Register(path string, m project.ProjectManifest, active compose.Character) error {
	idx, err := library.Load(l.baseDir)
	if err != nil {
		return err
	}

	thumb := m.ProjectImage
	if len(thumb) == 0 {
		thumb = active.Portrait
	}
	ref, err := library.WriteThumbnail(l.baseDir, path, thumb)
	if err != nil {
		return err
	}

	idx.Upsert(library.Entry{
		Path:         path,
		Name:         m.Name,
		Status:       statusOrDraft(m.Status),
		UpdatedAt:    m.UpdatedAt,
		SourceShort:  library.SourceShort(m.SourceURL),
		Tags:         append([]string{}, m.Tags...),
		Tokens:       compose.CharacterTokens(active),
		HasThumbnail: ref != "",
		ThumbRef:     ref,
	})
	return library.Save(l.baseDir, idx)
}

// SetStatus updates a project's cached status.
func (l *LibraryManager) SetStatus(path, status string) error {
	if !library.ValidStatus(status) {
		return fmt.Errorf("invalid status %q", status)
	}
	idx, err := library.Load(l.baseDir)
	if err != nil {
		return err
	}
	if !idx.SetStatus(path, status) {
		return fmt.Errorf("project not in library: %s", path)
	}
	return library.Save(l.baseDir, idx)
}

// Remove forgets a project (and deletes the bundle file when deleteFile).
func (l *LibraryManager) Remove(path string, deleteFile bool) error {
	idx, err := library.Load(l.baseDir)
	if err != nil {
		return err
	}
	if e := idx.Find(path); e != nil {
		library.DeleteThumbnail(l.baseDir, e.ThumbRef)
	}
	idx.Remove(path)
	if err := library.Save(l.baseDir, idx); err != nil {
		return err
	}
	if deleteFile {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

// Thumbnail returns cached thumbnail bytes for a project path.
func (l *LibraryManager) Thumbnail(path string) []byte {
	idx, err := library.Load(l.baseDir)
	if err != nil {
		return nil
	}
	e := idx.Find(path)
	if e == nil {
		return nil
	}
	return library.ReadThumbnail(l.baseDir, e.ThumbRef)
}

func statusOrDraft(s string) string {
	if s == "" {
		return library.StatusDraft
	}
	return s
}
