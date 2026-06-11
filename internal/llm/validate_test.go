package llm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateEndpointURL(t *testing.T) {
	cases := []struct {
		url string
		ok  bool
	}{
		{"http://localhost:11434/v1", true},
		{"https://api.example.com/v1", true},
		{"file:///etc/passwd", false},
		{"gopher://example.com", false},
		{"https://", false}, // no host
		{"://bad", false},
	}
	for _, c := range cases {
		err := validateEndpointURL(c.url)
		if c.ok {
			assert.NoError(t, err, "url=%s", c.url)
		} else {
			assert.Error(t, err, "url=%s", c.url)
		}
	}
}

func TestComplete_RejectsNonHTTPScheme(t *testing.T) {
	_, err := Complete(LLMEndpoint{URL: "file:///etc/passwd", Model: "m"}, "sys", "user")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "http or https")
}

func TestTestEndpoint_RejectsNonHTTPScheme(t *testing.T) {
	res := TestEndpoint(LLMEndpoint{URL: "file:///etc/passwd", Model: "m"})
	assert.False(t, res.Ok)
	assert.Contains(t, res.Error, "http or https")
}
