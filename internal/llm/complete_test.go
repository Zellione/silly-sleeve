package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

func TestComplete_TimeoutAccommodatesSlowLocalModels(t *testing.T) {
	// Completions are not streamed: the client waits for the entire response.
	// A local model — especially a thinking model — can spend minutes
	// generating before the body arrives, so a short client timeout aborts
	// requests the server is still happily serving.
	assert.GreaterOrEqual(t, int64(llmRequestTimeout), int64(5*time.Minute))
}

func TestRequestTimeout_DefaultsWhenUnset(t *testing.T) {
	assert.Equal(t, llmRequestTimeout, requestTimeout(LLMEndpoint{}))
	assert.Equal(t, llmRequestTimeout, requestTimeout(LLMEndpoint{TimeoutSeconds: -3}))
}

func TestRequestTimeout_HonorsEndpointOverride(t *testing.T) {
	assert.Equal(t, 90*time.Second, requestTimeout(LLMEndpoint{TimeoutSeconds: 90}))
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

func TestComplete_ForceJSONSendsResponseFormat(t *testing.T) {
	var req map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&req)
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": "{}"}},
			},
		})
	}))
	defer srv.Close()

	ep := LLMEndpoint{URL: srv.URL, Model: "model", ForceJSON: true}
	_, err := Complete(context.Background(), ep, "sys", "user")
	assert.NoError(t, err)
	rf, ok := req["response_format"].(map[string]any)
	assert.True(t, ok, "request must carry response_format")
	assert.Equal(t, "json_object", rf["type"])
}

func TestComplete_NoResponseFormatByDefault(t *testing.T) {
	// Some OpenAI-compatible servers reject unknown params, so the field
	// must be absent — not null — unless the endpoint opts in.
	var req map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&req)
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
	_, present := req["response_format"]
	assert.False(t, present)
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
