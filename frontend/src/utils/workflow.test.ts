import { describe, it, expect } from 'vitest';
import { mapWorkflows, parseSize, aspectFromSize, pickByHint, SPLIT_WORKFLOW_HINTS } from './workflow';
import { comfy } from '../../wailsjs/go/models';

describe('mapWorkflows', () => {
  it('maps a workflow, stripping .json and deriving size', () => {
    const wf = comfy.ComfyWorkflow.createFrom({
      id: 'wf1',
      name: 'My Workflow.json',
      params: { checkpoint: 'model.safetensors', width: 832, height: 1216, steps: 28, cfg: 4, sampler: 'dpmpp_2m', scheduler: 'karras' },
    });
    expect(mapWorkflows([wf])).toEqual([
      { id: 'wf1', name: 'My Workflow', model: 'model.safetensors', size: '832×1216', steps: 28, cfg: 4, sampler: 'dpmpp_2m', scheduler: 'karras' },
    ]);
  });

  it('falls back to defaults when params are missing', () => {
    const wf = comfy.ComfyWorkflow.createFrom({ id: 'wf2', name: 'bare', params: {} });
    expect(mapWorkflows([wf])).toEqual([
      { id: 'wf2', name: 'bare', model: 'custom', size: 'custom', steps: 20, cfg: 7, sampler: 'euler', scheduler: 'normal' },
    ]);
  });
});

describe('parseSize', () => {
  it('splits a size label into numbers', () => {
    expect(parseSize('832×1216')).toEqual([832, 1216]);
  });

  it('returns zeros for a non-size label', () => {
    expect(parseSize('custom')).toEqual([0, 0]);
  });
});

describe('pickByHint', () => {
  it('returns the first file matching the hint, case-insensitively', () => {
    expect(pickByHint(['other.safetensors', 'Z_Image_Turbo_bf16.safetensors'], 'z[-_ ]?image'))
      .toBe('Z_Image_Turbo_bf16.safetensors');
  });

  it('matches files inside subfolders', () => {
    expect(pickByHint(['Unknown/qwen3vl_4b_fp8_scaled.safetensors'], SPLIT_WORKFLOW_HINTS.krea2.clip))
      .toBe('Unknown/qwen3vl_4b_fp8_scaled.safetensors');
  });

  it('returns an empty string when nothing matches, forcing an explicit pick', () => {
    expect(pickByHint(['wan2.2_t2v.safetensors'], SPLIT_WORKFLOW_HINTS.zturbo.model)).toBe('');
  });

  it('returns an empty string for an empty list', () => {
    expect(pickByHint([], 'anything')).toBe('');
  });

  it('zturbo clip hint matches the Qwen3 text encoder but not the Qwen3-VL one', () => {
    const hint = SPLIT_WORKFLOW_HINTS.zturbo.clip;
    expect(pickByHint(['qwen3vl_4b_fp8_scaled.safetensors', 'qwen_3_4b.safetensors'], hint))
      .toBe('qwen_3_4b.safetensors');
  });

  it('zturbo vae hint matches the official ae.safetensors, also in a subfolder', () => {
    const hint = SPLIT_WORKFLOW_HINTS.zturbo.vae;
    expect(pickByHint(['qwen_image_vae.safetensors', 'Flux/ae.safetensors'], hint))
      .toBe('Flux/ae.safetensors');
  });

  it('krea2 hints find the official krea2 model files', () => {
    expect(pickByHint(['krea2_turbo_fp8_scaled.safetensors'], SPLIT_WORKFLOW_HINTS.krea2.model))
      .toBe('krea2_turbo_fp8_scaled.safetensors');
    expect(pickByHint(['qwen_image_vae.safetensors'], SPLIT_WORKFLOW_HINTS.krea2.vae))
      .toBe('qwen_image_vae.safetensors');
  });
});

describe('aspectFromSize', () => {
  it('converts a size label to an aspect ratio', () => {
    expect(aspectFromSize('1344×768')).toBe('1344/768');
  });

  it('returns undefined when there is no size separator', () => {
    expect(aspectFromSize('custom')).toBeUndefined();
  });
});
