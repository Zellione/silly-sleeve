package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/comfy"
	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/settings"
)

// These tests drive the App-level Wails binding surface (the thin delegators
// added by the Phase 6.1 decomposition), with the network seams faked.

func TestApp_ComfyWorkflowDelegators(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	app := NewApp()
	app.settings = settings.Settings{Comfy: settings.ComfyConfig{
		URL: "http://comfy",
		Workflows: []comfy.ComfyWorkflow{
			{ID: "wf-1", Name: "first", JSONData: comfy.JSONString(`{"raw":true}`)},
		},
	}}

	assert.Equal(t, "http://comfy", app.GetComfyConfig().URL)
	require.Len(t, app.GetComfyWorkflows(), 1)

	wf, err := app.GetComfyWorkflowByName("first")
	require.NoError(t, err)
	assert.Equal(t, "wf-1", wf.ID)

	tmpl, err := app.GetComfyWorkflowTemplate("wf-1")
	require.NoError(t, err)
	assert.Equal(t, `{"raw":true}`, tmpl)

	require.NoError(t, app.SaveComfyWorkflowTemplate("wf-1", `{"edited":true}`))
	tmpl, err = app.GetComfyWorkflowTemplate("wf-1")
	require.NoError(t, err)
	assert.Equal(t, `{"edited":true}`, tmpl)

	_, err = app.ParseComfyWorkflowParams(`{"nodes":{}}`)
	assert.NoError(t, err)

	wfPath := filepath.Join(t.TempDir(), "imported.json")
	require.NoError(t, os.WriteFile(wfPath, []byte(`{"nodes":{}}`), 0o600))
	imported, err := app.ImportComfyWorkflow(wfPath)
	require.NoError(t, err)
	assert.Equal(t, "imported", imported.Name)

	require.NoError(t, app.DeleteComfyWorkflow("wf-1"))
}

func TestApp_ComfyDiscoveryDelegators(t *testing.T) {
	app := NewApp()
	app.settings = settings.Settings{Comfy: settings.ComfyConfig{URL: "http://comfy"}}
	app.comfy.newClient = func(string, *string) comfy.ComfyClient {
		return &fakeComfyClient{lists: map[string][]string{
			"KSampler.sampler_name":            {"euler"},
			"KSampler.scheduler":               {"normal"},
			"CheckpointLoaderSimple.ckpt_name": {"sdxl.safetensors"},
			"VAELoader.vae_name":               {"vae.pt"},
			"LoraLoader.lora_name":             {"lora.safetensors"},
		}}
	}

	for _, tc := range []struct {
		name string
		call func() ([]string, error)
		want []string
	}{
		{"samplers", app.GetComfySamplers, []string{"euler"}},
		{"schedulers", app.GetComfySchedulers, []string{"normal"}},
		{"checkpoints", app.GetComfyCheckpoints, []string{"sdxl.safetensors"}},
		{"vaes", app.GetComfyVAEs, []string{"vae.pt"}},
		{"loras", app.GetComfyLoRAs, []string{"lora.safetensors"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.call()
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}

	app.comfy.newClient = func(string, *string) comfy.ComfyClient { return &fakeComfyClient{} }
	assert.True(t, app.TestComfyUIEndpoint("http://comfy", "").Ok)
}

func TestApp_GenerateImagePromptDelegator(t *testing.T) {
	app := NewApp()
	app.characters = []compose.Character{{ID: 1, Name: "Elara"}}
	app.activeCharID = 1
	app.settings = settings.Settings{Endpoints: []settings.LLMEndpoint{
		{ID: 1, URL: "http://llm", IsDefault: true},
	}}
	app.charGen.completer = &fakeCompleter{resp: "POSITIVE: x\nNEGATIVE: y"}

	pos, neg, err := app.GenerateImagePrompt(1, "natural")
	require.NoError(t, err)
	assert.Equal(t, "x", pos)
	assert.Equal(t, "y", neg)
}

func TestApp_GenerateImagePrompt_NoEndpoint(t *testing.T) {
	app := NewApp()
	app.characters = []compose.Character{{ID: 1, Name: "Elara"}}
	app.activeCharID = 1
	_, _, err := app.GenerateImagePrompt(1, "natural")
	assert.Error(t, err, "no default endpoint configured")
}

func TestApp_PortraitAndProjectImageDelegators(t *testing.T) {
	app := NewApp()
	app.characters = []compose.Character{{ID: 1, Name: "Elara"}}
	app.activeCharID = 1

	require.NoError(t, app.SavePortrait(1, []byte{1, 2, 3}))
	assert.Equal(t, []byte{1, 2, 3}, app.GetPortrait(1))
	assert.Error(t, app.SavePortrait(999, []byte{9}), "unknown character")

	app.SaveProjectImage([]byte{4, 5})
	assert.Equal(t, []byte{4, 5}, app.GetProjectImage())
}
