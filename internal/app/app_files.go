package app

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// DroppedImage is an image file read from disk (e.g. via a native file drop),
// returned to the upload screens as a base64 data URL.
type DroppedImage struct {
	Name    string `json:"name"`
	DataURL string `json:"dataUrl"`
	Size    int    `json:"size"`
}

// ReadImageFile reads an image from an absolute path — used by the upload
// screens for native (OS) file drops, where the webview only receives the file
// path, not its bytes. It returns the file as a data URL with its name and size,
// and rejects non-image files.
func (a *App) ReadImageFile(path string) (DroppedImage, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return DroppedImage{}, fmt.Errorf("read image file: %w", err)
	}

	mime := http.DetectContentType(data)
	if !strings.HasPrefix(mime, "image/") {
		return DroppedImage{}, fmt.Errorf("not an image file: %s", mime)
	}

	return DroppedImage{
		Name:    filepath.Base(path),
		DataURL: "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data),
		Size:    len(data),
	}, nil
}

// Portrait and cover-image accessors live here rather than in app.go so the
// binding surface stays grouped by concern: app.go holds project/character
// lifecycle, this file holds image I/O. They are thin, mutex-guarded accessors
// over App state — there is no logic worth pushing into a separate service.

// GetPortrait returns the portrait bytes for a character, or nil when no
// character has that ID.
func (a *App) GetPortrait(charID int) []byte {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, c := range a.characters {
		if c.ID == charID {
			return c.Portrait
		}
	}
	return nil
}

// SavePortrait stores portrait bytes for a character.
func (a *App) SavePortrait(charID int, data []byte) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, c := range a.characters {
		if c.ID == charID {
			a.characters[i].Portrait = data
			return nil
		}
	}
	return charNotFound(charID)
}

// GetProjectImage returns the project-level cover image.
func (a *App) GetProjectImage() []byte {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.projectImage
}

// SaveProjectImage stores the project-level cover image.
func (a *App) SaveProjectImage(data []byte) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.projectImage = data
}
