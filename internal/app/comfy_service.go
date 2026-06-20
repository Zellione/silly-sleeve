package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"silly-sleeve/internal/comfy"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/settings"
)

// ComfyUIService owns all ComfyUI integration: the workflow registry stored in
// settings, client construction, model/sampler discovery, and image generation.
// It is decomposed out of App; App keeps thin delegating bindings so the Wails
// surface stays identical.
//
// settings points at App's live settings field (whose address is stable across
// SaveSettings reassignment), and ctx reads App's context lazily because it is
// only available after startup.
type ComfyUIService struct {
	settings *settings.Settings
	ctx      func() context.Context

	// newClient is the injectable factory for the HTTP client seam; when nil
	// the production comfy.NewClient is used.
	newClient func(baseURL string, token *string) comfy.ComfyClient
}

// clientFactory returns the injected client factory, or the production one.
func (s *ComfyUIService) clientFactory() func(baseURL string, token *string) comfy.ComfyClient {
	if s.newClient != nil {
		return s.newClient
	}
	return func(baseURL string, token *string) comfy.ComfyClient {
		return comfy.NewClient(baseURL, token)
	}
}

// GetComfyConfig returns the ComfyUI connection settings.
func (s *ComfyUIService) GetComfyConfig() settings.ComfyConfig {
	return s.settings.Comfy
}

// ImportComfyWorkflow reads a workflow JSON file, parses it, and stores it in settings.
func (s *ComfyUIService) ImportComfyWorkflow(filePath string) (comfy.ComfyWorkflow, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return comfy.ComfyWorkflow{}, fmt.Errorf("read workflow file: %w", err)
	}

	wf, err := comfy.ParseWorkflow(data)
	if err != nil {
		return comfy.ComfyWorkflow{}, fmt.Errorf("parse workflow: %w", err)
	}

	params := wf.ExtractParams(0)

	baseName := filePath
	if idx := strings.LastIndexByte(baseName, '/'); idx >= 0 {
		baseName = baseName[idx+1:]
	}
	if idx := strings.LastIndexByte(baseName, '.'); idx >= 0 {
		baseName = baseName[:idx]
	}

	cw := comfy.ComfyWorkflow{
		ID:       fmt.Sprintf("wf-%d", len(s.settings.Comfy.Workflows)+1),
		Name:     baseName,
		JSONData: comfy.JSONString(data),
		Params:   params,
	}

	s.settings.Comfy.Workflows = append(s.settings.Comfy.Workflows, cw)
	if err := settings.Save(*s.settings); err != nil {
		return comfy.ComfyWorkflow{}, fmt.Errorf("save settings: %w", err)
	}

	return cw, nil
}

// GetComfyWorkflows returns all saved ComfyUI workflows.
func (s *ComfyUIService) GetComfyWorkflows() []comfy.ComfyWorkflow {
	return s.settings.Comfy.Workflows
}

// DeleteComfyWorkflow removes a workflow by ID.
func (s *ComfyUIService) DeleteComfyWorkflow(id string) error {
	filtered := make([]comfy.ComfyWorkflow, 0, len(s.settings.Comfy.Workflows))
	for _, wf := range s.settings.Comfy.Workflows {
		if wf.ID != id {
			filtered = append(filtered, wf)
		}
	}
	s.settings.Comfy.Workflows = filtered
	if s.settings.Comfy.DefaultWorkflow == id {
		s.settings.Comfy.DefaultWorkflow = ""
	}
	return settings.Save(*s.settings)
}

// TestComfyUIEndpoint verifies connectivity to a ComfyUI instance.
func (s *ComfyUIService) TestComfyUIEndpoint(url, token string) llm.TestResult {
	var t *string
	if token != "" {
		t = &token
	}
	client := s.clientFactory()(url, t)
	if err := client.TestConnection(); err != nil {
		return llm.TestResult{
			Ok:    false,
			Error: err.Error(),
		}
	}
	return llm.TestResult{
		Ok: true,
	}
}

// GeneratePortrait starts 4 ComfyUI generation jobs with seed offsets and returns the images.
func (s *ComfyUIService) GeneratePortrait(params comfy.GenerationParams) ([]comfy.CompletedImage, error) {
	return s.generateVariants(params, 4)
}

// GenerateProjectImage starts 3 ComfyUI generation jobs with seed offsets and returns the images.
func (s *ComfyUIService) GenerateProjectImage(params comfy.GenerationParams) ([]comfy.CompletedImage, error) {
	return s.generateVariants(params, 3)
}

func (s *ComfyUIService) generateVariants(params comfy.GenerationParams, count int) ([]comfy.CompletedImage, error) {
	var t *string
	if s.settings.Comfy.AuthToken != nil {
		t = s.settings.Comfy.AuthToken
	}

	var allImages []comfy.CompletedImage
	for i := 0; i < count; i++ {
		variantParams := params
		variantParams.Seed = params.Seed + i

		g := comfy.NewGenerator(s.ctx(), s.settings.Comfy.URL, t)
		if err := g.Run(variantParams, nil); err != nil {
			return nil, fmt.Errorf("variant %d: %w", i+1, err)
		}
		allImages = append(allImages, g.Images()...)
	}
	return allImages, nil
}

// GetComfyWorkflowByName returns a saved workflow by name, or the first workflow if name is empty.
func (s *ComfyUIService) GetComfyWorkflowByName(name string) (comfy.ComfyWorkflow, error) {
	for _, wf := range s.settings.Comfy.Workflows {
		if wf.Name == name || name == "" {
			return wf, nil
		}
	}
	return comfy.ComfyWorkflow{}, workflowNotFound(name)
}

// GetComfyWorkflowTemplate returns the workflow template JSON for a given workflow ID.
// Returns the built-in template for known preset IDs, or the stored template/data for saved workflows.
func (s *ComfyUIService) GetComfyWorkflowTemplate(id string) (string, error) {
	if tmpl, ok := comfy.GetBuiltInTemplate(id); ok {
		return tmpl, nil
	}

	for _, wf := range s.settings.Comfy.Workflows {
		if wf.ID == id {
			if len(wf.Template) > 0 {
				return string(wf.Template), nil
			}
			return string(wf.JSONData), nil
		}
	}

	return "", workflowNotFound(id)
}

// SaveComfyWorkflowTemplate stores an edited workflow template.
func (s *ComfyUIService) SaveComfyWorkflowTemplate(id, template string) error {
	for i, wf := range s.settings.Comfy.Workflows {
		if wf.ID == id {
			s.settings.Comfy.Workflows[i].Template = comfy.JSONString(template)
			return settings.Save(*s.settings)
		}
	}
	return workflowNotFound(id)
}

func (s *ComfyUIService) comfyClient() (comfy.ComfyClient, error) {
	url := s.settings.Comfy.URL
	if url == "" {
		return nil, fmt.Errorf("ComfyUI URL not configured")
	}
	var t *string
	if s.settings.Comfy.AuthToken != nil {
		t = s.settings.Comfy.AuthToken
	}
	return s.clientFactory()(url, t), nil
}

// GetComfySamplers returns available sampler names from ComfyUI.
func (s *ComfyUIService) GetComfySamplers() ([]string, error) {
	client, err := s.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("KSampler", "sampler_name")
}

// GetComfySchedulers returns available scheduler names from ComfyUI.
func (s *ComfyUIService) GetComfySchedulers() ([]string, error) {
	client, err := s.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("KSampler", "scheduler")
}

// GetComfyCheckpoints returns available checkpoint model names from ComfyUI.
func (s *ComfyUIService) GetComfyCheckpoints() ([]string, error) {
	client, err := s.comfyClient()
	if err != nil {
		return nil, err
	}
	values, err := client.GetNodeInputList("CheckpointLoaderSimple", "ckpt_name")
	if err != nil {
		return nil, err
	}
	return values, nil
}

// GetComfyVAEs returns available VAE model names from ComfyUI.
func (s *ComfyUIService) GetComfyVAEs() ([]string, error) {
	client, err := s.comfyClient()
	if err != nil {
		return nil, err
	}
	values, err := client.GetNodeInputList("VAELoader", "vae_name")
	if err != nil {
		return nil, err
	}
	return values, nil
}

// GetComfyLoRAs returns available LoRA model names from ComfyUI.
func (s *ComfyUIService) GetComfyLoRAs() ([]string, error) {
	client, err := s.comfyClient()
	if err != nil {
		return nil, err
	}
	values, err := client.GetNodeInputList("LoraLoader", "lora_name")
	if err != nil {
		return nil, err
	}
	return values, nil
}

// ParseComfyWorkflowParams extracts WorkflowParams from raw workflow JSON.
func (s *ComfyUIService) ParseComfyWorkflowParams(jsonData string) (comfy.WorkflowParams, error) {
	wf, err := comfy.ParseWorkflow(json.RawMessage(jsonData))
	if err != nil {
		return comfy.WorkflowParams{}, err
	}
	return wf.ExtractParams(0), nil
}
