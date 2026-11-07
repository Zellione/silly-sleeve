package server

import (
	"bufio"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHub_SubscribePublish(t *testing.T) {
	h := NewHub()
	ch, cancel := h.Subscribe()
	defer cancel()
	assert.Equal(t, 1, h.ClientCount())

	h.Publish("test:ping", map[string]int{"x": 1})

	select {
	case ev := <-ch:
		assert.Equal(t, "test:ping", ev.Name)
		assert.Equal(t, map[string]int{"x": 1}, ev.Data)
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
}

func TestHub_UnsubscribeStopsDelivery(t *testing.T) {
	h := NewHub()
	ch, cancel := h.Subscribe()
	cancel()
	assert.Equal(t, 0, h.ClientCount())

	// The channel is closed: a read returns the zero value immediately.
	select {
	case ev, ok := <-ch:
		assert.False(t, ok, "channel should be closed")
		assert.Nil(t, ev.Data)
	default:
		t.Fatal("closed channel should be immediately readable")
	}

	// Publishing after unsubscribe must not panic on the closed channel.
	h.Publish("test:ping", nil)

	// Double cancel is safe.
	cancel()
}

func TestHub_SlowClientDropsOldestKeepsNewest(t *testing.T) {
	h := NewHub()
	ch, cancel := h.Subscribe()
	defer cancel()

	// Overfill the buffer.
	for i := range eventBufferSize * 2 {
		h.Publish("test:seq", i)
	}

	var got []int
	for len(got) < eventBufferSize {
		select {
		case ev := <-ch:
			got = append(got, ev.Data.(int))
		case <-time.After(time.Second):
			t.Fatal("timed out draining client buffer")
		}
	}
	// The newest events must survive; the oldest were dropped.
	assert.Equal(t, eventBufferSize*2-1, got[len(got)-1])
	assert.Equal(t, eventBufferSize, got[0])
}

// readSSEEvent reads lines until a full named event is assembled.
func readSSEEvent(t *testing.T, r *bufio.Reader) (name string, data string) {
	t.Helper()
	for {
		line, err := r.ReadString('\n')
		require.NoError(t, err, "SSE stream closed early")
		line = strings.TrimRight(line, "\r\n")
		switch {
		case strings.HasPrefix(line, "event: "):
			name = strings.TrimPrefix(line, "event: ")
		case strings.HasPrefix(line, "data: "):
			data = strings.TrimPrefix(line, "data: ")
		case line == "":
			if name != "" {
				return name, data
			}
		}
	}
}

func TestSSE_StreamDeliversNamedEvents(t *testing.T) {
	s := newTestServer(t)
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	req, err := http.NewRequest("GET", srv.URL+"/api/events", nil)
	require.NoError(t, err)
	req = req.WithContext(t.Context())
	resp, err := srv.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

	reader := bufio.NewReader(resp.Body)
	// First line is the "open" comment.
	first, err := reader.ReadString('\n')
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(first, ": "), "expected SSE comment, got %q", first)

	go s.hub.Publish("comfy:progress", map[string]int{"progress": 42})

	name, data := readSSEEvent(t, reader)
	assert.Equal(t, "comfy:progress", name)
	assert.JSONEq(t, `{"progress":42}`, data)
}

func TestSSE_MethodNotAllowed(t *testing.T) {
	s := newTestServer(t)
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()

	rec, err := srv.Client().Post(srv.URL+"/api/events", "application/json", strings.NewReader("[]"))
	require.NoError(t, err)
	defer rec.Body.Close()
	assert.Equal(t, http.StatusMethodNotAllowed, rec.StatusCode)
}
