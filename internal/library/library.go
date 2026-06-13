// Package library tracks known Silly Sleeve project bundles in a JSON index
// (the source of truth for the dashboard grid) plus a thumbnail cache.
package library

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Status values for a project.
const (
	StatusDraft    = "draft"
	StatusReady    = "ready"
	StatusArchived = "archived"
)

// ValidStatus reports whether s is a recognized status.
func ValidStatus(s string) bool {
	return s == StatusDraft || s == StatusReady || s == StatusArchived
}

// Entry is one project's cached metadata in the library index.
type Entry struct {
	Path         string   `json:"path"`
	Name         string   `json:"name"`
	Status       string   `json:"status"`
	UpdatedAt    string   `json:"updatedAt"`
	SourceShort  string   `json:"sourceShort"`
	Tags         []string `json:"tags"`
	Tokens       int      `json:"tokens"`
	HasThumbnail bool     `json:"hasThumbnail"`
	ThumbRef     string   `json:"thumbRef"`
	Missing      bool     `json:"missing"`
}

// Index is the persisted set of known projects.
type Index struct {
	Entries []Entry `json:"entries"`
}

const indexFile = "library.json"

// Load reads the index from baseDir, returning an empty index if absent.
func Load(baseDir string) (Index, error) {
	data, err := os.ReadFile(filepath.Join(baseDir, indexFile))
	if err != nil {
		if os.IsNotExist(err) {
			return Index{Entries: []Entry{}}, nil
		}
		return Index{}, err
	}
	var idx Index
	if err := json.Unmarshal(data, &idx); err != nil {
		return Index{}, fmt.Errorf("parse library index: %w", err)
	}
	if idx.Entries == nil {
		idx.Entries = []Entry{}
	}
	return idx, nil
}

// Save writes the index to baseDir, creating it if needed.
func Save(baseDir string, idx Index) error {
	if err := os.MkdirAll(baseDir, 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return fmt.Errorf("encode library index: %w", err)
	}
	return os.WriteFile(filepath.Join(baseDir, indexFile), data, 0o600)
}

// Find returns a pointer to the entry with the given path, or nil.
func (idx *Index) Find(path string) *Entry {
	for i := range idx.Entries {
		if idx.Entries[i].Path == path {
			return &idx.Entries[i]
		}
	}
	return nil
}

// Upsert inserts e or replaces the existing entry with the same Path.
func (idx *Index) Upsert(e Entry) {
	if existing := idx.Find(e.Path); existing != nil {
		*existing = e
		return
	}
	idx.Entries = append(idx.Entries, e)
}

// Remove deletes the entry with the given path. Returns true if removed.
func (idx *Index) Remove(path string) bool {
	for i := range idx.Entries {
		if idx.Entries[i].Path == path {
			idx.Entries = append(idx.Entries[:i], idx.Entries[i+1:]...)
			return true
		}
	}
	return false
}

// SetStatus updates the status of the entry with the given path. Returns
// true if an entry was found.
func (idx *Index) SetStatus(path, status string) bool {
	e := idx.Find(path)
	if e == nil {
		return false
	}
	e.Status = status
	return true
}
