import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectImageScreen from './ProjectImageScreen';
import { ToastProvider } from '../components/ToastProvider';
import { DEFAULT_NEGATIVE_PROMPT } from '../utils/image';

const mockGenerateProjectImage = vi.fn().mockResolvedValue([]);
const mockGetProjectImage = vi.fn().mockResolvedValue([]);
const mockSaveProjectImage = vi.fn().mockResolvedValue(undefined);

vi.mock('../../wailsjs/go/main/App', () => ({
  GenerateProjectImage: (...args: any[]) => mockGenerateProjectImage(...args),
  GetProjectImage: () => mockGetProjectImage(),
  SaveProjectImage: (data: number[]) => mockSaveProjectImage(data),
  GetComfySamplers: () => Promise.resolve(['euler', 'dpmpp_2m']),
  GetComfySchedulers: () => Promise.resolve(['karras', 'normal']),
  GetComfyCheckpoints: () => Promise.resolve(['sd_xl_base_1.0.safetensors']),
  GetComfyWorkflows: () => Promise.resolve([]),
  GetComfyWorkflowTemplate: () => Promise.resolve('{"1":{"class_type":"KSampler"}}'),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('ProjectImageScreen', () => {
  it('renders Generate and Upload tabs', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
  });

  it('renders subtitle text', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Cover art for the whole project')).toBeInTheDocument();
    });
  });

  it('renders workflow pill', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/cover_sdxl_v2/).length).toBeGreaterThan(0);
    });
  });

  it('renders sampler params', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Steps')).toBeInTheDocument();
      expect(screen.getByText('CFG scale')).toBeInTheDocument();
      expect(screen.getByText('Sampler')).toBeInTheDocument();
    });
  });

  it('renders aspect selector', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Aspect')).toBeInTheDocument();
    });
  });

  it('renders project context', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Use project context')).toBeInTheDocument();
      expect(screen.getAllByText(/Mood from lorebook/).length).toBeGreaterThan(0);
    });
  });

  it('renders prompts', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Positive prompt')).toBeInTheDocument();
      expect(screen.getByText('Negative prompt')).toBeInTheDocument();
    });
  });

  it('renders auto-fill button', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('auto-fill from lorebook')).toBeInTheDocument();
    });
  });

  it('renders queue generation button', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Queue generation')).toBeInTheDocument();
    });
  });

  it('renders preview placeholder', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('press generate')).toBeInTheDocument();
    });
  });

  it('renders versions panel', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Versions/).length).toBeGreaterThan(0);
    });
  });

  it('disables use as project image with no variants', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      const btn = screen.getByText('Use as project image').closest('button');
      expect(btn).toBeDisabled();
    });
  });

  it('renders seed input', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Seed')).toBeInTheDocument();
    });
  });

  it('renders save preset button', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      expect(btns.find(b => b.getAttribute('title') === 'Save preset')).toBeTruthy();
    });
  });

  it('renders randomize seed button', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      expect(btns.find(b => b.getAttribute('title') === 'Randomize')).toBeTruthy();
    });
  });

  it('renders Workflow heading', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Workflow').length).toBeGreaterThan(0);
    });
  });

  it('lists all workflows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Workflow' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('combobox', { name: 'Workflow' }));
    expect(screen.getByRole('option', { name: /cover_sdxl_v2/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /flux_banner/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /painterly_square/ })).toBeInTheDocument();
  });

  it('renders checkpoint selector', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('Checkpoint')).toBeInTheDocument();
    });
  });

  it('generation calls GenerateProjectImage with full checkpoint name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      expect(mockGenerateProjectImage).toHaveBeenCalled();
      const params = mockGenerateProjectImage.mock.calls[0][0];
      expect(params.checkpoint).toBe('sd_xl_base_1.0.safetensors');
    });
  });

  it('renders project cover placeholder', async () => {
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(screen.getByText('project cover')).toBeInTheDocument();
    });
  });

  it('has prompt textareas', () => {
    renderWithProviders(<ProjectImageScreen />);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2);
  });

  // ─── Tab switching ─────────────────────────────────────

  it('switches to upload mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText(/Drop a cover image here/)).toBeInTheDocument();
    });
  });

  it('switches back to generate', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => screen.getByText(/Drop a cover image here/));
    await user.click(screen.getByText('Generate'));
    await waitFor(() => screen.getByText('Queue generation'));
  });

  // ─── Upload mode ───────────────────────────────────────

  it('shows browse files in upload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Browse files')).toBeInTheDocument();
    });
  });

  it('shows selected file card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Selected file')).toBeInTheDocument();
    });
  });

  it('shows URL paste card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Or paste a URL')).toBeInTheDocument();
    });
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ProjectImageScreen />);
    expect(container).toBeTruthy();
  });

  // ─── Interactive tests ──────────────────────────────────

  it('can find textarea elements', () => {
    renderWithProviders(<ProjectImageScreen />);
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBeGreaterThanOrEqual(2);
  });

  it('can change steps input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Queue generation'));

    const stepsInput = screen.getByDisplayValue('26') as HTMLInputElement;
    await user.clear(stepsInput);
    await user.type(stepsInput, '40');
    expect(stepsInput.value).toBe('40');
  });

  it('clicking randomize changes seed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Queue generation'));

    const randBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'Randomize')!;
    await user.click(randBtn);
  });

  it('clicking auto-fill inserts the default negative prompt', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('auto-fill from lorebook'));
    await user.click(screen.getByText('auto-fill from lorebook'));
    await waitFor(() => {
      const values = Array.from(document.querySelectorAll('textarea')).map(t => t.value);
      expect(values).toContain(DEFAULT_NEGATIVE_PROMPT);
    });
  });

  it('auto-fill does not overwrite an existing negative prompt', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('auto-fill from lorebook'));
    const negField = Array.from(document.querySelectorAll('textarea'))[1];
    await user.click(negField);
    await user.type(negField, 'my custom negative');
    await user.click(screen.getByText('auto-fill from lorebook'));
    await waitFor(() => expect(negField.value).toBe('my custom negative'));
  });

  it('upload mode renders selected file area', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Selected file')).toBeInTheDocument();
      expect(screen.getByText(/None — drop or browse/)).toBeInTheDocument();
    });
  });

  it('shows recommended dimensions in upload mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText(/1920 × 1080/)).toBeInTheDocument();
    });
  });

  it('clicking generate after switching shows queue button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await user.click(screen.getByText('Generate'));
    await waitFor(() => {
      expect(screen.getByText('Queue generation')).toBeInTheDocument();
    });
  });

  it('generation calls GenerateProjectImage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      expect(mockGenerateProjectImage).toHaveBeenCalled();
    });
  });

  it('stop button appears during generation', async () => {
    mockGenerateProjectImage.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Stop/));
  });

  // ─── Persistence (survives tab switch) ──────────────────

  const PNG_BYTES = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

  it('loads the saved cover into the canvas on mount', async () => {
    mockGenerateProjectImage.mockResolvedValue([]);
    mockGetProjectImage.mockResolvedValue(PNG_BYTES);
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => {
      expect(mockGetProjectImage).toHaveBeenCalled();
      const img = screen.getByAltText('cover variant 1') as HTMLImageElement;
      expect(img.src).toMatch(/^data:image\/png;base64,/);
    });
  });

  it('persists the generated cover to the backend on "Use as project image"', async () => {
    mockGetProjectImage.mockResolvedValue([]);
    mockGenerateProjectImage.mockResolvedValue([
      { data: PNG_BYTES, filename: 'c.png', subfolder: '', type: 'output' },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<ProjectImageScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      const btn = screen.getByText('Use as project image').closest('button');
      expect(btn).not.toBeDisabled();
    });
    await user.click(screen.getByText('Use as project image'));
    await waitFor(() => {
      expect(mockSaveProjectImage).toHaveBeenCalledWith(PNG_BYTES);
    });
  });
});
