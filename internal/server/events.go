package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// sseHeartbeat keeps idle SSE connections alive through proxies and wakes the
// browser's EventSource after a network hiccup.
const sseHeartbeat = 15 * time.Second

// Event is one backend→UI push, delivered over the SSE stream as
// "event: <Name>\ndata: <JSON Data>".
type Event struct {
	Name string
	Data any
}

// eventBufferSize bounds how far a slow client can fall behind. Progress
// events are transient; final state is always re-fetchable over RPC, so the
// oldest event is dropped when a client's buffer is full.
const eventBufferSize = 64

// Hub fans backend events out to every connected SSE client.
type Hub struct {
	mu      sync.Mutex
	clients map[chan Event]struct{}
}

// NewHub creates an empty hub.
func NewHub() *Hub {
	return &Hub{clients: make(map[chan Event]struct{})}
}

// Subscribe registers a client channel and returns it with a cancel function
// that unsubscribes and closes the channel (exactly once).
func (h *Hub) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, eventBufferSize)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	return ch, func() {
		once.Do(func() {
			h.mu.Lock()
			if _, ok := h.clients[ch]; ok {
				delete(h.clients, ch)
				close(ch)
			}
			h.mu.Unlock()
		})
	}
}

// Publish enqueues an event to every subscribed client. It never blocks: a
// full client buffer drops its oldest event to make room. The lock is held
// for the whole publish so a subscriber cannot cancel (closing its channel)
// mid-loop; that is safe because the slot-freeing above guarantees the send
// itself can never block.
func (h *Hub) Publish(name string, data any) {
	ev := Event{Name: name, Data: data}
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		if len(ch) == cap(ch) {
			<-ch // drop oldest
		}
		ch <- ev
	}
}

// ClientCount is the number of subscribed clients (for diagnostics/tests).
func (h *Hub) ClientCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.clients)
}

// handleEvents streams hub events to the client as Server-Sent Events.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	ch, cancel := s.hub.Subscribe()
	defer cancel()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	writeSSEComment(w, "open")
	flusher.Flush()

	ticker := time.NewTicker(sseHeartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			writeSSE(w, ev)
			flusher.Flush()
		case <-ticker.C:
			writeSSEComment(w, "hb")
			flusher.Flush()
		}
	}
}

// writeSSE writes one named event. Un-marshallable data degrades to null
// rather than dropping the event: the name still tells the client something
// happened.
func writeSSE(w http.ResponseWriter, ev Event) {
	payload, err := json.Marshal(ev.Data)
	if err != nil {
		payload = []byte("null")
	}
	fmt.Fprintf(w, "event: %s\n", ev.Name)
	fmt.Fprintf(w, "data: %s\n\n", payload)
}

func writeSSEComment(w http.ResponseWriter, comment string) {
	fmt.Fprintf(w, ": %s\n\n", comment)
}
