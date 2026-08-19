package llmtest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubModelsServer serves /models and /chat/completions like an
// OpenAI-compatible backend.
func stubModelsServer(t *testing.T, modelIDs []string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/models" {
			data := make([]map[string]any, 0, len(modelIDs))
			for _, id := range modelIDs {
				data = append(data, map[string]any{"id": id})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": data})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"content": fullBulkJSON()}}},
		})
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFetchDefaultModel_ReturnsFirstModelID(t *testing.T) {
	srv := stubModelsServer(t, []string{"qwen2.5-7b", "llama3-8b"})

	model, err := fetchDefaultModel(srv.URL, "")

	require.NoError(t, err)
	assert.Equal(t, "qwen2.5-7b", model)
}

func TestFetchDefaultModel_ErrorsWhenListIsEmpty(t *testing.T) {
	srv := stubModelsServer(t, nil)

	_, err := fetchDefaultModel(srv.URL, "")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "no models")
}

func TestFetchDefaultModel_ErrorsOnHTTPFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "nope", http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	_, err := fetchDefaultModel(srv.URL, "")

	require.Error(t, err)
}

func TestFetchDefaultModel_SendsBearerToken(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{{"id": "m"}}})
	}))
	t.Cleanup(srv.Close)

	_, err := fetchDefaultModel(srv.URL, "sekret")

	require.NoError(t, err)
	assert.Equal(t, "Bearer sekret", gotAuth)
}

func TestRunCLI_ResolvesModelFromModelsEndpoint(t *testing.T) {
	srv := stubModelsServer(t, []string{"auto-model"})
	out := filepath.Join(t.TempDir(), "reports")

	code, stdout, stderr := runCLI(t,
		"-endpoint", srv.URL,
		"-runs", "1",
		"-only", "bulk-generate",
		"-out", out,
	)

	assert.Equal(t, 0, code, "stderr: %s", stderr)
	assert.Contains(t, stdout, "auto-model")
}

func TestRunCLI_FailsWhenNoModelAndDiscoveryFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "nope", http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	code, _, stderr := runCLI(t,
		"-endpoint", srv.URL,
		"-runs", "1",
		"-only", "bulk-generate",
		"-out", filepath.Join(t.TempDir(), "reports"),
	)

	assert.Equal(t, 1, code)
	assert.Contains(t, stderr, "-model")
}

func TestRunCLI_ExplicitModelSkipsDiscovery(t *testing.T) {
	var modelsCalled bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/models" {
			modelsCalled = true
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"content": fullBulkJSON()}}},
		})
	}))
	t.Cleanup(srv.Close)

	code, _, _ := runCLI(t,
		"-endpoint", srv.URL,
		"-model", "explicit",
		"-runs", "1",
		"-only", "bulk-generate",
		"-out", filepath.Join(t.TempDir(), "reports"),
	)

	assert.Equal(t, 0, code)
	assert.False(t, modelsCalled, "an explicit -model must not trigger discovery")
}
