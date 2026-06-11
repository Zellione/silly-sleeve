package bundle

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadAllLimited(t *testing.T) {
	t.Run("within limit", func(t *testing.T) {
		data, err := readAllLimited(strings.NewReader("hello"), 10)
		require.NoError(t, err)
		assert.Equal(t, "hello", string(data))
	})

	t.Run("at limit", func(t *testing.T) {
		data, err := readAllLimited(strings.NewReader("12345"), 5)
		require.NoError(t, err)
		assert.Len(t, data, 5)
	})

	t.Run("exceeds limit", func(t *testing.T) {
		_, err := readAllLimited(strings.NewReader("123456"), 5)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exceeds")
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
