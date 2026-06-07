package project

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"silly-sleeve/internal/compose"
)

// ManifestVersion is the current project manifest schema version.
const ManifestVersion = "1"

// ProjectManifest describes a saved project folder.
type ProjectManifest struct {
	Version      string    `json:"version"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	ActiveCharID int       `json:"activeCharId"`
	SourceURL    string    `json:"sourceUrl"`
	CrawlTitle   string    `json:"crawlTitle"`
	ProjectImage []byte    `json:"projectImage"`
}

const manifestFile = "manifest.json"
const charsDir = "characters"

// SaveProject writes the manifest and per-character JSON files into folderPath.
func SaveProject(folderPath string, m ProjectManifest, characters []compose.Character) error {
	v := m
	if v.Version == "" {
		v.Version = ManifestVersion
	}
	now := time.Now().UTC()
	if v.CreatedAt.IsZero() {
		v.CreatedAt = now
	}
	v.UpdatedAt = now

	if err := os.MkdirAll(folderPath, 0o755); err != nil {
		return fmt.Errorf("create project folder: %w", err)
	}

	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("encode manifest: %w", err)
	}
	if err := os.WriteFile(filepath.Join(folderPath, manifestFile), data, 0o644); err != nil {
		return fmt.Errorf("write manifest: %w", err)
	}

	charsPath := filepath.Join(folderPath, charsDir)
	if err := os.MkdirAll(charsPath, 0o755); err != nil {
		return fmt.Errorf("create characters dir: %w", err)
	}
	for _, ch := range characters {
		chData, err := json.MarshalIndent(ch, "", "  ")
		if err != nil {
			return fmt.Errorf("encode character %d: %w", ch.ID, err)
		}
		fname := filepath.Join(charsPath, fmt.Sprintf("%d.json", ch.ID))
		if err := os.WriteFile(fname, chData, 0o644); err != nil {
			return fmt.Errorf("write character %d: %w", ch.ID, err)
		}
	}
	return nil
}

// LoadProject reads a manifest and characters from a folder.
func LoadProject(folderPath string) (ProjectManifest, []compose.Character, error) {
	mPath := filepath.Join(folderPath, manifestFile)
	mData, err := os.ReadFile(mPath)
	if err != nil {
		return ProjectManifest{}, nil, fmt.Errorf("read manifest (%s): %w", mPath, err)
	}
	var m ProjectManifest
	if err := json.Unmarshal(mData, &m); err != nil {
		return ProjectManifest{}, nil, fmt.Errorf("parse manifest: %w", err)
	}

	charsPath := filepath.Join(folderPath, charsDir)
	entries, err := os.ReadDir(charsPath)
	if err != nil {
		return m, nil, fmt.Errorf("read characters dir (%s): %w", charsPath, err)
	}

	var characters []compose.Character
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		chData, err := os.ReadFile(filepath.Join(charsPath, e.Name()))
		if err != nil {
			return m, nil, fmt.Errorf("read character file %s: %w", e.Name(), err)
		}
		var ch compose.Character
		if err := json.Unmarshal(chData, &ch); err != nil {
			return m, nil, fmt.Errorf("parse character %s: %w", e.Name(), err)
		}
		characters = append(characters, ch)
	}

	sort.Slice(characters, func(i, j int) bool { return characters[i].ID < characters[j].ID })
	return m, characters, nil
}

// ParseCharID extracts the numeric ID from a character filename like "1.json".
func ParseCharID(filename string) (int, error) {
	idStr := strings.TrimSuffix(filepath.Base(filename), ".json")
	return strconv.Atoi(idStr)
}
