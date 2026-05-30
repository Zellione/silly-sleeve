package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

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
func Complete(ep LLMEndpoint, systemPrompt, userPrompt string) (string, error) {
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
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

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("POST", ep.URL+"/chat/completions", bytes.NewReader(body))
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
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(cr.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return cr.Choices[0].Message.Content, nil
}
