package comfy

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// state reads the listener's guarded fields under its mutex. Tests must not
// touch l.conn / l.running directly: the listen goroutine writes them while
// holding the lock, so an unguarded read is a data race that -race will fail.
func (l *WSListener) state() (conn *websocket.Conn, running bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.conn, l.running
}

// echoWSServer accepts a WebSocket upgrade and blocks reading until the peer
// goes away, keeping the connection alive for the duration of a test.
func echoWSServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
}

func wsBaseURL(srv *httptest.Server) string {
	return "http://" + strings.TrimPrefix(srv.URL, "http://")
}

func TestWSListener_ConnectAndClose(t *testing.T) {
	srv := echoWSServer(t)
	defer srv.Close()

	l := NewWSListener(wsBaseURL(srv), "test-client", nil, &mockEventHandler{})

	require.NoError(t, l.Connect())
	conn, running := l.state()
	assert.True(t, running)
	assert.NotNil(t, conn)

	l.Close()
	conn, running = l.state()
	assert.False(t, running)
	assert.Nil(t, conn)
}

func TestWSListener_SecondConnectClosesTheFirstConnection(t *testing.T) {
	srv := echoWSServer(t)
	defer srv.Close()

	l := NewWSListener(wsBaseURL(srv), "test-client", nil, &mockEventHandler{})

	require.NoError(t, l.Connect())
	first, _ := l.state()
	require.NotNil(t, first)

	require.NoError(t, l.Connect())
	second, running := l.state()

	assert.True(t, running)
	require.NotNil(t, second)
	assert.NotSame(t, first, second, "a second Connect must dial a fresh connection")

	l.Close()
}

// The superseded goroutine gets a read error from the socket Connect closed on
// its behalf. If it cleared the shared running flag unconditionally it would
// mark the NEW connection as dead, and the listener would silently stop
// delivering events. This asserts the replacement stays live.
func TestWSListener_SupersededGoroutineDoesNotKillNewConnection(t *testing.T) {
	srv := echoWSServer(t)
	defer srv.Close()

	l := NewWSListener(wsBaseURL(srv), "test-client", nil, &mockEventHandler{})

	require.NoError(t, l.Connect())
	require.NoError(t, l.Connect())

	// Give the superseded goroutine time to observe its closed socket and run
	// its error path before we check that the new connection survived it.
	assert.Eventually(t, func() bool {
		_, running := l.state()
		return running
	}, time.Second, 10*time.Millisecond, "listener should still be running")

	time.Sleep(50 * time.Millisecond)
	conn, running := l.state()
	assert.True(t, running, "the superseded goroutine must not clear the new connection's running flag")
	assert.NotNil(t, conn)

	l.Close()
}

func TestWSListener_RepeatedConnectDoesNotLeakGoroutines(t *testing.T) {
	srv := echoWSServer(t)
	defer srv.Close()

	l := NewWSListener(wsBaseURL(srv), "test-client", nil, &mockEventHandler{})

	for range 5 {
		require.NoError(t, l.Connect())
	}
	l.Close()

	// Every listen goroutine exits once its own connection is closed; if any
	// were orphaned they would still be blocked in ReadMessage here.
	assert.Eventually(t, func() bool {
		_, running := l.state()
		return !running
	}, time.Second, 10*time.Millisecond)
}

func TestWSListener_CloseIsIdempotent(t *testing.T) {
	srv := echoWSServer(t)
	defer srv.Close()

	l := NewWSListener(wsBaseURL(srv), "test-client", nil, &mockEventHandler{})
	require.NoError(t, l.Connect())

	l.Close()
	assert.NotPanics(t, l.Close)

	conn, running := l.state()
	assert.False(t, running)
	assert.Nil(t, conn)
}

func TestWSListener_ConnectRejectsUnparseableBaseURL(t *testing.T) {
	l := NewWSListener("://not-a-url", "test-client", nil, &mockEventHandler{})
	assert.Error(t, l.Connect())
}

// mockEventHandler is a concurrency-safe test implementation of EventHandler.
type mockEventHandler struct {
	mu        sync.Mutex
	progress  []ProgressEvent
	completed []CompletedEvent
	errs      []ErrorEvent
	images    [][]byte
}

func (m *mockEventHandler) OnProgress(event ProgressEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.progress = append(m.progress, event)
}

func (m *mockEventHandler) OnCompleted(event CompletedEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.completed = append(m.completed, event)
}

func (m *mockEventHandler) OnError(event ErrorEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.errs = append(m.errs, event)
}

func (m *mockEventHandler) OnBinaryImage(data []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.images = append(m.images, data)
}
