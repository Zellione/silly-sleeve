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
func (l *WSListener) Connect() error {
	l.mu.Lock()
	defer l.mu.Unlock()

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

	conn, _, err := dialer.Dial(wsURL, header)
	if err != nil {
		return fmt.Errorf("dial WebSocket: %w", err)
	}

	l.conn = conn
	l.running = true

	go l.listen()

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

func (l *WSListener) listen() {
	for l.isRunning() {
		conn := l.getConn()
		if conn == nil {
			return
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			l.mu.Lock()
			l.running = false
			l.mu.Unlock()
			return
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
		var msg WSProgressMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}
		l.handler.OnProgress(ProgressEvent{
			Progress: msg.Data.Value,
			Max:      msg.Data.Max,
		})
	case "executing":
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
	case "executed":
		var msg ExecutedMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			return
		}
		var images []CompletedImage
		for _, img := range msg.Data.Output.Images {
			images = append(images, CompletedImage{
				Filename:  img.Filename,
				Subfolder: img.Subfolder,
				Type:      img.Type,
			})
		}
		if len(images) > 0 {
			l.handler.OnCompleted(CompletedEvent{
				Images: images,
			})
		}
	case "status":
		// queue status update — informational only
	case "execution_error":
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
}

func (l *WSListener) isRunning() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.running
}

func (l *WSListener) getConn() *websocket.Conn {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.conn
}
