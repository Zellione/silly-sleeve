import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageCanvasPanel from './ImageCanvasPanel';

describe('ImageCanvasPanel', () => {
  const baseProps = {
    canvasTitle: 'Preview',
    workflowSize: '832×1216',
    seed: 42,
    generating: false,
    progress: 0,
    steps: 28,
    showDonePlaceholder: false,
    idlePlaceholder: <div data-testid="idle">idle placeholder</div>,
    prompt: 'a cat',
    onPromptChange: vi.fn(),
    negPrompt: 'bad',
    onNegPromptChange: vi.fn(),
    autoFillButton: <button>auto-fill</button>,
    onToggleGenerate: vi.fn(),
  };

  it('renders canvas title', () => {
    render(<ImageCanvasPanel {...baseProps} />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders workflow size and seed in subtitle', () => {
    render(<ImageCanvasPanel {...baseProps} />);
    expect(screen.getByText('832×1216 · seed 42')).toBeInTheDocument();
  });

  it('shows idle placeholder when not generating and no done state', () => {
    render(<ImageCanvasPanel {...baseProps} />);
    expect(screen.getByTestId('idle')).toBeInTheDocument();
  });

  it('shows done placeholder when showDonePlaceholder is true', () => {
    render(
      <ImageCanvasPanel
        {...baseProps}
        showDonePlaceholder={true}
        donePlaceholder={<div data-testid="done">done placeholder</div>}
      />
    );
    expect(screen.getByTestId('done')).toBeInTheDocument();
  });

  it('shows generating state with progress when generating', () => {
    render(<ImageCanvasPanel {...baseProps} generating={true} progress={50} steps={28} />);
    expect(screen.getByText(/Sampling…/)).toBeInTheDocument();
    expect(screen.getByText(/step 14 \/ 28/)).toBeInTheDocument();
    expect(screen.getByText(/Stop \(50%\)/)).toBeInTheDocument();
  });

  it('renders prompt and negative prompt textareas', () => {
    render(<ImageCanvasPanel {...baseProps} prompt="test prompt" negPrompt="test neg" />);
    const textareas = screen.getAllByRole('textbox');
    expect(textareas[0]).toHaveValue('test prompt');
    expect(textareas[1]).toHaveValue('test neg');
  });

  it('calls onPromptChange when typing in prompt textarea', async () => {
    const user = userEvent.setup();
    const onPromptChange = vi.fn();
    render(<ImageCanvasPanel {...baseProps} onPromptChange={onPromptChange} />);
    await user.type(screen.getAllByRole('textbox')[0], 'x');
    expect(onPromptChange).toHaveBeenCalledWith('a catx');
  });

  it('calls onNegPromptChange when typing in negative prompt textarea', async () => {
    const user = userEvent.setup();
    const onNegPromptChange = vi.fn();
    render(<ImageCanvasPanel {...baseProps} onNegPromptChange={onNegPromptChange} />);
    await user.type(screen.getAllByRole('textbox')[1], 'y');
    expect(onNegPromptChange).toHaveBeenCalledWith('bady');
  });

  it('calls onToggleGenerate when clicking generate button in idle state', async () => {
    const user = userEvent.setup();
    const onToggleGenerate = vi.fn();
    render(<ImageCanvasPanel {...baseProps} onToggleGenerate={onToggleGenerate} />);
    await user.click(screen.getByText(/Queue generation/));
    expect(onToggleGenerate).toHaveBeenCalled();
  });

  it('calls onToggleGenerate when clicking stop button during generation', async () => {
    const user = userEvent.setup();
    const onToggleGenerate = vi.fn();
    render(<ImageCanvasPanel {...baseProps} generating={true} progress={50} onToggleGenerate={onToggleGenerate} />);
    await user.click(screen.getByText(/Stop \(50%\)/));
    expect(onToggleGenerate).toHaveBeenCalled();
  });

  it('shows Save preset button when onSavePreset is provided', () => {
    const onSavePreset = vi.fn();
    render(<ImageCanvasPanel {...baseProps} onSavePreset={onSavePreset} />);
    expect(screen.getByTitle('Save preset')).toBeInTheDocument();
  });

  it('does not show Save preset button when onSavePreset is not provided', () => {
    render(<ImageCanvasPanel {...baseProps} />);
    expect(screen.queryByTitle('Save preset')).not.toBeInTheDocument();
  });

  it('shows auto-fill button by default', () => {
    render(<ImageCanvasPanel {...baseProps} autoFillButton={<button>auto-fill card</button>} />);
    expect(screen.getByText('auto-fill card')).toBeInTheDocument();
  });

  it('hides auto-fill button when showAutoFill is false', () => {
    render(
      <ImageCanvasPanel
        {...baseProps}
        showAutoFill={false}
        autoFillButton={<button>auto-fill card</button>}
      />
    );
    expect(screen.queryByText('auto-fill card')).not.toBeInTheDocument();
  });

  it('applies aspectRatio style when provided', () => {
    const { container } = render(<ImageCanvasPanel {...baseProps} aspectRatio="16/9" />);
    const canvas = container.querySelector('.img-canvas');
    expect(canvas).toHaveStyle({ aspectRatio: '16/9' });
  });

  it('does not apply aspectRatio style when not provided', () => {
    const { container } = render(<ImageCanvasPanel {...baseProps} />);
    const canvas = container.querySelector('.img-canvas');
    expect(canvas).toHaveStyle({ aspectRatio: '' });
  });

  it('shows "Sampling…" in head when generating', () => {
    render(<ImageCanvasPanel {...baseProps} generating={true} />);
    expect(screen.getByText(/Sampling…/)).toBeInTheDocument();
  });

  it('renders progress bar when generating', () => {
    const { container } = render(<ImageCanvasPanel {...baseProps} generating={true} progress={75} />);
    const bar = container.querySelector('.bar i');
    expect(bar).toHaveStyle({ width: '75%' });
  });

  it('shows correct step label rounding', () => {
    render(<ImageCanvasPanel {...baseProps} generating={true} progress={10} steps={28} />);
    expect(screen.getByText(/step 3 \/ 28/)).toBeInTheDocument();
  });

  it('shows "Positive prompt" label', () => {
    render(<ImageCanvasPanel {...baseProps} />);
    expect(screen.getByText('Positive prompt')).toBeInTheDocument();
  });

  it('shows "Negative prompt" label', () => {
    render(<ImageCanvasPanel {...baseProps} />);
    expect(screen.getByText('Negative prompt')).toBeInTheDocument();
  });
});
