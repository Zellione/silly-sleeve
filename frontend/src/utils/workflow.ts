import { comfy } from '../../wailsjs/go/models';
import type { WorkflowOption } from '../components/GenerationParamsPanel';

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
