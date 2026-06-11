package comfy

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_RejectsNonHTTPScheme(t *testing.T) {
	_, err := NewClient("file:///etc/passwd", nil).SystemStats()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "http or https")
}

func TestClient_RejectsMissingHost(t *testing.T) {
	_, err := NewClient("http://", nil).GetImage("x.png", "", "output")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "must include a host")
}
