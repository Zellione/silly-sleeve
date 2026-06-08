package comfy

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_SystemStats(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/system_stats", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"system":{"os":"linux","python_version":"3.10","comfyui_version":"abc123"},"devices":[{"name":"GPU","type":"cuda","vram_total":8000000000}]}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	stats, err := client.SystemStats()
	require.NoError(t, err)
	assert.Equal(t, "linux", stats.System.OS)
	assert.Equal(t, "3.10", stats.System.PythonVersion)
	assert.Len(t, stats.Devices, 1)
	assert.Equal(t, "GPU", stats.Devices[0].Name)
}

func TestClient_SystemStats_Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	_, err := client.SystemStats()
	assert.Error(t, err)
}

func TestClient_QueuePrompt(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/prompt", r.URL.Path)
		assert.Equal(t, "POST", r.Method)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"prompt_id":"test-123","number":1}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	workflow := json.RawMessage(`{"1":{"class_type":"KSampler"}}`)
	resp, err := client.QueuePrompt("client-1", workflow)
	require.NoError(t, err)
	assert.Equal(t, "test-123", resp.PromptID)
}

func TestClient_QueuePrompt_Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"bad workflow"}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	_, err := client.QueuePrompt("client-1", json.RawMessage(`{}`))
	assert.Error(t, err)
}

func TestClient_History(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"prompt-123":{"outputs":{"1":{"images":[{"filename":"img.png","subfolder":"","type":"output"}]}}}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	entry, err := client.History("prompt-123")
	require.NoError(t, err)
	require.NotNil(t, entry)
	assert.Len(t, entry.Outputs[1].Images, 1)
	assert.Equal(t, "img.png", entry.Outputs[1].Images[0].Filename)
}

func TestClient_History_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	_, err := client.History("nonexistent")
	assert.Error(t, err)
}

func TestClient_GetImage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/view", r.URL.Path)
		assert.Equal(t, "img.png", r.URL.Query().Get("filename"))
		_, _ = w.Write([]byte("mock-image-bytes"))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	data, err := client.GetImage("img.png", "", "output")
	require.NoError(t, err)
	assert.Equal(t, []byte("mock-image-bytes"), data)
}

func TestClient_TestConnection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"system":{"os":"linux"}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	err := client.TestConnection()
	assert.NoError(t, err)
}

func TestClient_TestConnection_Fail(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	}))
	srv.Close()

	client := NewClient(srv.URL, nil)
	err := client.TestConnection()
	assert.Error(t, err)
}

func TestClient_AuthHeaders(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer test-token-123", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"system":{"os":"linux"}}`))
	}))
	defer srv.Close()

	token := "test-token-123"
	client := NewClient(srv.URL, &token)
	_, err := client.SystemStats()
	require.NoError(t, err)
}

func TestExtractInputValues(t *testing.T) {
	t.Run("valid list", func(t *testing.T) {
		raw := json.RawMessage(`[["euler","dpmpp_2m","dpmpp_3m_sde"],{"default":"euler"}]`)
		vals, err := ExtractInputValues(raw)
		require.NoError(t, err)
		assert.Equal(t, []string{"euler", "dpmpp_2m", "dpmpp_3m_sde"}, vals)
	})

	t.Run("empty list", func(t *testing.T) {
		raw := json.RawMessage(`[[],{"default":""}]`)
		vals, err := ExtractInputValues(raw)
		require.NoError(t, err)
		assert.Empty(t, vals)
	})

	t.Run("invalid json", func(t *testing.T) {
		raw := json.RawMessage(`not-json`)
		_, err := ExtractInputValues(raw)
		assert.Error(t, err)
	})
}

func TestClient_GetObjectInfo(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/object_info/KSampler", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"KSampler":{"input":{"required":{"sampler_name":[["euler","dpmpp_2m"],{"default":"euler"}]}}}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	info, err := client.GetObjectInfo("KSampler")
	require.NoError(t, err)
	require.NotNil(t, info)
	node, ok := (*info)["KSampler"]
	require.True(t, ok)
	raw, exists := node.Input.Required["sampler_name"]
	require.True(t, exists)
	vals, err := ExtractInputValues(raw)
	require.NoError(t, err)
	assert.Equal(t, []string{"euler", "dpmpp_2m"}, vals)
}

func TestClient_GetNodeInputList(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/object_info/CheckpointLoaderSimple", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"CheckpointLoaderSimple":{"input":{"required":{"ckpt_name":[["sd_xl_base_1.0.safetensors","juggernautXL_v9.safetensors"],{"default":"sd_xl_base_1.0.safetensors"}]}}}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	vals, err := client.GetNodeInputList("CheckpointLoaderSimple", "ckpt_name")
	require.NoError(t, err)
	assert.Equal(t, []string{"sd_xl_base_1.0.safetensors", "juggernautXL_v9.safetensors"}, vals)
}

func TestClient_GetNodeInputList_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"UnknownNode":{"input":{"required":{}}}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	_, err := client.GetNodeInputList("UnknownNode", "some_input")
	assert.Error(t, err)
}

func TestClient_GetNodeInputList_MissingInput(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"CheckpointLoaderSimple":{"input":{"required":{"ckpt_name":[]}}}}`))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, nil)
	_, err := client.GetNodeInputList("CheckpointLoaderSimple", "missing_input")
	assert.Error(t, err)
}
