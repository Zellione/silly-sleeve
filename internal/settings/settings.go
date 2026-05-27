package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// LLMEndpoint is a future-proof endpoint definition.
type LLMEndpoint struct {
	ID            int     `json:"id"`
	Name          string  `json:"name"`
	URL           string  `json:"url"`
	Model         string  `json:"model"`
	Key           *string `json:"key"`
	IsDefault     bool    `json:"isDefault"`
	ContextSize   int     `json:"contextSize"`
	Temperature   float64 `json:"temperature"`
	SystemPrompt  string  `json:"systemPrompt"`
	Ok            bool    `json:"ok"`
}

// Settings is the top-level persisted config.
type Settings struct {
	Endpoints []LLMEndpoint `json:"endpoints"`
}

func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "silly-sleeve")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, "settings.json"), nil
}

// Load reads settings from the user config directory.
func Load() (Settings, error) {
	path, err := configPath()
	if err != nil {
		return Settings{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Settings{Endpoints: []LLMEndpoint{}}, nil
		}
		return Settings{}, err
	}
	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		return Settings{}, fmt.Errorf("parse settings: %w", err)
	}
	return s, nil
}

// Save writes settings to the user config directory.
func Save(s Settings) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("encode settings: %w", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write settings: %w", err)
	}
	return nil
}
