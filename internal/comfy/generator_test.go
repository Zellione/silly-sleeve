package comfy

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerator_Run_QueuesPromptWithReplacedPlaceholders(t *testing.T) {
	var receivedPrompt json.RawMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/prompt" {
			assert.Equal(t, "POST", r.Method)
			var req QueuedRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			receivedPrompt = req.Prompt
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"prompt_id":"test-prompt-id","number":1}`))
			return
		}
		if r.URL.Path == "/view" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("fake-png-data"))
			return
		}
		w.WriteHeader(404)
	}))
	defer srv.Close()

	wsSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()

		msg := ExecutedMsg{
			Type: "executed",
			Data: ExecutedMsgData{
				Node: "1",
				Output: ExecutedOutputData{
					Images: []CompletedImage{
						{Filename: "test.png", Subfolder: "", Type: "output"},
					},
				},
			},
		}
		data, _ := json.Marshal(msg)
		_ = conn.WriteMessage(websocket.TextMessage, data)
	}))
	defer wsSrv.Close()

	wsURL := "http://" + strings.TrimPrefix(wsSrv.URL, "http://")
	t.Logf("wsURL=%s srvURL=%s", wsURL, srv.URL)

	//nolint:staticcheck // nil context is safe — emitEvent handles nil by returning early
	g := NewGenerator(nil, srv.URL, nil)
	g.listener.BaseURL = wsURL

	params := GenerationParams{
		WorkflowTemplate: `{"1":{"class_type":"KSampler","inputs":{"seed":"{{seed}}","steps":"{{steps}}","cfg":"{{cfg}}"}}}`,
		Seed:             42,
		Steps:            20,
		CFG:              7.0,
	}

	err := g.Run(params, nil)
	require.NoError(t, err)

	var promptMap map[string]any
	require.NoError(t, json.Unmarshal(receivedPrompt, &promptMap))

	node1, ok := promptMap["1"].(map[string]any)
	require.True(t, ok)
	inputs, ok := node1["inputs"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, float64(42), inputs["seed"])
	assert.Equal(t, float64(20), inputs["steps"])
	assert.Equal(t, 7.0, inputs["cfg"])
}

func TestGenerator_Run_InvalidJSON(t *testing.T) {
	g := NewGenerator(context.Background(), "http://localhost:1", nil)
	params := GenerationParams{
		WorkflowTemplate: `not-valid-json`,
	}
	err := g.Run(params, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse workflow template")
}

func TestGenerator_Run_FixesBarePlaceholders(t *testing.T) {
	var receivedPrompt json.RawMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/prompt" {
			var req QueuedRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			receivedPrompt = req.Prompt
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"prompt_id":"test-prompt-id","number":1}`))
			return
		}
		if r.URL.Path == "/view" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("fake-png-data"))
			return
		}
		w.WriteHeader(404)
	}))
	defer srv.Close()

	wsSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()
		msg := ExecutedMsg{
			Type: "executed",
			Data: ExecutedMsgData{
				Node: "1",
				Output: ExecutedOutputData{
					Images: []CompletedImage{
						{Filename: "test.png", Subfolder: "", Type: "output"},
					},
				},
			},
		}
		data, _ := json.Marshal(msg)
		_ = conn.WriteMessage(websocket.TextMessage, data)
	}))
	defer wsSrv.Close()

	wsURL := "http://" + strings.TrimPrefix(wsSrv.URL, "http://")

	//nolint:staticcheck
	g := NewGenerator(nil, srv.URL, nil)
	g.listener.BaseURL = wsURL

	params := GenerationParams{
		WorkflowTemplate: `{"1":{"inputs":{"seed":{{seed}}, "steps":{{steps}}, "cfg":{{cfg}}}}}`,
		Seed:             42,
		Steps:            20,
		CFG:              7.0,
	}

	err := g.Run(params, nil)
	require.NoError(t, err)

	var promptMap map[string]any
	require.NoError(t, json.Unmarshal(receivedPrompt, &promptMap))

	node1, ok := promptMap["1"].(map[string]any)
	require.True(t, ok)
	inputs, ok := node1["inputs"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, float64(42), inputs["seed"])
	assert.Equal(t, float64(20), inputs["steps"])
	assert.Equal(t, 7.0, inputs["cfg"])
}

func TestGenerator_Run_EmptyTemplate(t *testing.T) {
	g := NewGenerator(context.Background(), "http://localhost:1", nil)
	params := GenerationParams{
		WorkflowTemplate: `null`,
	}
	err := g.Run(params, nil)
	assert.Error(t, err)
}

func TestGenerator_OnProgress(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	g.OnProgress(ProgressEvent{Progress: 50, Max: 100})
	g.mu.Lock()
	assert.Equal(t, 50, g.progress)
	assert.Equal(t, 100, g.max)
	g.mu.Unlock()
}

func TestGenerator_OnError(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	go func() {
		g.OnError(ErrorEvent{PromptID: "err-1", Error: "generation failed"})
	}()
	<-g.done
	g.mu.Lock()
	assert.Error(t, g.err)
	assert.Contains(t, g.err.Error(), "generation failed")
	g.mu.Unlock()
}

func TestGenerator_PromptID(t *testing.T) {
	g := &Generator{promptID: "prompt-123"}
	assert.Equal(t, "prompt-123", g.PromptID())
}

func TestGenerator_Images(t *testing.T) {
	img := CompletedImage{Filename: "img.png", Subfolder: "sub", Type: "output"}
	g := &Generator{images: []CompletedImage{img}}
	assert.Len(t, g.Images(), 1)
	assert.Equal(t, "img.png", g.Images()[0].Filename)
}

func TestJSONString_UnmarshalJSON_StringValue(t *testing.T) {
	var s JSONString
	require.NoError(t, json.Unmarshal([]byte(`"hello"`), &s))
	assert.Equal(t, JSONString("hello"), s)
}

func TestJSONString_UnmarshalJSON_RawValue(t *testing.T) {
	var s JSONString
	require.NoError(t, json.Unmarshal([]byte(`{"a":1}`), &s))
	assert.Equal(t, JSONString(`{"a":1}`), s)
}

func TestJSONString_MarshalJSON(t *testing.T) {
	s := JSONString(`{"a":1}`)
	data, err := json.Marshal(s)
	require.NoError(t, err)
	assert.Equal(t, `"{\"a\":1}"`, string(data))
}

func TestIsValidImage_PNG(t *testing.T) {
	data := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	assert.True(t, isValidImage(data))
}

func TestIsValidImage_JPEG(t *testing.T) {
	data := []byte{0xFF, 0xD8, 0xFF, 0xE0}
	assert.True(t, isValidImage(data))
}

func TestIsValidImage_WEBP(t *testing.T) {
	data := []byte{0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50}
	assert.True(t, isValidImage(data))
}

func TestIsValidImage_Invalid(t *testing.T) {
	data := []byte{0x00, 0x01, 0x02, 0x03}
	assert.False(t, isValidImage(data))
}

func TestIsValidImage_TooShort(t *testing.T) {
	assert.False(t, isValidImage([]byte{0x89}))
	assert.False(t, isValidImage([]byte{}))
}

func TestIsValidImage_RIFFButNotWebP(t *testing.T) {
	data := []byte{0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}
	assert.False(t, isValidImage(data))
}

func makeBinaryPreviewImage(imageType uint32, imageData []byte) []byte {
	buf := make([]byte, 8+len(imageData))
	binary.BigEndian.PutUint32(buf[0:4], 1)
	binary.BigEndian.PutUint32(buf[4:8], imageType)
	copy(buf[8:], imageData)
	return buf
}

func makeBinaryPreviewWithMetadata(metadata []byte, imageData []byte) []byte {
	buf := make([]byte, 8+len(metadata)+len(imageData))
	binary.BigEndian.PutUint32(buf[0:4], 4)
	binary.BigEndian.PutUint32(buf[4:8], uint32(len(metadata)))
	copy(buf[8:], metadata)
	copy(buf[8+len(metadata):], imageData)
	return buf
}

func TestOnBinaryImage_PreviewImageValidPNG(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	pngData := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00}
	msg := makeBinaryPreviewImage(2, pngData)
	g.OnBinaryImage(msg)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 1)
	assert.Equal(t, pngData, g.binaryBuffer[0])
	g.mu.Unlock()
}

func TestOnBinaryImage_PreviewImageValidJPEG(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	jpegData := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10}
	msg := makeBinaryPreviewImage(1, jpegData)
	g.OnBinaryImage(msg)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 1)
	assert.Equal(t, jpegData, g.binaryBuffer[0])
	g.mu.Unlock()
}

func TestOnBinaryImage_PreviewWithMetadataValidPNG(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	pngData := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00}
	meta := []byte(`{"image_type":"image/png"}`)
	msg := makeBinaryPreviewWithMetadata(meta, pngData)
	g.OnBinaryImage(msg)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 1)
	assert.Equal(t, pngData, g.binaryBuffer[0])
	g.mu.Unlock()
}

func TestOnBinaryImage_NonImageEventIgnored(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, 3)
	g.OnBinaryImage(buf)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 0)
	g.mu.Unlock()
}

func TestOnBinaryImage_TruncatedMessage(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	g.OnBinaryImage([]byte{0x00, 0x00})
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 0)
	g.mu.Unlock()
}

func TestOnBinaryImage_TruncatedPreviewImage(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	buf := make([]byte, 7)
	binary.BigEndian.PutUint32(buf[0:4], 1)
	g.OnBinaryImage(buf)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 0)
	g.mu.Unlock()
}

func TestOnBinaryImage_TruncatedPreviewWithMetadata(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, 4)
	g.OnBinaryImage(buf)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 0)
	g.mu.Unlock()
}

func TestOnBinaryImage_PreviewWithMetadata_HeaderEndPastData(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	msg := makeBinaryPreviewWithMetadata([]byte("short"), []byte{0x89, 0x50})
	binary.BigEndian.PutUint32(msg[4:8], 100)
	g.OnBinaryImage(msg)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 0)
	g.mu.Unlock()
}

func TestOnBinaryImage_InvalidImageData(t *testing.T) {
	g := &Generator{done: make(chan struct{})}
	invalidData := []byte{0x00, 0x01, 0x02, 0x03, 0x04}
	msg := makeBinaryPreviewImage(1, invalidData)
	g.OnBinaryImage(msg)
	g.mu.Lock()
	assert.Len(t, g.binaryBuffer, 0)
	g.mu.Unlock()
}
