package main

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
