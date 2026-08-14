package bundle

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/project"
)

func TestReadManifest_ReturnsManifestWithoutFullBundle(t *testing.T) {
	path := filepath.Join(t.TempDir(), "p.slv")
	require.NoError(t, WriteBundle(path, Bundle{
		Manifest: project.ProjectManifest{Name: "N", CreatedAt: "2026-01-02T03:04:05Z"},
	}))

	m, err := ReadManifest(path)
	require.NoError(t, err)
	assert.Equal(t, "N", m.Name)
	assert.Equal(t, "2026-01-02T03:04:05Z", m.CreatedAt)
}

func TestReadManifest_MissingFile(t *testing.T) {
	_, err := ReadManifest(filepath.Join(t.TempDir(), "nope.slv"))
	assert.Error(t, err)
}
