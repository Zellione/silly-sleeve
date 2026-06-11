package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestComplete_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/chat/completions", r.URL.Path)
		assert.Equal(t, "POST", r.Method)

		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		_ = json.Unmarshal(body, &req)

		messages := req["messages"].([]any)
		assert.Equal(t, "system", messages[0].(map[string]any)["role"])

		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"role": "assistant", "content": "generated content"}},
			},
		})
	}))
	defer srv.Close()

	ep := LLMEndpoint{URL: srv.URL, Model: "test-model", Temperature: 0.8}
	content, err := Complete(context.Background(), ep, "You are helpful.", "Hello")
	assert.NoError(t, err)
	assert.Equal(t, "generated content", content)
}

func TestComplete_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	ep := LLMEndpoint{URL: srv.URL, Model: "model"}
	_, err := Complete(context.Background(), ep, "sys", "user")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 500")
}

func TestComplete_AuthHeader(t *testing.T) {
	var receivedAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": "ok"}},
			},
		})
	}))
	defer srv.Close()

	key := "sk-test"
	ep := LLMEndpoint{URL: srv.URL, Model: "model", Key: &key}
	_, err := Complete(context.Background(), ep, "sys", "user")
	assert.NoError(t, err)
	assert.Equal(t, "Bearer sk-test", receivedAuth)
}

func TestComplete_EmptyChoices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{},
		})
	}))
	defer srv.Close()

	ep := LLMEndpoint{URL: srv.URL, Model: "model"}
	_, err := Complete(context.Background(), ep, "sys", "user")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no choices")
}

func TestComplete_NoAuthWhenKeyNil(t *testing.T) {
	var receivedAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": "ok"}},
			},
		})
	}))
	defer srv.Close()

	ep := LLMEndpoint{URL: srv.URL, Model: "model"}
	_, err := Complete(context.Background(), ep, "sys", "user")
	assert.NoError(t, err)
	assert.Empty(t, receivedAuth)
}

func TestComplete_ResponseBodyParsing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		_ = json.NewDecoder(r.Body).Decode(&req)
		assert.Equal(t, "gpt-4", req["model"])
		assert.Equal(t, 0.7, req["temperature"])

		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": "test"}},
			},
		})
	}))
	defer srv.Close()

	ep := LLMEndpoint{URL: srv.URL, Model: "gpt-4", Temperature: 0.7}
	content, err := Complete(context.Background(), ep, "system prompt", "user prompt")
	assert.NoError(t, err)
	assert.Equal(t, "test", content)
}
