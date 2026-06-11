package crawler

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func cachePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "silly-sleeve")
	// 0o700: shared app config dir also holds settings.json with secrets.
	if err := os.MkdirAll(appDir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(appDir, "crawl-cache.json"), nil
}

// SaveCache persists a crawl result to disk.
func SaveCache(r CrawlResult) error {
	path, err := cachePath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return fmt.Errorf("encode cache: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write cache: %w", err)
	}
	return nil
}

// LoadCache reads a crawl result from disk.
// Returns nil if no cache exists.
func LoadCache() (*CrawlResult, error) {
	path, err := cachePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var r CrawlResult
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, fmt.Errorf("parse cache: %w", err)
	}
	return &r, nil
}

// ClearCache removes the cached crawl.
func ClearCache() error {
	path, err := cachePath()
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
