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

// decodeGraph parses a rendered template back into a node graph for assertions.
func decodeGraph(t *testing.T, tmpl string) map[string]map[string]any {
	t.Helper()
	var raw map[string]map[string]any
	require.NoError(t, json.Unmarshal([]byte(tmpl), &raw))
	return raw
}

func nodeInput(t *testing.T, graph map[string]map[string]any, node, input string) any {
	t.Helper()
	inputs, ok := graph[node]["inputs"].(map[string]any)
	require.True(t, ok, "node %s has no inputs map", node)
	return inputs[input]
}

func TestBuildWorkflowTemplate_BaselineHasNoLoaderNodes(t *testing.T) {
	graph := decodeGraph(t, buildWorkflowTemplate(false, false))

	assert.NotContains(t, graph, nodeVAELoader, "baked VAE must not add a VAELoader")
	assert.NotContains(t, graph, nodeLoRALoader, "no LoRA must not add a LoraLoader")
	// VAEDecode falls back to the checkpoint's third output (the baked VAE).
	assert.Equal(t, []any{nodeCheckpoint, float64(2)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
	assert.Equal(t, []any{nodeCheckpoint, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
	assert.Equal(t, []any{nodeCheckpoint, float64(1)}, nodeInput(t, graph, nodePositive, "clip"))
}

func TestBuildWorkflowTemplate_VAELoaderRewiresDecode(t *testing.T) {
	graph := decodeGraph(t, buildWorkflowTemplate(true, false))

	require.Contains(t, graph, nodeVAELoader)
	assert.Equal(t, "VAELoader", graph[nodeVAELoader]["class_type"])
	assert.Equal(t, "{{vae}}", nodeInput(t, graph, nodeVAELoader, "vae_name"))
	assert.Equal(t, []any{nodeVAELoader, float64(0)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
	// The model path is untouched by a VAE selection.
	assert.Equal(t, []any{nodeCheckpoint, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
}

func TestBuildWorkflowTemplate_LoRARewiresModelAndClip(t *testing.T) {
	graph := decodeGraph(t, buildWorkflowTemplate(false, true))

	require.Contains(t, graph, nodeLoRALoader)
	assert.Equal(t, "LoraLoader", graph[nodeLoRALoader]["class_type"])
	assert.Equal(t, "{{lora}}", nodeInput(t, graph, nodeLoRALoader, "lora_name"))
	// Sampler takes the LoRA-patched model, encoders take the LoRA-patched clip.
	assert.Equal(t, []any{nodeLoRALoader, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
	assert.Equal(t, []any{nodeLoRALoader, float64(1)}, nodeInput(t, graph, nodePositive, "clip"))
	assert.Equal(t, []any{nodeLoRALoader, float64(1)}, nodeInput(t, graph, nodeNegative, "clip"))
	// The LoRA loader itself still reads from the checkpoint.
	assert.Equal(t, []any{nodeCheckpoint, float64(0)}, nodeInput(t, graph, nodeLoRALoader, "model"))
	// VAE path untouched by a LoRA selection.
	assert.Equal(t, []any{nodeCheckpoint, float64(2)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
}

func TestBuildWorkflowTemplate_BothLoadersCoexist(t *testing.T) {
	graph := decodeGraph(t, buildWorkflowTemplate(true, true))

	require.Contains(t, graph, nodeVAELoader)
	require.Contains(t, graph, nodeLoRALoader)
	assert.Equal(t, []any{nodeVAELoader, float64(0)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
	assert.Equal(t, []any{nodeLoRALoader, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
}

func TestBuildWorkflowTemplate_EveryVariantIsValidJSONAndComplete(t *testing.T) {
	for _, tc := range []struct{ vae, lora bool }{
		{false, false}, {true, false}, {false, true}, {true, true},
	} {
		graph := decodeGraph(t, buildWorkflowTemplate(tc.vae, tc.lora))
		for _, required := range []string{
			nodeCheckpoint, nodeLatent, nodePositive, nodeNegative,
			nodeSampler, nodeVAEDecode, nodeSaveImage,
		} {
			assert.Contains(t, graph, required, "variant vae=%t lora=%t missing node %s", tc.vae, tc.lora, required)
		}
	}
}

func TestUsesVAEAndUsesLoRA_SentinelsMeanOmitTheNode(t *testing.T) {
	assert.False(t, UsesVAE(""), "empty selection means baked VAE")
	assert.False(t, UsesVAE("baked"))
	assert.True(t, UsesVAE("sdxl_vae_fp16_fix.safetensors"))

	assert.False(t, UsesLoRA(""), "empty selection means no LoRA")
	assert.False(t, UsesLoRA("none"))
	assert.True(t, UsesLoRA("oil_painting_v3.safetensors"))
}

func TestIsBuiltInTemplate(t *testing.T) {
	for _, tc := range []struct{ vae, lora bool }{
		{false, false}, {true, false}, {false, true}, {true, true},
	} {
		assert.True(t, IsBuiltInTemplate(buildWorkflowTemplate(tc.vae, tc.lora)),
			"variant vae=%t lora=%t should be recognised as built-in", tc.vae, tc.lora)
	}
	assert.False(t, IsBuiltInTemplate(`{"1":{"class_type":"CheckpointLoaderSimple"}}`))
	assert.False(t, IsBuiltInTemplate(""))
}

func TestResolveWorkflowTemplate_SwapsBuiltInVariant(t *testing.T) {
	base := buildWorkflowTemplate(false, false)

	assert.Equal(t, buildWorkflowTemplate(true, false),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "sdxl_vae.safetensors", "none"))
	assert.Equal(t, buildWorkflowTemplate(false, true),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "baked", "oil.safetensors"))
	assert.Equal(t, buildWorkflowTemplate(true, true),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "sdxl_vae.safetensors", "oil.safetensors"))
	assert.Equal(t, base, ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "baked", "none"))
}

func TestResolveWorkflowTemplate_LeavesUserEditedTemplateAlone(t *testing.T) {
	custom := `{"1":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"{{model}}","vae":"{{vae}}"}}}`

	assert.Equal(t, custom, ResolveWorkflowTemplate(custom, ModelKindCheckpoint, "", "sdxl_vae.safetensors", "oil.safetensors"),
		"a hand-edited template must never be silently replaced")
}

func TestBuildPlaceholderValues_AlwaysSuppliesVaeLoraAndClip(t *testing.T) {
	// Even with no selection the keys must exist: replaceStringPlaceholder
	// errors on an unknown placeholder, so a custom workflow referencing
	// {{vae}} would fail to generate if these were conditional.
	values := BuildPlaceholderValues(GenerationParams{})
	assert.Contains(t, values, "vae")
	assert.Contains(t, values, "lora")
	assert.Contains(t, values, "clip")

	values = BuildPlaceholderValues(GenerationParams{Vae: "v.safetensors", Lora: "l.safetensors", Clip: "c.safetensors"})
	assert.Equal(t, "v.safetensors", values["vae"])
	assert.Equal(t, "l.safetensors", values["lora"])
	assert.Equal(t, "c.safetensors", values["clip"])
}

func TestReplacePlaceholders_ResolvesVaeAndLoraInCustomWorkflow(t *testing.T) {
	tmpl := `{"9":{"class_type":"VAELoader","inputs":{"vae_name":"{{vae}}"}},` +
		`"8":{"class_type":"LoraLoader","inputs":{"lora_name":"{{lora}}"}}}`
	values := BuildPlaceholderValues(GenerationParams{Vae: "v.safetensors", Lora: "l.safetensors"})

	out, err := ReplacePlaceholders(json.RawMessage(tmpl), nil, values)
	require.NoError(t, err)

	graph := decodeGraph(t, string(out))
	assert.Equal(t, "v.safetensors", nodeInput(t, graph, "9", "vae_name"))
	assert.Equal(t, "l.safetensors", nodeInput(t, graph, "8", "lora_name"))
}

func TestGetBuiltInTemplate_Krea2SplitLoaderGraph(t *testing.T) {
	tmpl, ok := GetBuiltInTemplate("krea2")
	require.True(t, ok)
	graph := decodeGraph(t, tmpl)

	assert.Equal(t, "UNETLoader", graph[nodeUNet]["class_type"])
	assert.Equal(t, "{{model}}", nodeInput(t, graph, nodeUNet, "unet_name"))
	assert.Equal(t, "CLIPLoader", graph[nodeCLIPLoader]["class_type"])
	assert.Equal(t, "{{clip}}", nodeInput(t, graph, nodeCLIPLoader, "clip_name"))
	assert.Equal(t, "krea2", nodeInput(t, graph, nodeCLIPLoader, "type"))
	assert.Equal(t, "VAELoader", graph[nodeVAELoader]["class_type"])
	assert.Equal(t, "{{vae}}", nodeInput(t, graph, nodeVAELoader, "vae_name"))
	assert.Equal(t, "EmptyLatentImage", graph[nodeLatent]["class_type"])
	assert.NotContains(t, graph, nodeModelSampling, "krea2 has no ModelSamplingAuraFlow node")

	// Sampler reads the plain UNet; encoders read the standalone text encoder;
	// decode reads the dedicated VAE loader.
	assert.Equal(t, []any{nodeUNet, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
	assert.Equal(t, []any{nodeCLIPLoader, float64(0)}, nodeInput(t, graph, nodePositive, "clip"))
	assert.Equal(t, []any{nodeCLIPLoader, float64(0)}, nodeInput(t, graph, nodeNegative, "clip"))
	assert.Equal(t, []any{nodeVAELoader, float64(0)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
}

func TestGetBuiltInTemplate_ZTurboSplitLoaderGraph(t *testing.T) {
	tmpl, ok := GetBuiltInTemplate("zturbo")
	require.True(t, ok)
	graph := decodeGraph(t, tmpl)

	assert.Equal(t, "{{model}}", nodeInput(t, graph, nodeUNet, "unet_name"))
	assert.Equal(t, "{{clip}}", nodeInput(t, graph, nodeCLIPLoader, "clip_name"))
	assert.Equal(t, "lumina2", nodeInput(t, graph, nodeCLIPLoader, "type"))
	assert.Equal(t, "{{vae}}", nodeInput(t, graph, nodeVAELoader, "vae_name"))
	assert.Equal(t, "EmptySD3LatentImage", graph[nodeLatent]["class_type"])

	// Z-Image needs the AuraFlow shift patch between the UNet and the sampler.
	require.Contains(t, graph, nodeModelSampling)
	assert.Equal(t, "ModelSamplingAuraFlow", graph[nodeModelSampling]["class_type"])
	assert.Equal(t, float64(3), nodeInput(t, graph, nodeModelSampling, "shift"))
	assert.Equal(t, []any{nodeUNet, float64(0)}, nodeInput(t, graph, nodeModelSampling, "model"))
	assert.Equal(t, []any{nodeModelSampling, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
}

func TestSplitWorkflowTemplate_UsesModelSelectionPlaceholders(t *testing.T) {
	for _, id := range []string{"krea2", "zturbo"} {
		tmpl, ok := GetBuiltInTemplate(id)
		require.True(t, ok, "id %q should be built-in", id)
		for _, ph := range []string{
			"{{seed}}", "{{steps}}", "{{cfg}}", "{{sampler}}", "{{scheduler}}",
			"{{denoise}}", "{{width}}", "{{height}}",
			"{{positive_prompt}}", "{{negative_prompt}}",
			// The diffusion model, text encoder and VAE come from the dropdown
			// selections: file names differ between installs, so nothing about
			// them may be hardcoded.
			"{{model}}", "{{clip}}", "{{vae}}",
		} {
			assert.Contains(t, tmpl, ph, "%s missing from %s", ph, id)
		}
	}
}

func TestBuildSplitWorkflowTemplate_VAELoaderAlwaysPresent(t *testing.T) {
	// Split models have no baked VAE, so the loader exists in every variant.
	for _, withLoRA := range []bool{false, true} {
		graph := decodeGraph(t, buildSplitWorkflowTemplate(krea2Spec, withLoRA))
		require.Contains(t, graph, nodeVAELoader)
		assert.Equal(t, "{{vae}}", nodeInput(t, graph, nodeVAELoader, "vae_name"))
		assert.Equal(t, []any{nodeVAELoader, float64(0)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
	}
}

func TestBuildSplitWorkflowTemplate_LoRAPatchesModelOnly(t *testing.T) {
	// The text encoder is a separate model, so the LoRA must patch the model
	// path only and leave the encoders reading the standalone CLIP loader.
	graph := decodeGraph(t, buildSplitWorkflowTemplate(krea2Spec, true))
	require.Contains(t, graph, nodeLoRALoader)
	assert.Equal(t, "LoraLoaderModelOnly", graph[nodeLoRALoader]["class_type"])
	assert.Equal(t, "{{lora}}", nodeInput(t, graph, nodeLoRALoader, "lora_name"))
	assert.Equal(t, []any{nodeUNet, float64(0)}, nodeInput(t, graph, nodeLoRALoader, "model"))
	assert.Equal(t, []any{nodeLoRALoader, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
	assert.Equal(t, []any{nodeCLIPLoader, float64(0)}, nodeInput(t, graph, nodePositive, "clip"))

	// With a shift patch the chain is UNet -> LoRA -> ModelSampling -> sampler.
	graph = decodeGraph(t, buildSplitWorkflowTemplate(zturboSpec, true))
	assert.Equal(t, []any{nodeUNet, float64(0)}, nodeInput(t, graph, nodeLoRALoader, "model"))
	assert.Equal(t, []any{nodeLoRALoader, float64(0)}, nodeInput(t, graph, nodeModelSampling, "model"))
	assert.Equal(t, []any{nodeModelSampling, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
}

func TestIsBuiltInTemplate_RecognisesSplitVariants(t *testing.T) {
	for _, spec := range []splitModelSpec{krea2Spec, zturboSpec} {
		for _, withLoRA := range []bool{false, true} {
			assert.True(t, IsBuiltInTemplate(buildSplitWorkflowTemplate(spec, withLoRA)),
				"%s variant lora=%t should be recognised as built-in", spec.clipType, withLoRA)
		}
	}
}

func TestResolveWorkflowTemplate_SwapsSplitVariants(t *testing.T) {
	base := buildSplitWorkflowTemplate(zturboSpec, false)

	// A VAE selection never changes the split-file graph: the loader is always
	// present and reads the {{vae}} placeholder.
	assert.Equal(t, base, ResolveWorkflowTemplate(base, "", "c.safetensors", "custom_vae.safetensors", "none"))
	assert.Equal(t, buildSplitWorkflowTemplate(zturboSpec, true),
		ResolveWorkflowTemplate(base, "", "c.safetensors", "baked", "style.safetensors"))
	assert.Equal(t, base, ResolveWorkflowTemplate(base, "", "c.safetensors", "baked", "none"))

	// Resolution must stay within the family the user selected.
	kreaBase := buildSplitWorkflowTemplate(krea2Spec, false)
	assert.Equal(t, buildSplitWorkflowTemplate(krea2Spec, true),
		ResolveWorkflowTemplate(kreaBase, "", "c.safetensors", "custom_vae.safetensors", "style.safetensors"))
}

func TestBuildSplitCheckpointTemplate_ZTurbo(t *testing.T) {
	graph := decodeGraph(t, buildSplitCheckpointTemplate(zturboSpec, false, false, false))

	assert.Equal(t, "CheckpointLoaderSimple", graph[nodeCheckpoint]["class_type"])
	assert.Equal(t, "{{model}}", nodeInput(t, graph, nodeCheckpoint, "ckpt_name"))
	assert.Equal(t, "EmptySD3LatentImage", graph[nodeLatent]["class_type"])
	assert.NotContains(t, graph, nodeCLIPLoader, "a checkpoint carries a baked encoder")
	assert.NotContains(t, graph, nodeVAELoader, "baked VAE by default")

	// The architecture still needs its sampling shift on the checkpoint path.
	require.Contains(t, graph, nodeModelSampling)
	assert.Equal(t, float64(3), nodeInput(t, graph, nodeModelSampling, "shift"))
	assert.Equal(t, []any{nodeCheckpoint, float64(0)}, nodeInput(t, graph, nodeModelSampling, "model"))
	assert.Equal(t, []any{nodeModelSampling, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
	assert.Equal(t, []any{nodeCheckpoint, float64(1)}, nodeInput(t, graph, nodePositive, "clip"))
	assert.Equal(t, []any{nodeCheckpoint, float64(2)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
}

func TestBuildSplitCheckpointTemplate_VAEAndLoRA(t *testing.T) {
	graph := decodeGraph(t, buildSplitCheckpointTemplate(zturboSpec, false, true, true))

	assert.Equal(t, "{{vae}}", nodeInput(t, graph, nodeVAELoader, "vae_name"))
	assert.Equal(t, []any{nodeVAELoader, float64(0)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
	// A checkpoint has a baked clip, so the full LoraLoader patches both paths.
	assert.Equal(t, "LoraLoader", graph[nodeLoRALoader]["class_type"])
	assert.Equal(t, []any{nodeCheckpoint, float64(0)}, nodeInput(t, graph, nodeLoRALoader, "model"))
	assert.Equal(t, []any{nodeLoRALoader, float64(0)}, nodeInput(t, graph, nodeModelSampling, "model"))
	assert.Equal(t, []any{nodeModelSampling, float64(0)}, nodeInput(t, graph, nodeSampler, "model"))
	assert.Equal(t, []any{nodeLoRALoader, float64(1)}, nodeInput(t, graph, nodePositive, "clip"))
}

func TestBuildSplitCheckpointTemplate_Krea2MatchesDefaultGraph(t *testing.T) {
	// Krea 2 checkpoints need no extra architecture nodes, so the checkpoint
	// variant is exactly the default checkpoint graph.
	for _, tc := range []struct{ vae, lora bool }{
		{false, false}, {true, false}, {false, true}, {true, true},
	} {
		assert.Equal(t, buildWorkflowTemplate(tc.vae, tc.lora),
			buildSplitCheckpointTemplate(krea2Spec, false, tc.vae, tc.lora),
			"vae=%t lora=%t", tc.vae, tc.lora)
	}
}

func TestIsBuiltInTemplate_RecognisesSplitCheckpointVariants(t *testing.T) {
	for _, tc := range []struct{ vae, lora bool }{
		{false, false}, {true, false}, {false, true}, {true, true},
	} {
		assert.True(t, IsBuiltInTemplate(buildSplitCheckpointTemplate(zturboSpec, false, tc.vae, tc.lora)),
			"zturbo checkpoint variant vae=%t lora=%t should be recognised", tc.vae, tc.lora)
	}
}

func TestResolveWorkflowTemplate_SwapsModelKind(t *testing.T) {
	base := buildSplitWorkflowTemplate(zturboSpec, false)

	// A checkpoint selection re-renders the family as the checkpoint graph,
	// with baked VAE and the VAE-loader variant respectively.
	assert.Equal(t, buildSplitCheckpointTemplate(zturboSpec, false, false, false),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "baked", "none"))
	assert.Equal(t, buildSplitCheckpointTemplate(zturboSpec, false, true, true),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "v.safetensors", "l.safetensors"))

	// And back: a checkpoint-variant template re-renders as split files when
	// the selection is a UNet.
	ckptBase := buildSplitCheckpointTemplate(zturboSpec, false, false, false)
	assert.Equal(t, base, ResolveWorkflowTemplate(ckptBase, "", "c.safetensors", "v.safetensors", "none"))
}

func TestBuildSplitCheckpointTemplate_ExplicitCLIPOverride(t *testing.T) {
	// Some community checkpoints ship without a baked text encoder: an
	// explicit CLIP selection adds a standalone CLIPLoader with the
	// architecture's type, and the encoders read it instead of the
	// checkpoint's clip output.
	graph := decodeGraph(t, buildSplitCheckpointTemplate(zturboSpec, true, false, false))

	require.Contains(t, graph, nodeCLIPLoader)
	assert.Equal(t, "CLIPLoader", graph[nodeCLIPLoader]["class_type"])
	assert.Equal(t, "{{clip}}", nodeInput(t, graph, nodeCLIPLoader, "clip_name"))
	assert.Equal(t, "lumina2", nodeInput(t, graph, nodeCLIPLoader, "type"))
	assert.Equal(t, []any{nodeCLIPLoader, float64(0)}, nodeInput(t, graph, nodePositive, "clip"))
	assert.Equal(t, []any{nodeCLIPLoader, float64(0)}, nodeInput(t, graph, nodeNegative, "clip"))
	// Model and VAE paths stay on the checkpoint.
	assert.Equal(t, []any{nodeCheckpoint, float64(0)}, nodeInput(t, graph, nodeModelSampling, "model"))
	assert.Equal(t, []any{nodeCheckpoint, float64(2)}, nodeInput(t, graph, nodeVAEDecode, "vae"))
}

func TestBuildSplitCheckpointTemplate_CLIPOverrideWithLoRA(t *testing.T) {
	// The LoRA's clip patch applies to the explicit encoder, not the
	// checkpoint's baked one.
	graph := decodeGraph(t, buildSplitCheckpointTemplate(zturboSpec, true, false, true))

	assert.Equal(t, []any{nodeCLIPLoader, float64(0)}, nodeInput(t, graph, nodeLoRALoader, "clip"))
	assert.Equal(t, []any{nodeLoRALoader, float64(1)}, nodeInput(t, graph, nodePositive, "clip"))
}

func TestResolveWorkflowTemplate_CheckpointCLIPSelection(t *testing.T) {
	base := buildSplitWorkflowTemplate(zturboSpec, false)

	assert.Equal(t, buildSplitCheckpointTemplate(zturboSpec, false, false, false),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "", "baked", "none"),
		"no clip selection means the baked encoder")
	assert.Equal(t, buildSplitCheckpointTemplate(zturboSpec, true, false, false),
		ResolveWorkflowTemplate(base, ModelKindCheckpoint, "qwen_3_4b.safetensors", "baked", "none"),
		"a clip selection adds the standalone encoder")
}
