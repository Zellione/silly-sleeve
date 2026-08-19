package llmtest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// fetchDefaultModel asks the OpenAI-compatible /models endpoint for its model
// list and returns the first entry, so a run against a single-model server
// needs no -model flag.
func fetchDefaultModel(baseURL, apiKey string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, baseURL+"/models", nil)
	if err != nil {
		return "", fmt.Errorf("build models request: %w", err)
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("query models endpoint: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("models endpoint returned HTTP %d", resp.StatusCode)
	}

	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode models response: %w", err)
	}
	if len(payload.Data) == 0 || payload.Data[0].ID == "" {
		return "", fmt.Errorf("models endpoint listed no models")
	}
	return payload.Data[0].ID, nil
}
