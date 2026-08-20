import { comfy } from '../../wailsjs/go/models';
import type { WorkflowOption, SplitModelHints } from '../components/GenerationParamsPanel';

/** Split-file model hints for the built-in workflows that need them. */
export const SPLIT_WORKFLOW_HINTS: Record<string, SplitModelHints> = {
  krea2: {
    model: 'krea',
    clip: 'qwen_?3[-_ ]?vl',
    vae: 'qwen[-_ ]?image.*vae',
  },
  zturbo: {
    model: 'z[-_ ]?image',
    // Z-Image uses the plain Qwen3 text encoder — not the Qwen3-VL one.
    clip: 'qwen_?3(?![-_ ]?vl)',
    vae: String.raw`(^|[/\\])ae\.safetensors$|z[-_ ]?image.*vae`,
  },
};

/**
 * Returns the first list entry matching the hint (case-insensitive regex),
 * or '' when nothing matches so the UI can force an explicit pick instead of
 * queueing a workflow that is guaranteed to fail server-side validation.
 */
export function pickByHint(list: string[], hint: string): string {
  const re = new RegExp(hint, 'i');
  return list.find(name => re.test(name)) ?? '';
}

/** Maps backend ComfyUI workflows to the dropdown options the panels render. */
export function mapWorkflows(wfs: comfy.ComfyWorkflow[]): WorkflowOption[] {
  return wfs.map(wf => ({
    id: wf.id,
    name: wf.name.replace(/\.json$/i, ''),
    model: wf.params.checkpoint || 'custom',
    size: wf.params.width && wf.params.height
      ? `${wf.params.width}×${wf.params.height}`
      : 'custom',
    steps: wf.params.steps || 20,
    cfg: wf.params.cfg || 7,
    sampler: wf.params.sampler || 'euler',
    scheduler: wf.params.scheduler || 'normal',
  }));
}

/** Splits a "832×1216" size label into [width, height]; 0 for missing/invalid. */
export function parseSize(size: string): [number, number] {
  const [w, h] = size.split('×').map(Number);
  return [w || 0, h || 0];
}

/** Converts "832×1216" → "832/1216" for CSS aspect-ratio; undefined otherwise. */
export function aspectFromSize(size: string): string | undefined {
  return size.includes('×') ? size.replace('×', '/') : undefined;
}
