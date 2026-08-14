package comfy

import "encoding/json"

// The built-in workflow is assembled from a node graph rather than stored as a
// single fixed JSON blob, because VAE and LoRA selection cannot be expressed by
// a placeholder alone: ComfyUI's VAELoader and LoraLoader need a real model
// file, so "use the checkpoint's baked VAE" and "no LoRA" mean the node must be
// absent from the graph entirely, with its consumers rewired. Building the
// graph gives us the four variants (with/without VAE x with/without LoRA) from
// one source of truth instead of four hand-maintained copies that drift.
//
// Node IDs are stable across variants so a user who edits an exported template
// sees the same numbering they saw before.
const (
	nodeCheckpoint = "1"
	nodeLatent     = "2"
	nodePositive   = "3"
	nodeNegative   = "4"
	nodeSampler    = "5"
	nodeVAEDecode  = "6"
	nodeSaveImage  = "7"
	nodeLoRALoader = "8"
	nodeVAELoader  = "9"
)

// buildWorkflowGraph assembles the built-in workflow node graph. When withLoRA
// is set a LoraLoader is inserted between the checkpoint and both the sampler's
// model input and the text encoders' clip input. When withVAE is set a VAELoader
// supplies VAEDecode instead of the checkpoint's baked VAE.
func buildWorkflowGraph(withVAE, withLoRA bool) map[string]any {
	// Model and clip sources default to the checkpoint and are re-pointed at the
	// LoRA loader when one is present.
	modelSource := []any{nodeCheckpoint, 0}
	clipSource := []any{nodeCheckpoint, 1}
	vaeSource := []any{nodeCheckpoint, 2}

	graph := map[string]any{
		nodeCheckpoint: map[string]any{
			"class_type": "CheckpointLoaderSimple",
			"inputs":     map[string]any{"ckpt_name": "{{model}}"},
		},
		nodeLatent: map[string]any{
			"class_type": "EmptyLatentImage",
			"inputs": map[string]any{
				"width":      "{{width}}",
				"height":     "{{height}}",
				"batch_size": 1,
			},
		},
		nodeSaveImage: map[string]any{
			"class_type": "SaveImage",
			"inputs": map[string]any{
				"filename_prefix": "SillySleeve",
				"images":          []any{nodeVAEDecode, 0},
			},
		},
	}

	if withLoRA {
		graph[nodeLoRALoader] = map[string]any{
			"class_type": "LoraLoader",
			"inputs": map[string]any{
				"lora_name":      "{{lora}}",
				"strength_model": 1.0,
				"strength_clip":  1.0,
				"model":          []any{nodeCheckpoint, 0},
				"clip":           []any{nodeCheckpoint, 1},
			},
		}
		modelSource = []any{nodeLoRALoader, 0}
		clipSource = []any{nodeLoRALoader, 1}
	}

	if withVAE {
		graph[nodeVAELoader] = map[string]any{
			"class_type": "VAELoader",
			"inputs":     map[string]any{"vae_name": "{{vae}}"},
		}
		vaeSource = []any{nodeVAELoader, 0}
	}

	graph[nodePositive] = map[string]any{
		"class_type": "CLIPTextEncode",
		"inputs":     map[string]any{"text": "{{positive_prompt}}", "clip": clipSource},
	}
	graph[nodeNegative] = map[string]any{
		"class_type": "CLIPTextEncode",
		"inputs":     map[string]any{"text": "{{negative_prompt}}", "clip": clipSource},
	}
	graph[nodeSampler] = map[string]any{
		"class_type": "KSampler",
		"inputs": map[string]any{
			"seed":         "{{seed}}",
			"steps":        "{{steps}}",
			"cfg":          "{{cfg}}",
			"sampler_name": "{{sampler}}",
			"scheduler":    "{{scheduler}}",
			"denoise":      "{{denoise}}",
			"model":        modelSource,
			"positive":     []any{nodePositive, 0},
			"negative":     []any{nodeNegative, 0},
			"latent_image": []any{nodeLatent, 0},
		},
	}
	graph[nodeVAEDecode] = map[string]any{
		"class_type": "VAEDecode",
		"inputs":     map[string]any{"samples": []any{nodeSampler, 0}, "vae": vaeSource},
	}

	return graph
}

// buildWorkflowTemplate renders a workflow variant as indented JSON. The output
// is what the user sees and edits in the workflow editor, so it is formatted
// rather than compact.
func buildWorkflowTemplate(withVAE, withLoRA bool) string {
	out, err := json.MarshalIndent(buildWorkflowGraph(withVAE, withLoRA), "", "  ")
	if err != nil {
		// The graph is built from plain maps, slices, strings and numbers, so
		// marshalling cannot fail; panicking here would be unreachable in
		// practice and hostile in a desktop app, so fall back to the plain
		// variant instead.
		return ""
	}
	return string(out)
}

// defaultWorkflowTemplate is the baseline variant: the checkpoint's baked VAE
// and no LoRA. This is what GetBuiltInTemplate hands to the workflow editor.
var defaultWorkflowTemplate = buildWorkflowTemplate(false, false)

var builtInIDs = map[string]bool{
	"portrait_sdxl": true,
	"illustrious":   true,
	"flux":          true,
	"sdxl_cover":    true,
	"flux_banner":   true,
	"painterly":     true,
}

// GetBuiltInTemplate returns the default workflow template for a built-in ID.
func GetBuiltInTemplate(id string) (string, bool) {
	if builtInIDs[id] {
		return defaultWorkflowTemplate, true
	}
	return "", false
}

// IsBuiltInTemplate reports whether tmpl is one of the unmodified built-in
// variants. It lets generation swap in the variant matching the user's VAE and
// LoRA choice while leaving a hand-edited template exactly as the user wrote it
// — their template is free to reference {{vae}} and {{lora}} itself.
func IsBuiltInTemplate(tmpl string) bool {
	for _, withVAE := range []bool{false, true} {
		for _, withLoRA := range []bool{false, true} {
			if tmpl == buildWorkflowTemplate(withVAE, withLoRA) {
				return true
			}
		}
	}
	return false
}

// ResolveWorkflowTemplate returns the workflow JSON to generate with. An
// unmodified built-in template is re-rendered for the supplied VAE and LoRA
// selection; anything the user has edited is returned untouched.
func ResolveWorkflowTemplate(tmpl, vae, lora string) string {
	if !IsBuiltInTemplate(tmpl) {
		return tmpl
	}
	return buildWorkflowTemplate(UsesVAE(vae), UsesLoRA(lora))
}

// bakedVAE and noLoRA are the sentinel selections meaning "leave it out of the
// graph". They match the values the frontend sends for the default option.
const (
	bakedVAE = "baked"
	noLoRA   = "none"
)

// UsesVAE reports whether a VAE selection means "load this VAE" rather than
// "use the checkpoint's baked VAE".
func UsesVAE(vae string) bool {
	return vae != "" && vae != bakedVAE
}

// UsesLoRA reports whether a LoRA selection means "apply this LoRA" rather than
// "no LoRA".
func UsesLoRA(lora string) bool {
	return lora != "" && lora != noLoRA
}
