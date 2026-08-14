package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/comfy"
	"silly-sleeve/internal/settings"
)

// newTestComfyService builds a ComfyUIService over the given settings value,
// mirroring how NewApp wires it (live settings pointer + lazy context).
func newTestComfyService(set *settings.Settings) *ComfyUIService {
	return &ComfyUIService{
		settings: set,
		ctx:      func() context.Context { return context.Background() },
	}
}

// fakeComfyClient is an in-memory comfy.ComfyClient for testing the service
// without a real ComfyUI instance.
type fakeComfyClient struct {
	testErr   error
	lists     map[string][]string
	listErr   error
	testCalls int
}

func (f *fakeComfyClient) TestConnection() error {
	f.testCalls++
	return f.testErr
}

func (f *fakeComfyClient) GetNodeInputList(nodeType, inputName string) ([]string, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.lists[nodeType+"."+inputName], nil
}

func newTestComfyServiceWithClient(set *settings.Settings, c comfy.ComfyClient) *ComfyUIService {
	svc := newTestComfyService(set)
	svc.newClient = func(string, *string) comfy.ComfyClient { return c }
	return svc
}

func TestComfyService_GetComfyConfig(t *testing.T) {
	set := settings.Settings{Comfy: settings.ComfyConfig{URL: "http://localhost:8188"}}
	svc := newTestComfyService(&set)
	assert.Equal(t, "http://localhost:8188", svc.GetComfyConfig().URL)
}

func TestComfyService_ImportAndListWorkflows(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	wfPath := filepath.Join(t.TempDir(), "my-workflow.json")
	require.NoError(t, os.WriteFile(wfPath, []byte(`{"nodes":{}}`), 0o600))

	set := settings.Settings{}
	svc := newTestComfyService(&set)

	cw, err := svc.ImportComfyWorkflow(wfPath)
	require.NoError(t, err)
	assert.Equal(t, "my-workflow", cw.Name)
	assert.Equal(t, "wf-1", cw.ID)

	all := svc.GetComfyWorkflows()
	require.Len(t, all, 1)
	assert.Equal(t, "my-workflow", all[0].Name)
}

func TestComfyService_ImportComfyWorkflow_MissingFile(t *testing.T) {
	set := settings.Settings{}
	svc := newTestComfyService(&set)
	_, err := svc.ImportComfyWorkflow(filepath.Join(t.TempDir(), "nope.json"))
	assert.Error(t, err)
}

func TestComfyService_DeleteComfyWorkflow(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	set := settings.Settings{Comfy: settings.ComfyConfig{
		Workflows: []comfy.ComfyWorkflow{
			{ID: "wf-1", Name: "a"},
			{ID: "wf-2", Name: "b"},
		},
		DefaultWorkflow: "wf-1",
	}}
	svc := newTestComfyService(&set)

	require.NoError(t, svc.DeleteComfyWorkflow("wf-1"))
	remaining := svc.GetComfyWorkflows()
	require.Len(t, remaining, 1)
	assert.Equal(t, "wf-2", remaining[0].ID)
	assert.Empty(t, svc.GetComfyConfig().DefaultWorkflow, "default cleared when its workflow is deleted")
}

func TestComfyService_GetComfyWorkflowByName(t *testing.T) {
	set := settings.Settings{Comfy: settings.ComfyConfig{
		Workflows: []comfy.ComfyWorkflow{{ID: "wf-1", Name: "first"}, {ID: "wf-2", Name: "second"}},
	}}
	svc := newTestComfyService(&set)

	wf, err := svc.GetComfyWorkflowByName("second")
	require.NoError(t, err)
	assert.Equal(t, "wf-2", wf.ID)

	wf, err = svc.GetComfyWorkflowByName("")
	require.NoError(t, err)
	assert.Equal(t, "wf-1", wf.ID, "empty name returns the first workflow")

	_, err = svc.GetComfyWorkflowByName("missing")
	assert.Error(t, err)
}

func TestComfyService_GetComfyWorkflowTemplate(t *testing.T) {
	set := settings.Settings{Comfy: settings.ComfyConfig{
		Workflows: []comfy.ComfyWorkflow{
			{ID: "wf-stored", Template: comfy.JSONString(`{"edited":true}`)},
			{ID: "wf-raw", JSONData: comfy.JSONString(`{"raw":true}`)},
		},
	}}
	svc := newTestComfyService(&set)

	tmpl, err := svc.GetComfyWorkflowTemplate("portrait_sdxl")
	require.NoError(t, err)
	assert.Contains(t, tmpl, "CheckpointLoaderSimple", "built-in ID returns the bundled template")

	tmpl, err = svc.GetComfyWorkflowTemplate("wf-stored")
	require.NoError(t, err)
	assert.Equal(t, `{"edited":true}`, tmpl, "edited template wins over raw data")

	tmpl, err = svc.GetComfyWorkflowTemplate("wf-raw")
	require.NoError(t, err)
	assert.Equal(t, `{"raw":true}`, tmpl, "falls back to JSONData when no edited template")

	_, err = svc.GetComfyWorkflowTemplate("does-not-exist")
	assert.Error(t, err)
}

func TestComfyService_SaveComfyWorkflowTemplate(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	set := settings.Settings{Comfy: settings.ComfyConfig{
		Workflows: []comfy.ComfyWorkflow{{ID: "wf-1", JSONData: comfy.JSONString(`{"raw":true}`)}},
	}}
	svc := newTestComfyService(&set)

	require.NoError(t, svc.SaveComfyWorkflowTemplate("wf-1", `{"edited":true}`))
	tmpl, err := svc.GetComfyWorkflowTemplate("wf-1")
	require.NoError(t, err)
	assert.Equal(t, `{"edited":true}`, tmpl)

	assert.Error(t, svc.SaveComfyWorkflowTemplate("missing", `{}`))
}

func TestComfyService_ParseComfyWorkflowParams(t *testing.T) {
	set := settings.Settings{}
	svc := newTestComfyService(&set)

	_, err := svc.ParseComfyWorkflowParams(`{"nodes":{}}`)
	assert.NoError(t, err)

	_, err = svc.ParseComfyWorkflowParams(`{not json`)
	assert.Error(t, err)
}

func TestComfyService_DiscoveryViaInjectedClient(t *testing.T) {
	fake := &fakeComfyClient{lists: map[string][]string{
		"KSampler.sampler_name":            {"euler", "dpmpp_2m"},
		"CheckpointLoaderSimple.ckpt_name": {"sdxl.safetensors"},
	}}
	set := settings.Settings{Comfy: settings.ComfyConfig{URL: "http://comfy"}}
	svc := newTestComfyServiceWithClient(&set, fake)

	samplers, err := svc.GetComfySamplers()
	require.NoError(t, err)
	assert.Equal(t, []string{"euler", "dpmpp_2m"}, samplers)

	ckpts, err := svc.GetComfyCheckpoints()
	require.NoError(t, err)
	assert.Equal(t, []string{"sdxl.safetensors"}, ckpts)
}

func TestComfyService_DiscoveryPropagatesClientError(t *testing.T) {
	fake := &fakeComfyClient{listErr: assert.AnError}
	set := settings.Settings{Comfy: settings.ComfyConfig{URL: "http://comfy"}}
	svc := newTestComfyServiceWithClient(&set, fake)

	_, err := svc.GetComfyVAEs()
	assert.ErrorIs(t, err, assert.AnError)
}

func TestComfyService_TestEndpointViaInjectedClient(t *testing.T) {
	set := settings.Settings{}

	ok := newTestComfyServiceWithClient(&set, &fakeComfyClient{})
	res := ok.TestComfyUIEndpoint("http://comfy", "")
	assert.True(t, res.Ok)
	assert.Empty(t, res.Error)

	bad := newTestComfyServiceWithClient(&set, &fakeComfyClient{testErr: assert.AnError})
	res = bad.TestComfyUIEndpoint("http://comfy", "tok")
	assert.False(t, res.Ok)
	assert.NotEmpty(t, res.Error)
}

func TestComfyService_ClientErrorsWithoutURL(t *testing.T) {
	set := settings.Settings{} // no Comfy.URL configured
	svc := newTestComfyService(&set)

	_, err := svc.GetComfySamplers()
	assert.Error(t, err, "model discovery should fail when the ComfyUI URL is unset")
}

// TestComfyService_NilSlicesNeverCrossWailsBridge verifies that all slice-returning
// methods return non-nil slices on success. Go nil slices cross the Wails bridge as
// JS null, which the frontend uses as the "user cancelled" sentinel. Returning nil
// on a success path causes the frontend's useState<string[]> to store null, breaking
// subsequent .map() calls. Error paths returning (nil, err) are fine.
func TestComfyService_NilSlicesNeverCrossWailsBridge(t *testing.T) {
	type testCase struct {
		name      string
		fn        func(*ComfyUIService) ([]string, error)
		fakeList  map[string][]string
		wantEmpty bool // true if we expect an empty slice; false if we expect nil from client
	}

	tests := []testCase{
		{
			name:      "GetComfySamplers with nil from client",
			fn:        (*ComfyUIService).GetComfySamplers,
			fakeList:  map[string][]string{"KSampler.sampler_name": nil},
			wantEmpty: true, // must return []string{}, not nil
		},
		{
			name:      "GetComfySamplers with empty from client",
			fn:        (*ComfyUIService).GetComfySamplers,
			fakeList:  map[string][]string{"KSampler.sampler_name": {}},
			wantEmpty: true,
		},
		{
			name:      "GetComfySamplers with data from client",
			fn:        (*ComfyUIService).GetComfySamplers,
			fakeList:  map[string][]string{"KSampler.sampler_name": {"euler"}},
			wantEmpty: false,
		},
		{
			name:      "GetComfySchedulers with nil from client",
			fn:        (*ComfyUIService).GetComfySchedulers,
			fakeList:  map[string][]string{"KSampler.scheduler": nil},
			wantEmpty: true,
		},
		{
			name:      "GetComfySchedulers with empty from client",
			fn:        (*ComfyUIService).GetComfySchedulers,
			fakeList:  map[string][]string{"KSampler.scheduler": {}},
			wantEmpty: true,
		},
		{
			name:      "GetComfySchedulers with data from client",
			fn:        (*ComfyUIService).GetComfySchedulers,
			fakeList:  map[string][]string{"KSampler.scheduler": {"normal"}},
			wantEmpty: false,
		},
		{
			name:      "GetComfyCheckpoints with nil from client",
			fn:        (*ComfyUIService).GetComfyCheckpoints,
			fakeList:  map[string][]string{"CheckpointLoaderSimple.ckpt_name": nil},
			wantEmpty: true,
		},
		{
			name:      "GetComfyCheckpoints with empty from client",
			fn:        (*ComfyUIService).GetComfyCheckpoints,
			fakeList:  map[string][]string{"CheckpointLoaderSimple.ckpt_name": {}},
			wantEmpty: true,
		},
		{
			name:      "GetComfyCheckpoints with data from client",
			fn:        (*ComfyUIService).GetComfyCheckpoints,
			fakeList:  map[string][]string{"CheckpointLoaderSimple.ckpt_name": {"model.safetensors"}},
			wantEmpty: false,
		},
		{
			name:      "GetComfyVAEs with nil from client",
			fn:        (*ComfyUIService).GetComfyVAEs,
			fakeList:  map[string][]string{"VAELoader.vae_name": nil},
			wantEmpty: true,
		},
		{
			name:      "GetComfyVAEs with empty from client",
			fn:        (*ComfyUIService).GetComfyVAEs,
			fakeList:  map[string][]string{"VAELoader.vae_name": {}},
			wantEmpty: true,
		},
		{
			name:      "GetComfyVAEs with data from client",
			fn:        (*ComfyUIService).GetComfyVAEs,
			fakeList:  map[string][]string{"VAELoader.vae_name": {"vae.safetensors"}},
			wantEmpty: false,
		},
		{
			name:      "GetComfyLoRAs with nil from client",
			fn:        (*ComfyUIService).GetComfyLoRAs,
			fakeList:  map[string][]string{"LoraLoader.lora_name": nil},
			wantEmpty: true,
		},
		{
			name:      "GetComfyLoRAs with empty from client",
			fn:        (*ComfyUIService).GetComfyLoRAs,
			fakeList:  map[string][]string{"LoraLoader.lora_name": {}},
			wantEmpty: true,
		},
		{
			name:      "GetComfyLoRAs with data from client",
			fn:        (*ComfyUIService).GetComfyLoRAs,
			fakeList:  map[string][]string{"LoraLoader.lora_name": {"lora.safetensors"}},
			wantEmpty: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fake := &fakeComfyClient{lists: tc.fakeList}
			set := settings.Settings{Comfy: settings.ComfyConfig{URL: "http://comfy"}}
			svc := newTestComfyServiceWithClient(&set, fake)

			result, err := tc.fn(svc)
			require.NoError(t, err, "success path should not error")

			// The critical assertion: result must never be nil, even if the client
			// returned nil. Go nil becomes JS null, breaking the frontend's .map().
			assert.NotNil(t, result, "slice must not be nil (would cross bridge as null)")

			if tc.wantEmpty {
				assert.Empty(t, result, "expected empty slice")
			}
		})
	}
}

// TestComfyService_GetComfyWorkflowsNeverNil verifies that GetComfyWorkflows
// returns a non-nil slice even when settings has no workflows saved.
func TestComfyService_GetComfyWorkflowsNeverNil(t *testing.T) {
	type testCase struct {
		name      string
		workflows []comfy.ComfyWorkflow
		wantEmpty bool
	}

	tests := []testCase{
		{
			name:      "nil workflows in settings",
			workflows: nil,
			wantEmpty: true, // must return []ComfyWorkflow{}, not nil
		},
		{
			name:      "empty workflows slice in settings",
			workflows: []comfy.ComfyWorkflow{},
			wantEmpty: true,
		},
		{
			name: "workflows present",
			workflows: []comfy.ComfyWorkflow{
				{ID: "wf-1", Name: "test"},
			},
			wantEmpty: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			set := settings.Settings{Comfy: settings.ComfyConfig{Workflows: tc.workflows}}
			svc := newTestComfyService(&set)

			result := svc.GetComfyWorkflows()

			// The critical assertion: result must never be nil.
			assert.NotNil(t, result, "slice must not be nil (would cross bridge as null)")

			if tc.wantEmpty {
				assert.Empty(t, result, "expected empty slice")
			}
		})
	}
}
