package library

import (
	"os"
	"path/filepath"
)

// ConfigDir returns the app's config directory (where library.json and the
// thumbnail cache live), creating it if needed.
func ConfigDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "silly-sleeve")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

// DefaultLibraryDir returns the managed projects folder, creating it if needed.
func DefaultLibraryDir() (string, error) {
	cfg, err := ConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(cfg, "projects")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// Sync loads the index from baseDir, auto-registers any *.slv in libraryDir
// not already indexed (filename only — no unzip), and marks entries whose
// bundle file is gone as Missing. The synced index is saved and returned.
func Sync(baseDir, libraryDir string) (Index, error) {
	idx, err := Load(baseDir)
	if err != nil {
		return Index{}, err
	}

	if entries, derr := os.ReadDir(libraryDir); derr == nil {
		for _, de := range entries {
			if de.IsDir() || filepath.Ext(de.Name()) != ".slv" {
				continue
			}
			full := filepath.Join(libraryDir, de.Name())
			if idx.Find(full) == nil {
				name := de.Name()[:len(de.Name())-len(".slv")]
				idx.Upsert(Entry{
					Path: full, Name: name, Status: StatusDraft,
					Tags: []string{},
				})
			}
		}
	}

	for i := range idx.Entries {
		_, statErr := os.Stat(idx.Entries[i].Path)
		idx.Entries[i].Missing = os.IsNotExist(statErr)
	}

	if err := Save(baseDir, idx); err != nil {
		return Index{}, err
	}
	return idx, nil
}
