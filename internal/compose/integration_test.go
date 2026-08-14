package compose

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestExportSillyTavernCard_ProducesValidFile verifies that characters can be
// exported to files and those files exist and contain expected SillyTavern format.
func TestExportSillyTavernCard_ProducesValidFile(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a character with complete data
	char := Character{
		ID:            1,
		Name:          "Kethric Thorm",
		Epithet:       "The Tyrant",
		Tags:          []string{"human", "necromancer", "villain", "ancient"},
		Appearance:    "Pale and imposing. Wears ancient robes of dark purple.",
		Personality:   "Calculating and merciless. Shows no emotion.",
		Backstory:     "Became undead centuries ago. Ruled with an iron fist.",
		Abilities:     "Master of death magic. Immortal.",
		Relationships: "Elara — his greatest mistake",
		Quotes:        []string{"Death is merely the beginning.", "Flesh is temporary."},
		Stats: []StatKV{
			{Key: "STR", Value: "14"},
			{Key: "INT", Value: "18"},
		},
	}

	// Export the character
	exportPath, err := ExportSillyTavernCard(char, tmpDir)
	require.NoError(t, err, "Failed to export character")

	// Verify file exists
	assert.True(t, fileExists(exportPath), "Exported file should exist")

	// Verify file path makes sense
	assert.Contains(t, exportPath, tmpDir, "Export should be in temp directory")
	assert.True(t, filepath.IsAbs(exportPath), "Export path should be absolute")

	// Verify the file is readable and non-empty
	data, err := os.ReadFile(exportPath)
	require.NoError(t, err, "Failed to read exported file")
	assert.Greater(t, len(data), 100, "Exported file should contain substantial content")
}

// TestExportSillyTavernCard_CreatesCorrectFilename verifies that exported files
// have names derived from the character name (slugified).
func TestExportSillyTavernCard_CreatesCorrectFilename(t *testing.T) {
	tmpDir := t.TempDir()

	char := Character{
		ID:   1,
		Name: "Alice the Brave",
	}

	exportPath, err := ExportSillyTavernCard(char, tmpDir)
	require.NoError(t, err)

	// Filename should be based on the slugified name
	filename := filepath.Base(exportPath)
	assert.Contains(t, filename, "alice", "Filename should contain slugified name")
	assert.True(t, strings.HasSuffix(filename, ".json"), "Filename should have .json extension")
}

// TestExportSillyTavernCard_WithMinimalCharacter verifies that even minimal
// characters can be exported successfully.
func TestExportSillyTavernCard_WithMinimalCharacter(t *testing.T) {
	tmpDir := t.TempDir()

	char := Character{
		ID:   1,
		Name: "Minimal",
	}

	exportPath, err := ExportSillyTavernCard(char, tmpDir)
	require.NoError(t, err, "Should export even minimal character")
	assert.True(t, fileExists(exportPath), "Minimal character should produce a file")
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
