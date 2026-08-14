package comfy

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// EventHandler receives generation events from the WebSocket listener.
type EventHandler interface {
	OnProgress(event ProgressEvent)
	OnCompleted(event CompletedEvent)
	OnError(event ErrorEvent)
	OnBinaryImage(data []byte)
}

// WSListener connects to a ComfyUI WebSocket and listens for generation events.
type WSListener struct {
	BaseURL  string
	ClientID string
	Token    *string
	handler  EventHandler
	conn     *websocket.Conn
	mu       sync.Mutex
	running  bool
}

// NewWSListener creates a WebSocket listener for ComfyUI events.
func NewWSListener(baseURL, clientID string, token *string, handler EventHandler) *WSListener {
	return &WSListener{
		BaseURL:  baseURL,
		ClientID: clientID,
		Token:    token,
		handler:  handler,
	}
}

// Connect opens a WebSocket connection to ComfyUI.
// If already connected, closes the previous connection first to prevent goroutine leaks.
func (l *WSListener) Connect() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	// If a connection is already open, close it before dialling a new one.
	// Otherwise its listen goroutine stays blocked in ReadMessage on a socket
	// that Close() will never reach (Close only closes the current l.conn), and
	// both goroutines would deliver events to the same handler.
	if l.conn != nil {
		l.conn.Close()
		l.conn = nil
		l.running = false
	}

	u, err := url.Parse(l.BaseURL)
	if err != nil {
		return fmt.Errorf("parse base URL: %w", err)
	}

	wsScheme := "ws"
	if u.Scheme == "https" {
		wsScheme = "wss"
	}

	wsURL := fmt.Sprintf("%s://%s/ws?clientId=%s", wsScheme, u.Host, l.ClientID)

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	header := make(map[string][]string)
	if l.Token != nil && *l.Token != "" {
		header["Authorization"] = []string{"Bearer " + *l.Token}
	}

	conn, resp, err := dialer.Dial(wsURL, header)
	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}
	if err != nil {
		return fmt.Errorf("dial WebSocket: %w", err)
	}

	// Bound message size: ComfyUI is potentially untrusted, and ReadMessage
	// otherwise buffers an entire (possibly huge) frame into memory.
	conn.SetReadLimit(maxResponseBytes)

	l.conn = conn
	l.running = true

	// The goroutine is handed the connection it owns so a superseded listener
	// can tell that it is no longer the current one.
	go l.listen(conn)

	return nil
}

// Close shuts down the WebSocket connection.
func (l *WSListener) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.running = false
	if l.conn != nil {
		l.conn.Close()
		l.conn = nil
	}
}

func (l *WSListener) listen(conn *websocket.Conn) {
	for {
		// Snapshot the current conn and running together under one lock
		// acquisition so the loop reads a consistent view even if Close() or
		// Connect() runs concurrently.
		l.mu.Lock()
		current := l.conn
		running := l.running
		l.mu.Unlock()
		// Stop if the listener was closed, or if a later Connect() replaced this
		// goroutine's connection — a superseded goroutine must not touch shared
		// state belonging to the connection that replaced it.
		if !running || current != conn {
			return
		}

		msgType, message, err := conn.ReadMessage()
		if err != nil {
			l.mu.Lock()
			// Only clear running if this goroutine still owns the live
			// connection. Without the identity check, the read error a
			// superseded goroutine gets from its own closed socket would mark
			// the freshly-established connection as not running, silently
			// killing it.
			if l.conn == conn {
				l.running = false
			}
			l.mu.Unlock()
			return
		}

		if msgType == websocket.BinaryMessage {
			l.handler.OnBinaryImage(message)
			continue
		}

		l.handleMessage(message)
	}
}

func (l *WSListener) handleMessage(data []byte) {
	var base struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &base); err != nil {
		return
	}

	switch base.Type {
	case "progress":
		l.handleProgressMessage(data)
	case "executing":
		l.handleExecutingMessage(data)
	case "executed":
		l.handleExecutedMessage(data)
	case "execution_error":
		l.handleExecutionErrorMessage(data)
	case "status":
		// queue status update — informational only
	}
}

func (l *WSListener) handleProgressMessage(data []byte) {
	var msg WSProgressMsg
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}
	l.handler.OnProgress(ProgressEvent{
		Progress: msg.Data.Value,
		Max:      msg.Data.Max,
	})
}

func (l *WSListener) handleExecutingMessage(data []byte) {
	var msg WSExecutingMsg
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}
	node := ""
	if msg.Data.Node != nil {
		node = *msg.Data.Node
	}
	if node == "" && msg.Data.PromptID != "" {
		l.handler.OnProgress(ProgressEvent{
			PromptID: msg.Data.PromptID,
			Progress: 0,
			Max:      1,
		})
	}
}

func (l *WSListener) handleExecutedMessage(data []byte) {
	var msg ExecutedMsg
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}
	if len(msg.Data.Output.Images) > 0 {
		fmt.Printf("[ws] executed node=%s images=%d\n", msg.Data.Node, len(msg.Data.Output.Images))
		l.handler.OnCompleted(CompletedEvent{
			Images: msg.Data.Output.Images,
		})
	} else {
		fmt.Printf("[ws] executed node=%s (no images in output)\n", msg.Data.Node)
	}
}

func (l *WSListener) handleExecutionErrorMessage(data []byte) {
	var msg struct {
		Data struct {
			PromptID string `json:"prompt_id"`
			Error    string `json:"exception_message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &msg); err == nil {
		l.handler.OnError(ErrorEvent{
			PromptID: msg.Data.PromptID,
			Error:    msg.Data.Error,
		})
	}
}
