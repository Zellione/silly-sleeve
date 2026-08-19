# Built-in Krea 2 Turbo + Z-Image Turbo image workflows (feature/krea2-zturbo-workflows)

User request: "for image creation, add a default krea 2 and a zturbo workflow."

## Key design facts

- Both models ship as **split files** (diffusion model + text encoder + VAE), not
  all-in-one checkpoints, so they cannot run through the existing
  CheckpointLoaderSimple built-in graph.
- `internal/comfy/templates.go` now has two template families:
  - checkpoint family (the six original IDs, unchanged output), and
  - `splitModelSpec` family: `krea2` and `zturbo` IDs via `builtInSplitSpecs`.
- Split graphs mirror ComfyUI's official templates (`image_krea2_turbo_t2i`,
  `image_z_image_turbo` in Comfy-Org/workflow_templates):
  - krea2: UNETLoader `krea2_turbo_fp8_scaled.safetensors`, CLIPLoader
    `qwen3vl_4b_fp8_scaled.safetensors` type `krea2`, VAELoader
    `qwen_image_vae.safetensors`, EmptyLatentImage.
  - zturbo: UNETLoader `z_image_turbo_bf16.safetensors`, CLIPLoader
    `qwen_3_4b.safetensors` type `lumina2`, VAELoader `ae.safetensors`,
    EmptySD3LatentImage, ModelSamplingAuraFlow shift 3 before the sampler.
- Node IDs: UNet reuses slot "1", CLIPLoader "10", ModelSamplingAuraFlow "11";
  shared encode/sample/decode/save tail extracted into `addSamplingNodes`.
- VAE loader is **always present** in split graphs (no baked VAE exists):
  empty selection → official default file; picked VAE → `{{vae}}` variant.
  LoRA → `LoraLoaderModelOnly` (model path only; the text encoder is separate).
- `matchBuiltInFamily` replaces the old single-family compare in
  IsBuiltInTemplate/ResolveWorkflowTemplate — resolution stays within family.
- UNet/text-encoder file names are hardcoded (checkpoint dropdown lists
  models/checkpoints, wrong folder); users edit the template for other files.
- Deviation from official graphs: negative prompt stays a CLIPTextEncode
  (official uses ConditioningZeroOut); free at CFG 1, functional above it.

## Frontend

- `WorkflowOption` gained required `cfg`; both screens apply `w.cfg` in
  onWorkflowChange; `mapWorkflows` defaults `cfg: wf.params.cfg || 7`.
- New presets on both screens: 8 steps, CFG 1; krea2 `euler`+`simple`,
  zturbo `res_multistep`+`simple`; 832×1216 portrait, 1344×768 project image.
- **Behavior change**: existing flux presets now default CFG 1 (distilled
  models fry at CFG 7); SDXL presets keep CFG 7.

## Gotcha

Z-Image/krea2 sizes must be divisible by 32 (832×1216 and 1344×768 both are).
