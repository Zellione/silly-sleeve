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
const mockGetWorkflows = vi.fn();
const mockGetTemplate = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetComfySamplers: () => mockGetSamplers(),
  GetComfySchedulers: () => mockGetSchedulers(),
  GetComfyCheckpoints: () => mockGetCheckpoints(),
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
  { id: 'preset_a', name: 'preset_a', model: 'm', size: '512×512', steps: 20, sampler: 'euler', scheduler: 'normal' },
];

const Harness: React.FC = () => {
  const g = useImageGeneration({
    workflowId: 'preset_a',
    workflowDefaults: DEFAULTS,
    generate: mockGenerate,
    completionBody: n => `${n} ready`,
    initialCheckpoint: 'fallback',
  });
  return (
    <div>
      <span data-testid="checkpoint">{g.checkpoint}</span>
      <span data-testid="workflows">{g.allWorkflows.map(w => w.id).join(',')}</span>
      <span data-testid="generating">{String(g.generating)}</span>
      <span data-testid="variants">{g.variantImages.join('|')}</span>
      <button onClick={() => g.runGeneration({
        size: '640×480', seed: 7, steps: 25, cfg: 6, sampler: 's', scheduler: 'sc',
        denoise: 0.5, prompt: 'p', negPrompt: 'n', checkpoint: g.checkpoint,
      })}>run</button>
      <button onClick={g.stop}>stop</button>
      <button onClick={g.clearVariants}>clear</button>
    </div>
  );
};

const renderHook = () => render(<ToastProvider><Harness /></ToastProvider>);

describe('useImageGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSamplers.mockResolvedValue(['euler']);
    mockGetSchedulers.mockResolvedValue(['normal']);
    mockGetCheckpoints.mockResolvedValue(['ckpt_one', 'ckpt_two']);
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

  it('prepends default workflows to mapped uploaded ones', async () => {
    mockGetWorkflows.mockResolvedValue([
      { id: 'up1', name: 'up1.json', params: {} },
    ]);
    renderHook();
    await waitFor(() => expect(screen.getByTestId('workflows').textContent).toBe('preset_a,up1'));
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
