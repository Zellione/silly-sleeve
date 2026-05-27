package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// LLMEndpoint mirrors settings.LLMEndpoint to avoid an import cycle.
type LLMEndpoint struct {
	ID           int
	Name         string
	URL          string
	Model        string
	Key          *string
	ContextSize  int
	Temperature  float64
	SystemPrompt string
}

// TestResult returns the outcome of a connectivity test.
type TestResult struct {
	Ok      bool   `json:"ok"`
	Latency int64  `json:"latency_ms"`
	Error   string `json:"error,omitempty"`
}

// TestEndpoint sends a minimal chat-completion request to verify connectivity.
func TestEndpoint(ep LLMEndpoint) TestResult {
	start := time.Now()

	payload := map[string]any{
		"model":    ep.Model,
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
		"max_tokens": 1,
	}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("POST", ep.URL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return TestResult{Ok: false, Error: err.Error()}
	}
	req.Header.Set("Content-Type", "application/json")
	if ep.Key != nil && *ep.Key != "" {
		req.Header.Set("Authorization", "Bearer "+*ep.Key)
	}

	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return TestResult{Ok: false, Latency: latency, Error: err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return TestResult{Ok: false, Latency: latency, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	return TestResult{Ok: true, Latency: latency}
}
