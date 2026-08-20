import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useImageGeneration } from './useImageGeneration';
import { ToastProvider } from './ToastProvider';
import type { WorkflowOption } from './GenerationParamsPanel';

const mockGenerate = vi.fn();
const mockGetSamplers = vi.fn();
const mockGetSchedulers = vi.fn();
const mockGetCheckpoints = vi.fn();
const mockGetUNets = vi.fn();
const mockGetCLIPs = vi.fn();
const mockGetVAEs = vi.fn();
const mockGetLoRAs = vi.fn();
const mockGetWorkflows = vi.fn();
const mockGetTemplate = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetComfySamplers: () => mockGetSamplers(),
  GetComfySchedulers: () => mockGetSchedulers(),
  GetComfyCheckpoints: () => mockGetCheckpoints(),
  GetComfyUNets: () => mockGetUNets(),
  GetComfyCLIPs: () => mockGetCLIPs(),
  GetComfyVAEs: () => mockGetVAEs(),
  GetComfyLoRAs: () => mockGetLoRAs(),
  GetComfyWorkflows: () => mockGetWorkflows(),
  GetComfyWorkflowTemplate: (id: string) => mockGetTemplate(id),
}));

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

vi.mock('../utils/image', () => ({
  arrayBufferToDataURL: (data: unknown) => `data:url:${String(data)}`,
}));

const DEFAULTS: WorkflowOption[] = [
  { id: 'preset_a', name: 'preset_a', model: 'm', size: '512×512', steps: 20, cfg: 7, sampler: 'euler', scheduler: 'normal' },
  {
    id: 'split_z', name: 'split_z', model: 'z_image', size: '832×1216', steps: 8, cfg: 1, sampler: 'res_multistep', scheduler: 'simple',
    split: { model: 'z[-_ ]?image', clip: 'qwen_?3(?![-_ ]?vl)', vae: '(^|[/\\\\])ae\\.safetensors$' },
  },
];

const Harness: React.FC<{ initialWorkflowId?: string }> = ({ initialWorkflowId = 'preset_a' }) => {
  const [workflowId, setWorkflowId] = React.useState(initialWorkflowId);
  const g = useImageGeneration({
    workflowId,
    workflowDefaults: DEFAULTS,
    generate: mockGenerate,
    completionBody: n => `${n} ready`,
    initialCheckpoint: 'fallback',
  });
  return (
    <div>
      <span data-testid="checkpoint">{g.checkpoint}</span>
      <span data-testid="clip">{g.clip}</span>
      <span data-testid="vae">{g.vae}</span>
      <span data-testid="split">{String(g.splitWorkflow)}</span>
      <span data-testid="unets">{g.unets.join(',')}</span>
      <span data-testid="workflows">{g.allWorkflows.map(w => w.id).join(',')}</span>
      <span data-testid="generating">{String(g.generating)}</span>
      <span data-testid="variants">{g.variantImages.join('|')}</span>
      <button onClick={() => setWorkflowId('split_z')}>go-split</button>
      <button onClick={() => setWorkflowId('preset_a')}>go-checkpoint</button>
      <button onClick={() => g.setCheckpoint('ckpt_two')}>pick-ckpt-two</button>
      <button onClick={() => g.runGeneration({
        size: '640×480', seed: 7, steps: 25, cfg: 6, sampler: 's', scheduler: 'sc',
        denoise: 0.5, prompt: 'p', negPrompt: 'n', checkpoint: g.checkpoint,
        clip: g.clip, vae: g.vae || 'v.safetensors', lora: 'l.safetensors',
      })}>run</button>
      <button onClick={() => g.runGeneration({
        size: '640×480', seed: 7, steps: 25, cfg: 6, sampler: 's', scheduler: 'sc',
        denoise: 0.5, prompt: 'p', negPrompt: 'n', checkpoint: g.checkpoint,
        clip: g.clip, vae: g.vae, lora: '',
      })}>run-raw</button>
      <button onClick={g.stop}>stop</button>
      <button onClick={g.clearVariants}>clear</button>
    </div>
  );
};

const renderHook = (initialWorkflowId?: string) =>
  render(<ToastProvider><Harness initialWorkflowId={initialWorkflowId} /></ToastProvider>);

describe('useImageGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSamplers.mockResolvedValue(['euler']);
    mockGetSchedulers.mockResolvedValue(['normal']);
    mockGetCheckpoints.mockResolvedValue(['ckpt_one', 'ckpt_two']);
    mockGetUNets.mockResolvedValue(['wan_t2v.safetensors', 'z_image_turbo_bf16.safetensors']);
    mockGetCLIPs.mockResolvedValue(['qwen3vl_4b.safetensors', 'qwen_3_4b.safetensors']);
    mockGetVAEs.mockResolvedValue(['qwen_image_vae.safetensors', 'ae.safetensors']);
    mockGetLoRAs.mockResolvedValue(['style.safetensors']);
    mockGetWorkflows.mockResolvedValue([]);
    mockGetTemplate.mockResolvedValue('{"1":{"class_type":"KSampler"}}');
    mockGenerate.mockResolvedValue([{ data: 'IMG' }]);
  });

  it('auto-selects the first checkpoint once the list loads', async () => {
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));
  });

  it('keeps the initial checkpoint when the list is empty', async () => {
    mockGetCheckpoints.mockResolvedValue([]);
    renderHook();
    await waitFor(() => expect(mockGetCheckpoints).toHaveBeenCalled());
    expect(screen.getByTestId('checkpoint').textContent).toBe('fallback');
  });

  it('loads the split-model file lists', async () => {
    renderHook();
    await waitFor(() => expect(screen.getByTestId('unets').textContent)
      .toBe('wan_t2v.safetensors,z_image_turbo_bf16.safetensors'));
  });

  it('prepends default workflows to mapped uploaded ones', async () => {
    mockGetWorkflows.mockResolvedValue([
      { id: 'up1', name: 'up1.json', params: {} },
    ]);
    renderHook();
    await waitFor(() => expect(screen.getByTestId('workflows').textContent).toBe('preset_a,split_z,up1'));
  });

  it('preselects split model files by hint when switching to a split workflow', async () => {
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));

    await user.click(screen.getByText('go-split'));

    await waitFor(() => expect(screen.getByTestId('split').textContent).toBe('true'));
    expect(screen.getByTestId('checkpoint').textContent).toBe('z_image_turbo_bf16.safetensors');
    expect(screen.getByTestId('clip').textContent).toBe('qwen_3_4b.safetensors');
    expect(screen.getByTestId('vae').textContent).toBe('ae.safetensors');
  });

  it('leaves the selection empty when no server file matches the hint', async () => {
    mockGetUNets.mockResolvedValue(['wan_t2v.safetensors']);
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));

    await user.click(screen.getByText('go-split'));

    await waitFor(() => expect(screen.getByTestId('split').textContent).toBe('true'));
    expect(screen.getByTestId('checkpoint').textContent).toBe('');
  });

  it('restores the previous checkpoint selection when leaving a split workflow', async () => {
    // Falling back to the first list entry would silently swap the user's
    // pick for an arbitrary (alphabetical) file that may not even carry a
    // baked text encoder.
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));
    await user.click(screen.getByText('pick-ckpt-two'));

    await user.click(screen.getByText('go-split'));
    await waitFor(() => expect(screen.getByTestId('split').textContent).toBe('true'));

    await user.click(screen.getByText('go-checkpoint'));
    await waitFor(() => expect(screen.getByTestId('split').textContent).toBe('false'));
    expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_two');
    expect(screen.getByTestId('clip').textContent).toBe('');
    expect(screen.getByTestId('vae').textContent).toBe('');
  });

  it('preselects by hint when the workflow starts as split', async () => {
    renderHook('split_z');
    await waitFor(() => expect(screen.getByTestId('vae').textContent).toBe('ae.safetensors'));
    expect(screen.getByTestId('checkpoint').textContent).toBe('z_image_turbo_bf16.safetensors');
  });

  it('blocks a split generation with missing model selections', async () => {
    mockGetUNets.mockResolvedValue(['wan_t2v.safetensors']);
    const user = userEvent.setup();
    renderHook('split_z');
    await waitFor(() => expect(screen.getByTestId('split').textContent).toBe('true'));
    await waitFor(() => expect(mockGetUNets).toHaveBeenCalled());

    await user.click(screen.getByText('run-raw'));

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(await screen.findByText(/Pick a model/)).toBeInTheDocument();
  });

  it('runs a split generation, passing the clip selection and model kind through', async () => {
    const user = userEvent.setup();
    renderHook('split_z');
    await waitFor(() => expect(screen.getByTestId('vae').textContent).toBe('ae.safetensors'));

    await user.click(screen.getByText('run-raw'));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalled());
    const params = mockGenerate.mock.calls[0][0];
    expect(params.checkpoint).toBe('z_image_turbo_bf16.safetensors');
    expect(params.modelKind).toBe('unet');
    expect(params.clip).toBe('qwen_3_4b.safetensors');
    expect(params.vae).toBe('ae.safetensors');
  });

  it('preselects a checkpoint-packaged model when no split file matches', async () => {
    // Community merges ship as all-in-one checkpoints: the hint must search
    // the checkpoint list too, and a checkpoint needs no clip or VAE pick.
    mockGetUNets.mockResolvedValue(['wan_t2v.safetensors']);
    mockGetCheckpoints.mockResolvedValue(['sd_xl_base_1.0.safetensors', 'ZImageTurbo/beretMixZIT_v50.safetensors']);
    renderHook('split_z');

    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent)
      .toBe('ZImageTurbo/beretMixZIT_v50.safetensors'));
    expect(screen.getByTestId('clip').textContent).toBe('');
    expect(screen.getByTestId('vae').textContent).toBe('');
  });

  it('runs a checkpoint-packaged split generation without clip or VAE', async () => {
    mockGetUNets.mockResolvedValue(['wan_t2v.safetensors']);
    mockGetCheckpoints.mockResolvedValue(['ZImageTurbo/beretMixZIT_v50.safetensors']);
    const user = userEvent.setup();
    renderHook('split_z');
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent)
      .toBe('ZImageTurbo/beretMixZIT_v50.safetensors'));

    await user.click(screen.getByText('run-raw'));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalled());
    const params = mockGenerate.mock.calls[0][0];
    expect(params.checkpoint).toBe('ZImageTurbo/beretMixZIT_v50.safetensors');
    expect(params.modelKind).toBe('checkpoint');
    expect(params.clip).toBe('');
    expect(params.vae).toBe('');
  });

  it('runs a generation, decoding images and parsing size into params', async () => {
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));

    await user.click(screen.getByText('run'));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalled());
    const params = mockGenerate.mock.calls[0][0];
    expect(params.width).toBe(640);
    expect(params.height).toBe(480);
    expect(params.seed).toBe(7);
    expect(params.checkpoint).toBe('ckpt_one');
    expect(params.modelKind).toBe('checkpoint');
    expect(params.clip).toBe('');
    await waitFor(() => expect(screen.getByTestId('variants').textContent).toBe('data:url:IMG'));
    expect(screen.getByText('1 ready')).toBeInTheDocument();
  });

  it('warns and skips generation when the template is not ready', async () => {
    mockGetTemplate.mockResolvedValue('');
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(mockGetTemplate).toHaveBeenCalled());

    await user.click(screen.getByText('run'));

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(await screen.findByText(/Workflow template not ready/)).toBeInTheDocument();
  });

  it('surfaces a toast when generation fails', async () => {
    mockGenerate.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));

    await user.click(screen.getByText('run'));

    expect(await screen.findByText('Generation failed')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('generating').textContent).toBe('false'));
  });

  it('clears variants', async () => {
    const user = userEvent.setup();
    renderHook();
    await waitFor(() => expect(screen.getByTestId('checkpoint').textContent).toBe('ckpt_one'));
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByTestId('variants').textContent).toBe('data:url:IMG'));
    await user.click(screen.getByText('clear'));
    expect(screen.getByTestId('variants').textContent).toBe('');
  });
});
