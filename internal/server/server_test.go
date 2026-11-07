package server

import (
	"net"
	"testing"
	"time"

	"silly-sleeve/internal/app"
	"silly-sleeve/internal/cardexport"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testApp(t *testing.T) *app.App {
	t.Helper()
	return app.NewApp()
}

// TestServer_WiresAppEventsToHub proves the App→hub event path end to end:
// an export run (which emits through App.emit) must reach the SSE hub.
func TestServer_WiresAppEventsToHub(t *testing.T) {
	s := New(testApp(t), nil)
	ch, cancel := s.hub.Subscribe()
	defer cancel()

	// A missing character still runs the full emit sequence: an error
	// progress event plus the final complete event.
	_, err := s.app.ExportCharactersBulk([]int{42}, "json", cardexport.Options{}, t.TempDir())
	require.NoError(t, err)

	var names []string
	drain := time.After(2 * time.Second)
	for len(names) < 2 {
		select {
		case ev := <-ch:
			names = append(names, ev.Name)
		case <-drain:
			t.Fatalf("timed out waiting for export events, got %v", names)
		}
	}
	assert.Equal(t, "export:progress", names[0])
	assert.Equal(t, "export:complete", names[1])
}

func TestProbePort_SkipsBusyPort(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	busy := ln.Addr().(*net.TCPAddr).Port

	got, err := ProbePort(busy)
	require.NoError(t, err)
	assert.Greater(t, got, busy, "expected a port above the busy one")
}

func TestProbePort_ReturnsFreePort(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()

	got, err := ProbePort(port)
	require.NoError(t, err)
	assert.Equal(t, port, got)
}

func TestListenDefault_BindsLoopback(t *testing.T) {
	ln, port, err := ListenDefault()
	require.NoError(t, err)
	defer ln.Close()
	assert.GreaterOrEqual(t, port, defaultPort)
	assert.Contains(t, ln.Addr().String(), "127.0.0.1")
}
