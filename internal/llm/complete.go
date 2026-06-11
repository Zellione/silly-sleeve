package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// maxLLMResponseBytes caps the response body read from a user-configured
// (and thus untrusted) LLM endpoint, guarding against memory exhaustion.
const maxLLMResponseBytes = 32 << 20 // 32 MiB

// validateEndpointURL ensures a user-supplied endpoint URL uses http(s) and
// has a host, rejecting schemes like file:// or gopher://.
func validateEndpointURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid endpoint URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("endpoint URL must use http or https, got %q", u.Scheme)
	}
	if u.Host == "" {
		return fmt.Errorf("endpoint URL must include a host")
	}
	return nil
}

// ChatMessage represents a single message in a chat completion.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
}

// Complete sends a chat completion request and returns the message content.
func Complete(ctx context.Context, ep LLMEndpoint, systemPrompt, userPrompt string) (string, error) {
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	if err := validateEndpointURL(ep.URL); err != nil {
		return "", err
	}

	payload := chatRequest{
		Model:       ep.Model,
		Messages:    messages,
		Temperature: ep.Temperature,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	if ctx == nil {
		ctx = context.Background()
	}
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "POST", ep.URL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if ep.Key != nil && *ep.Key != "" {
		req.Header.Set("Authorization", "Bearer "+*ep.Key)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var cr chatResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxLLMResponseBytes)).Decode(&cr); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(cr.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return cr.Choices[0].Message.Content, nil
}
