import { describe, it, expect } from 'vitest';
import { mapWorkflows, parseSize, aspectFromSize } from './workflow';
import { comfy } from '../../wailsjs/go/models';

describe('mapWorkflows', () => {
  it('maps a workflow, stripping .json and deriving size', () => {
    const wf = comfy.ComfyWorkflow.createFrom({
      id: 'wf1',
      name: 'My Workflow.json',
      params: { checkpoint: 'model.safetensors', width: 832, height: 1216, steps: 28, sampler: 'dpmpp_2m', scheduler: 'karras' },
    });
    expect(mapWorkflows([wf])).toEqual([
      { id: 'wf1', name: 'My Workflow', model: 'model.safetensors', size: '832×1216', steps: 28, sampler: 'dpmpp_2m', scheduler: 'karras' },
    ]);
  });

  it('falls back to defaults when params are missing', () => {
    const wf = comfy.ComfyWorkflow.createFrom({ id: 'wf2', name: 'bare', params: {} });
    expect(mapWorkflows([wf])).toEqual([
      { id: 'wf2', name: 'bare', model: 'custom', size: 'custom', steps: 20, sampler: 'euler', scheduler: 'normal' },
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

describe('aspectFromSize', () => {
  it('converts a size label to an aspect ratio', () => {
    expect(aspectFromSize('1344×768')).toBe('1344/768');
  });

  it('returns undefined when there is no size separator', () => {
    expect(aspectFromSize('custom')).toBeUndefined();
  });
});
