package comfy

import "encoding/json"

var defaultWorkflowTemplate = json.RawMessage([]byte(`{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "{{ckpt_name}}"
    }
  },
  "2": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "{{width}}",
      "height": "{{height}}",
      "batch_size": 1
    }
  },
  "3": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "{{positive_prompt}}",
      "clip": ["1", 1]
    }
  },
  "4": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "{{negative_prompt}}",
      "clip": ["1", 1]
    }
  },
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "{{seed}}",
      "steps": "{{steps}}",
      "cfg": "{{cfg}}",
      "sampler_name": "{{sampler}}",
      "scheduler": "{{scheduler}}",
      "denoise": "{{denoise}}",
      "model": ["1", 0],
      "positive": ["3", 0],
      "negative": ["4", 0],
      "latent_image": ["2", 0]
    }
  },
  "6": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["5", 0],
      "vae": ["1", 2]
    }
  },
  "7": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "SillySleeve",
      "images": ["6", 0]
    }
  }
}`))

var builtInIDs = map[string]bool{
	"portrait_sdxl": true,
	"illustrious":   true,
	"flux":          true,
	"sdxl_cover":    true,
	"flux_banner":   true,
	"painterly":     true,
}

// GetBuiltInTemplate returns the default workflow template for a built-in ID.
func GetBuiltInTemplate(id string) (json.RawMessage, bool) {
	if builtInIDs[id] {
		return defaultWorkflowTemplate, true
	}
	return nil, false
}
