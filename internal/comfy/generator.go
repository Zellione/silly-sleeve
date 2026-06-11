package comfy

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"
)

var barePlaceholderRE = regexp.MustCompile(`:\s*\{\{(\w+)\}\}`)

// parseWorkflowTemplate attempts to parse a workflow template JSON string.
// If the direct parse fails because of bare (unquoted) {{...}} placeholders,
// it wraps them in JSON strings and retries.
func parseWorkflowTemplate(template string) (map[string]any, error) {
	var data map[string]any
	if err := json.Unmarshal([]byte(template), &data); err == nil {
		return data, nil
	}
	fixed := barePlaceholderRE.ReplaceAllString(template, `:"{{$1}}"`)
	if fixed != template {
		if err := json.Unmarshal([]byte(fixed), &data); err == nil {
			return data, nil
		}
	}
	return nil, fmt.Errorf("parse workflow template: invalid JSON")
}

// Generator orchestrates a ComfyUI image generation session:
// connect WebSocket, queue a prompt, listen for progress/completion, fetch images.
type Generator struct {
	client    *Client
	listener  *WSListener
	ctx       context.Context
	promptID  string

	mu           sync.Mutex
	images       []CompletedImage
	err          error
	done         chan struct{}
	progress     int
	max          int
	binaryBuffer [][]byte
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

	promptData, err := parseWorkflowTemplate(params.WorkflowTemplate)
	if err != nil {
		return err
	}

	replaced, err := replaceInValue(promptData, values)
	if err != nil {
		return fmt.Errorf("apply placeholders: %w", err)
	}
	replacedMap, ok := replaced.(map[string]any)
	if !ok {
		return fmt.Errorf("unexpected replaced type: %T", replaced)
	}

	promptRaw, err := json.Marshal(replacedMap)
	if err != nil {
		return fmt.Errorf("marshal replaced prompt: %w", err)
	}

	if err := g.listener.Connect(); err != nil {
		return fmt.Errorf("ws connect: %w", err)
	}
	defer g.listener.Close()

	clientID := g.listener.ClientID
	fmt.Printf("[generator] queueing prompt clientID=%s promptLen=%d\n", clientID, len(promptRaw))
	resp, err := g.client.QueuePrompt(clientID, promptRaw)
	if err != nil {
		return fmt.Errorf("queue prompt: %w", err)
	}
	g.mu.Lock()
	g.promptID = resp.PromptID
	g.mu.Unlock()

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

// OnBinaryImage is called by WSListener when binary image data arrives.
// ComfyUI binary WebSocket messages have an outer envelope: [4 bytes event_type (big-endian uint32)] + payload.
// For PREVIEW_IMAGE (type 1/2): payload = [4 bytes image_type] + image_data.
// For PREVIEW_IMAGE_WITH_METADATA (type 4): payload = [4 bytes metadata_len] + metadata_json + image_data.
func (g *Generator) OnBinaryImage(data []byte) {
	if len(data) < 4 {
		return
	}

	eventType := binary.BigEndian.Uint32(data[0:4])
	var imageData []byte

	switch eventType {
	case 1, 2: // PREVIEW_IMAGE / UNENCODED_PREVIEW_IMAGE — payload = [4 bytes image_type (1=JPEG, 2=PNG)] + image_data
		if len(data) < 8 {
			return
		}
		imageData = data[8:]
	case 4: // PREVIEW_IMAGE_WITH_METADATA — payload = [4 bytes metadata_len] + metadata_json + image_data
		if len(data) < 8 {
			return
		}
		metadataLen := binary.BigEndian.Uint32(data[4:8])
		headerEnd := 8 + int(metadataLen)
		if headerEnd > len(data) {
			return
		}
		imageData = data[headerEnd:]
	default:
		return
	}

	if len(imageData) == 0 || !isValidImage(imageData) {
		return
	}

	fmt.Printf("[generator] OnBinaryImage eventType=%d imageData=%d bytes\n", eventType, len(imageData))
	g.mu.Lock()
	g.binaryBuffer = append(g.binaryBuffer, imageData)
	g.mu.Unlock()
}

// isValidImage checks magic bytes to verify the data looks like a supported image format.
func isValidImage(data []byte) bool {
	if len(data) < 4 {
		return false
	}
	// PNG — magic bytes 0x89 0x50 0x4E 0x47 (".PNG")
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return true
	}
	// JPEG — magic bytes 0xFF 0xD8
	if data[0] == 0xFF && data[1] == 0xD8 {
		return true
	}
	// WEBP — RIFF container (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
	if len(data) >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 {
		if data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50 {
			return true
		}
	}
	return false
}

// OnCompleted is called by WSListener on executed events.
func (g *Generator) OnCompleted(event CompletedEvent) {
	g.mu.Lock()
	buf := make([][]byte, len(g.binaryBuffer))
	copy(buf, g.binaryBuffer)
	g.binaryBuffer = g.binaryBuffer[:0]
	pid := g.promptID
	g.mu.Unlock()

	fmt.Printf("[generator] OnCompleted promptID=%s images=%d binaryBuf=%d\n", pid, len(event.Images), len(buf))

	saveDir, dirErr := generatedImagesDir()
	for i := range event.Images {
		img := &event.Images[i]
		if i < len(buf) {
			img.Data = buf[i]
			fmt.Printf("[generator] OnCompleted image %d: using binary buffer (%d bytes)\n", i, len(img.Data))
		} else {
			img.Data = fetchImageWithRetry(g.client, img.Filename, img.Subfolder, img.Type)
		}
		if dirErr == nil && len(img.Data) > 0 {
			saveGeneratedImage(saveDir, pid, i, img.Data)
		}
	}

	g.mu.Lock()
	g.images = event.Images
	emitCompletedAndClose(g, event)
	g.mu.Unlock()
}

func emitCompletedAndClose(g *Generator, event CompletedEvent) {
	emitEvent(g.ctx, "comfy:completed", event)
	select {
	case <-g.done:
	default:
		close(g.done)
	}
}

func fetchImageWithRetry(client *Client, filename, subfolder, imgType string) []byte {
	for retry := 0; retry < 3; retry++ {
		if retry > 0 {
			time.Sleep(time.Duration(retry) * 250 * time.Millisecond)
		}
		data, err := client.GetImage(filename, subfolder, imgType)
		if err == nil {
			fmt.Printf("[generator] OnCompleted image: REST fetch OK (%d bytes)\n", len(data))
			return data
		}
		fmt.Printf("[generator] OnCompleted image: REST fetch retry %d/3 for %s: %v\n", retry+1, filename, err)
	}
	return nil
}

func saveGeneratedImage(dir, promptID string, index int, data []byte) {
	stamp := time.Now().UnixMilli()
	imgPath := filepath.Join(dir, fmt.Sprintf("%s-%d-%d.png", promptID, stamp, index))
	if err := os.WriteFile(imgPath, data, 0o600); err != nil {
		fmt.Printf("[generator] failed to save image: %v\n", err)
	}
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
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.promptID
}

// generatedImagesDir returns the path to the local image output directory.
func generatedImagesDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	genDir := filepath.Join(dir, "silly-sleeve", "generated-images")
	if err := os.MkdirAll(genDir, 0o755); err != nil {
		return "", err
	}
	return genDir, nil
}
