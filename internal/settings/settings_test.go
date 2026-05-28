package settings

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigPath(t *testing.T) {
	path, err := configPath()
	require.NoError(t, err)
	assert.Contains(t, path, "silly-sleeve")
	assert.Contains(t, path, "settings.json")
}

func TestLoad_FileNotExist(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	s, err := Load()
	require.NoError(t, err)
	assert.Empty(t, s.Endpoints)
}

func TestLoad_ValidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	expected := Settings{
		Endpoints: []LLMEndpoint{
			{ID: 1, Name: "Test", URL: "https://example.com/v1", Model: "model1", IsDefault: true},
		},
	}
	require.NoError(t, Save(expected))

	s, err := Load()
	require.NoError(t, err)
	require.Len(t, s.Endpoints, 1)
	assert.Equal(t, "Test", s.Endpoints[0].Name)
	assert.Equal(t, "https://example.com/v1", s.Endpoints[0].URL)
	assert.True(t, s.Endpoints[0].IsDefault)
}

func TestLoad_CorruptJSON(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	cp, err := configPath()
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(cp, []byte("not json"), 0o644))

	_, err = Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse settings")
}

func TestSave_WritesValidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	s := Settings{
		Endpoints: []LLMEndpoint{
			{ID: 1, Name: "SaveTest", URL: "https://save.example.com/v1", Model: "gpt"},
		},
	}
	require.NoError(t, Save(s))

	cp, err := configPath()
	require.NoError(t, err)

	data, err := os.ReadFile(cp)
	require.NoError(t, err)

	var loaded Settings
	require.NoError(t, json.Unmarshal(data, &loaded))
	require.Len(t, loaded.Endpoints, 1)
	assert.Equal(t, "SaveTest", loaded.Endpoints[0].Name)
}

func TestSave_Roundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	key := "sk-test-123"
	s := Settings{
		Endpoints: []LLMEndpoint{
			{
				ID:           1,
				Name:         "Roundtrip",
				URL:          "https://rt.example.com/v1",
				Model:        "rt-model",
				Key:          &key,
				IsDefault:    true,
				ContextSize:  8192,
				Temperature:  0.7,
				SystemPrompt: "You are helpful.",
				Ok:           true,
			},
		},
	}
	require.NoError(t, Save(s))

	loaded, err := Load()
	require.NoError(t, err)
	require.Len(t, loaded.Endpoints, 1)

	ep := loaded.Endpoints[0]
	assert.Equal(t, 1, ep.ID)
	assert.Equal(t, "Roundtrip", ep.Name)
	assert.Equal(t, "https://rt.example.com/v1", ep.URL)
	assert.Equal(t, "rt-model", ep.Model)
	require.NotNil(t, ep.Key)
	assert.Equal(t, "sk-test-123", *ep.Key)
	assert.True(t, ep.IsDefault)
	assert.Equal(t, 8192, ep.ContextSize)
	assert.Equal(t, 0.7, ep.Temperature)
	assert.Equal(t, "You are helpful.", ep.SystemPrompt)
	assert.True(t, ep.Ok)
}

func TestSave_UnwritablePath(t *testing.T) {
	// Override config directory to point to a file (not a directory)
	// This causes MkdirAll to fail if there's a file in the way.
	// But os.UserConfigDir should always return a valid dir.
	// Test that encoding errors are caught.
	s := Settings{
		Endpoints: []LLMEndpoint{{ID: 1, Name: "test"}},
	}

	// Temporarily redirect to an unwritable path via env
	tmpDir := t.TempDir()
	t.Cleanup(func() { os.Unsetenv("XDG_CONFIG_HOME") })

	// Set a valid dir but make settings.json a read-only directory
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	cp, err := configPath()
	require.NoError(t, err)

	// Remove the file if it exists and make it a directory with no write perms
	os.Remove(cp)
	require.NoError(t, os.Mkdir(cp, 0o555))
	t.Cleanup(func() { os.RemoveAll(cp) })

	err = Save(s)
	assert.Error(t, err)
}

func TestSave_EmptyEndpoints(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)

	s := Settings{Endpoints: []LLMEndpoint{}}
	require.NoError(t, Save(s))

	loaded, err := Load()
	require.NoError(t, err)
	assert.Empty(t, loaded.Endpoints)
}

func TestLoad_ConfigPathError(t *testing.T) {
	// Set XDG_CONFIG_HOME to a file (can't create directory)
	tmpFile, err := os.CreateTemp("", "notadir")
	require.NoError(t, err)
	_, _ = tmpFile.WriteString("block")
	tmpFile.Close()

	oldDir := os.Getenv("XDG_CONFIG_HOME")
	os.Setenv("XDG_CONFIG_HOME", tmpFile.Name())

	// This will fail because MkdirAll can't handle a file in place of dir
	_, err = Load()
	os.Setenv("XDG_CONFIG_HOME", oldDir)
	os.Remove(tmpFile.Name())

	// On some systems MkdirAll may succeed anyway if the file is removed,
	// but the env being a file path, the join should create a path issue
	assert.Error(t, err)
}
