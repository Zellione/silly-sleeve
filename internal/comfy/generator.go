package comfy

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
)

// Generator orchestrates a ComfyUI image generation session:
// connect WebSocket, queue a prompt, listen for progress/completion, fetch images.
type Generator struct {
	client    *Client
	listener  *WSListener
	ctx       context.Context
	promptID  string

	mu       sync.Mutex
	images   []CompletedImage
	err      error
	done     chan struct{}
	progress int
	max      int
}

// NewGenerator creates a generation orchestrator.
func NewGenerator(ctx context.Context, baseURL string, token *string) *Generator {
	clientID := uuid.New().String()
	g := &Generator{
		ctx:  ctx,
		done: make(chan struct{}),
	}
	g.listener = NewWSListener(baseURL, clientID, token, g)
	g.client = NewClient(baseURL, token)
	return g
}

// Run executes a single generation job: connect WS, queue prompt, wait for completion, fetch images.
func (g *Generator) Run(params GenerationParams, values map[string]any) error {
	if values == nil {
		values = BuildPlaceholderValues(params)
	}

	raw, err := json.Marshal(map[string]any{
		"client_id": g.listener.ClientID,
		"prompt":    params.WorkflowTemplate,
	})
	if err != nil {
		return fmt.Errorf("marshal queue request: %w", err)
	}

	var promptData map[string]any
	if err := json.Unmarshal(raw, &promptData); err != nil {
		return fmt.Errorf("unmarshal queue request: %w", err)
	}

	replaced, err := replaceInValue(promptData, values)
	if err != nil {
		return fmt.Errorf("apply placeholders: %w", err)
	}
	replacedMap, ok := replaced.(map[string]any)
	if !ok {
		return fmt.Errorf("unexpected replaced type: %T", replaced)
	}

	promptRaw, err := json.Marshal(replacedMap["prompt"])
	if err != nil {
		return fmt.Errorf("marshal replaced prompt: %w", err)
	}

	if err := g.listener.Connect(); err != nil {
		return fmt.Errorf("ws connect: %w", err)
	}
	defer g.listener.Close()

	clientID, _ := replacedMap["client_id"].(string)
	fmt.Printf("[generator] queueing prompt clientID=%s promptLen=%d\n", clientID, len(promptRaw))
	resp, err := g.client.QueuePrompt(clientID, promptRaw)
	if err != nil {
		return fmt.Errorf("queue prompt: %w", err)
	}
	g.promptID = resp.PromptID

	<-g.done

	g.mu.Lock()
	err = g.err
	g.mu.Unlock()
	return err
}

// OnProgress is called by WSListener on progress events.
func (g *Generator) OnProgress(event ProgressEvent) {
	g.mu.Lock()
	g.progress = event.Progress
	g.max = event.Max
	g.mu.Unlock()

	emitEvent(g.ctx, "comfy:progress", event)
}

// OnCompleted is called by WSListener on executed events.
func (g *Generator) OnCompleted(event CompletedEvent) {
	for i := range event.Images {
		data, err := g.client.GetImage(
			event.Images[i].Filename,
			event.Images[i].Subfolder,
			event.Images[i].Type,
		)
		if err != nil {
			continue
		}
		event.Images[i].Data = data
	}

	g.mu.Lock()
	g.images = event.Images
	g.mu.Unlock()

	emitEvent(g.ctx, "comfy:completed", event)

	g.mu.Lock()
	select {
	case <-g.done:
	default:
		close(g.done)
	}
	g.mu.Unlock()
}

// OnError is called by WSListener on error events.
func (g *Generator) OnError(event ErrorEvent) {
	emitEvent(g.ctx, "comfy:error", event)

	g.mu.Lock()
	select {
	case <-g.done:
	default:
		g.err = fmt.Errorf("generation error: %s", event.Error)
		close(g.done)
	}
	g.mu.Unlock()
}

// Images returns the fetched images after completion.
func (g *Generator) Images() []CompletedImage {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.images
}

// PromptID returns the queued prompt ID.
func (g *Generator) PromptID() string {
	return g.promptID
}
