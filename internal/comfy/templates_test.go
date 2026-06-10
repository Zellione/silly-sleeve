package comfy

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetBuiltInTemplate(t *testing.T) {
	tmpl, ok := GetBuiltInTemplate("portrait_sdxl")
	require.True(t, ok)
	require.NotEmpty(t, tmpl)

	var nodes map[string]any
	err := json.Unmarshal([]byte(tmpl), &nodes)
	require.NoError(t, err)

	assert.Contains(t, nodes, "5")
	ks, ok := nodes["5"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "KSampler", ks["class_type"])

	tmpl2, ok2 := GetBuiltInTemplate("flux")
	assert.True(t, ok2)
	assert.Equal(t, tmpl, tmpl2)
}

func TestGetBuiltInTemplate_NotFound(t *testing.T) {
	tmpl, ok := GetBuiltInTemplate("nonexistent")
	assert.False(t, ok)
	assert.Empty(t, tmpl)
}

func TestAllBuiltInIDs(t *testing.T) {
	ids := []string{"portrait_sdxl", "illustrious", "flux", "sdxl_cover", "flux_banner", "painterly"}
	for _, id := range ids {
		tmpl, ok := GetBuiltInTemplate(id)
		assert.True(t, ok, "id %q should be built-in", id)
		assert.NotEmpty(t, tmpl)
	}
}

func TestBuiltInTemplateHasPlaceholders(t *testing.T) {
	tmpl, ok := GetBuiltInTemplate("portrait_sdxl")
	require.True(t, ok)

	templateStr := tmpl
	assert.Contains(t, templateStr, "{{seed}}")
	assert.Contains(t, templateStr, "{{steps}}")
	assert.Contains(t, templateStr, "{{cfg}}")
	assert.Contains(t, templateStr, "{{sampler}}")
	assert.Contains(t, templateStr, "{{scheduler}}")
	assert.Contains(t, templateStr, "{{denoise}}")
	assert.Contains(t, templateStr, "{{width}}")
	assert.Contains(t, templateStr, "{{height}}")
	assert.Contains(t, templateStr, "{{model}}")
	assert.Contains(t, templateStr, "{{positive_prompt}}")
	assert.Contains(t, templateStr, "{{negative_prompt}}")
	assert.Contains(t, templateStr, "CheckpointLoaderSimple")
	assert.Contains(t, templateStr, "EmptyLatentImage")
	assert.Contains(t, templateStr, "CLIPTextEncode")
	assert.Contains(t, templateStr, "VAEDecode")
	assert.Contains(t, templateStr, "SaveImage")
}
