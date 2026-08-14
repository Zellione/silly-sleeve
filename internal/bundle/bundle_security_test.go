package bundle

import (
	"archive/zip"
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadAllLimited(t *testing.T) {
	t.Run("within limit, no cumulative tracking", func(t *testing.T) {
		data, err := readAllLimited(strings.NewReader("hello"), 10, nil)
		require.NoError(t, err)
		assert.Equal(t, "hello", string(data))
	})

	t.Run("at limit, no cumulative tracking", func(t *testing.T) {
		data, err := readAllLimited(strings.NewReader("12345"), 5, nil)
		require.NoError(t, err)
		assert.Len(t, data, 5)
	})

	t.Run("exceeds per-entry limit", func(t *testing.T) {
		_, err := readAllLimited(strings.NewReader("123456"), 5, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exceeds")
	})

	t.Run("cumulative bytes tracked", func(t *testing.T) {
		var cumulative int64
		_, err := readAllLimited(strings.NewReader("hello"), 10, &cumulative)
		require.NoError(t, err)
		assert.Equal(t, int64(5), cumulative)
	})

	t.Run("exceeds cumulative limit", func(t *testing.T) {
		cumulative := int64(maxBundleCumulativeBytes - 5)
		_, err := readAllLimited(strings.NewReader("hello world"), 20, &cumulative)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cumulative")
	})
}

func TestSafeEntryName(t *testing.T) {
	cases := []struct {
		name string
		safe bool
	}{
		{"manifest.json", true},
		{"characters/1.json", true},
		{"images/portrait_1.png", true},
		{"", false},
		{"../evil.json", false},
		{"characters/../../etc/passwd", false},
		{"/etc/passwd", false},
		{"..", false},
		{`..\windows\system32`, false},
	}
	for _, c := range cases {
		assert.Equal(t, c.safe, safeEntryName(c.name), "name=%q", c.name)
	}
}

func TestReadBundleRejectsTooManyEntries(t *testing.T) {
	// Create a zip with more than maxBundleEntries entries.
	// Use a manifest so it passes other checks, but the entry count is the issue.
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// Add a valid manifest.json
	manifest, err := w.Create("manifest.json")
	require.NoError(t, err)
	_, err = manifest.Write([]byte(`{"name":"test"}`))
	require.NoError(t, err)

	// Add entries beyond the limit
	for i := 0; i < maxBundleEntries+1; i++ {
		f, err := w.Create(strings.Join([]string{"dummy", string(rune(i)), ".bin"}, ""))
		require.NoError(t, err)
		_, err = f.Write([]byte{0x00})
		require.NoError(t, err)
	}
	w.Close()

	// Write to temp file and test
	tmpFile, err := os.CreateTemp("", "bundle-*.slv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	_, err = tmpFile.Write(buf.Bytes())
	require.NoError(t, err)
	tmpFile.Close()

	// Should reject due to too many entries
	_, err = ReadBundle(tmpFile.Name())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds maximum of")
}

func TestReadBundleRejectsCumulativeOverflow(t *testing.T) {
	// Create a zip with character entries that collectively exceed maxBundleCumulativeBytes.
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// Add a valid manifest.json
	manifest, err := w.Create("manifest.json")
	require.NoError(t, err)
	_, err = manifest.Write([]byte(`{"name":"test"}`))
	require.NoError(t, err)

	// Create a valid minimal character JSON with a large description to reach size
	baseCharacter := `{"name":"test","description":"`
	description := strings.Repeat("x", maxBundleEntryBytes/2-len(baseCharacter)-10)
	characterJSON := baseCharacter + description + `"}`

	// Add enough character entries to exceed cumulative limit
	// Each character file in characters/*.json is read and accumulates bytes
	// Need 20+ files of ~32MB each to exceed 512MB cumulative limit
	for i := 0; i < 20; i++ {
		filename := "characters/" + string(rune('a'+i)) + ".json"
		f, err := w.Create(filename)
		require.NoError(t, err)
		_, err = f.Write([]byte(characterJSON))
		require.NoError(t, err)
	}
	w.Close()

	// Write to temp file and test
	tmpFile, err := os.CreateTemp("", "bundle-*.slv")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	_, err = tmpFile.Write(buf.Bytes())
	require.NoError(t, err)
	tmpFile.Close()

	// Should reject due to cumulative overflow
	_, err = ReadBundle(tmpFile.Name())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cumulative")
}
