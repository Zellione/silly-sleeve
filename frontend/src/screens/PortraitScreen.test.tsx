import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortraitScreen from './PortraitScreen';
import { ToastProvider } from '../components/ToastProvider';
import { compose } from '../../wailsjs/go/models';
import { DEFAULT_NEGATIVE_PROMPT } from '../utils/image';

const mockGetCharacters = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockGetActiveCharacter = vi.fn();
const mockGeneratePortrait = vi.fn().mockResolvedValue([]);
const mockGenerateImagePrompt = vi.fn().mockResolvedValue(['a cat', 'blurry']);
const mockGetComfySamplers = vi.fn().mockResolvedValue(['euler', 'dpmpp_2m']);
const mockGetComfySchedulers = vi.fn().mockResolvedValue(['karras', 'normal']);
const mockGetComfyCheckpoints = vi.fn().mockResolvedValue(['sd_xl_base_1.0.safetensors']);
const mockGetComfyVAEs = vi.fn().mockResolvedValue(['sdxl_vae.safetensors']);
const mockGetComfyLoRAs = vi.fn().mockResolvedValue([]);
const mockGetPortrait = vi.fn().mockResolvedValue([]);
const mockSavePortrait = vi.fn().mockResolvedValue(undefined);

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  SetActiveCharacter: (id: number) => mockSetActiveCharacter(id),
  GetActiveCharacter: () => mockGetActiveCharacter(),
  GeneratePortrait: (params: any) => mockGeneratePortrait(params),
  GenerateImagePrompt: (charID: number, style: string) => mockGenerateImagePrompt(charID, style),
  GetComfySamplers: () => mockGetComfySamplers(),
  GetComfySchedulers: () => mockGetComfySchedulers(),
  GetComfyCheckpoints: () => mockGetComfyCheckpoints(),
  GetComfyVAEs: () => mockGetComfyVAEs(),
  GetComfyLoRAs: () => mockGetComfyLoRAs(),
  GetPortrait: (charID: number) => mockGetPortrait(charID),
  SavePortrait: (charID: number, data: number[]) => mockSavePortrait(charID, data),
  GetComfyWorkflows: () => Promise.resolve([]),
  GetComfyWorkflowTemplate: () => Promise.resolve('{"1":{"class_type":"KSampler"}}'),
}));

const testChar = new compose.Character({
  id: 1, name: 'Elara', epithet: 'Crimson Lark',
  appearance: 'a half-elf woman with auburn hair',
  personality: 'cheerful', tags: [], quotes: [], stats: [],
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('PortraitScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([testChar]);
    mockGetActiveCharacter.mockResolvedValue(testChar);
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGetPortrait.mockResolvedValue([]);
    mockSavePortrait.mockResolvedValue(undefined);
  });

  it('renders Generate and Upload tabs', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
  });

  it('renders context text about portrait', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Make or import a face')).toBeInTheDocument();
    });
  });

  it('renders workflow name', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      const elements = screen.getAllByText(/portrait_sdxl_v3/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('renders sampler params', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Steps')).toBeInTheDocument();
      expect(screen.getByText('CFG scale')).toBeInTheDocument();
      expect(screen.getByText('Denoise')).toBeInTheDocument();
      expect(screen.getByText('Sampler')).toBeInTheDocument();
      expect(screen.getByText('Scheduler')).toBeInTheDocument();
    });
  });

  it('renders prompts', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Positive prompt')).toBeInTheDocument();
      expect(screen.getByText('Negative prompt')).toBeInTheDocument();
    });
  });

  it('renders auto-fill button', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('auto-fill from card')).toBeInTheDocument();
    });
  });

  it('renders character strip', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Elara')).toBeInTheDocument();
    });
  });

  it('renders queue generation button', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Queue generation')).toBeInTheDocument();
    });
  });

  it('renders preview placeholder', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('press generate')).toBeInTheDocument();
    });
  });

  it('disables use as portrait button with no variants', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      const btn = screen.getByText('Use as portrait').closest('button');
      expect(btn).toBeDisabled();
    });
  });

  it('renders seed input', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Seed')).toBeInTheDocument();
    });
  });

  it('renders Models section', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Models')).toBeInTheDocument();
    });
  });

  it('renders checkpoint label', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Checkpoint')).toBeInTheDocument();
      expect(screen.getByText('VAE')).toBeInTheDocument();
      expect(screen.getByText('LoRA')).toBeInTheDocument();
    });
  });

  it('shows default step value 28', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('28')).toBeInTheDocument();
    });
  });

  it('shows default CFG value 7', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    });
  });

  it('shows default denoise value 1', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });
  });

  it('shows generated count', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      const elements = screen.getAllByText(/Generated/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('renders Workflow heading', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Workflow').length).toBeGreaterThan(0);
    });
  });

  it('renders Preview heading', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('renders save preset button', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      expect(btns.find(b => b.getAttribute('title') === 'Save preset')).toBeTruthy();
    });
  });

  it('renders randomize seed button', async () => {
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      expect(btns.find(b => b.getAttribute('title') === 'Randomize')).toBeTruthy();
    });
  });

  it('has prompt textareas', () => {
    renderWithProviders(<PortraitScreen />);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2);
  });

  // ─── Tab switching ─────────────────────────────────────

  it('switches to upload tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText(/Drop a portrait here/)).toBeInTheDocument();
    });
  });

  it('switches back to generate', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => screen.getByText(/Drop a portrait here/));
    await user.click(screen.getByText('Generate'));
    await waitFor(() => screen.getByText('Queue generation'));
  });

  // ─── Upload mode ───────────────────────────────────────

  it('shows browse files in upload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Browse files')).toBeInTheDocument();
    });
  });

  it('shows selected file card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Selected file')).toBeInTheDocument();
      expect(screen.getByText(/None — drop or browse/)).toBeInTheDocument();
    });
  });

  it('shows URL paste card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Upload'));
    await user.click(screen.getByText('Upload'));
    await waitFor(() => {
      expect(screen.getByText('Or paste a URL')).toBeInTheDocument();
    });
  });

  // ─── Character interaction ──────────────────────────────

  it('clicking character switches active', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Elara'));
    await user.click(screen.getByText('Elara'));
    await waitFor(() => {
      expect(mockSetActiveCharacter).toHaveBeenCalledWith(1);
    });
  });

  // ─── Empty state ─────────────────────────────────────────

  it('handles no characters', async () => {
    mockGetCharacters.mockResolvedValue([]);
    mockGetActiveCharacter.mockResolvedValue(new compose.Character({
      id: 0, name: '', tags: [], quotes: [], stats: [],
    }));
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });
  });

  // ─── Interactive tests ──────────────────────────────────

  it('clicking auto-fill fills both positive and negative prompts', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('auto-fill from card'));
    await user.click(screen.getByText('auto-fill from card'));
    await waitFor(() => {
      const values = Array.from(document.querySelectorAll('textarea')).map(t => t.value);
      expect(values).toContain('a cat');
      expect(values).toContain('blurry');
    });
  });

  it('auto-fill does not overwrite an existing negative prompt', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('auto-fill from card'));
    const negField = Array.from(document.querySelectorAll('textarea'))[1];
    await user.click(negField);
    await user.type(negField, 'my custom negative');
    await user.click(screen.getByText('auto-fill from card'));
    await waitFor(() => {
      const values = Array.from(document.querySelectorAll('textarea')).map(t => t.value);
      expect(values).toContain('a cat');
    });
    expect(negField.value).toBe('my custom negative');
  });

  it('auto-fill inserts the default negative prompt when generation fails', async () => {
    mockGenerateImagePrompt.mockRejectedValueOnce(new Error('no endpoint'));
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('auto-fill from card'));
    await user.click(screen.getByText('auto-fill from card'));
    await waitFor(() => {
      const values = Array.from(document.querySelectorAll('textarea')).map(t => t.value);
      expect(values).toContain(DEFAULT_NEGATIVE_PROMPT);
      expect(values.some(v => v.includes('a half-elf woman with auburn hair'))).toBe(true);
    });
  });

  it('can find textarea elements', () => {
    renderWithProviders(<PortraitScreen />);
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBeGreaterThanOrEqual(2);
  });

  it('can change steps input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Queue generation'));

    const stepsInput = screen.getByDisplayValue('28') as HTMLInputElement;
    await user.clear(stepsInput);
    await user.type(stepsInput, '50');
    expect(stepsInput.value).toBe('50');
  });

  it('generation button is clickable', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    const btn = screen.getByText('Queue generation');
    await user.click(btn);
    expect(btn).toBeInTheDocument();
  });

  it('auto-fill calls GenerateImagePrompt', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('auto-fill from card'));
    await user.click(screen.getByText('auto-fill from card'));
    expect(mockGenerateImagePrompt).toHaveBeenCalledWith(1, 'natural');
  });

  it('generation calls GeneratePortrait', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      expect(mockGeneratePortrait).toHaveBeenCalled();
    });
  });

  it('generation calls GeneratePortrait with full checkpoint name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      expect(mockGeneratePortrait).toHaveBeenCalled();
      const params = mockGeneratePortrait.mock.calls[0][0];
      expect(params.checkpoint).toBe('sd_xl_base_1.0.safetensors');
    });
  });

  it('stop button stops generation', async () => {
    mockGeneratePortrait.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Stop/));
  });

  // ─── Persistence (survives tab switch) ──────────────────

  const PNG_BYTES = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

  it('loads the saved portrait into the canvas on mount', async () => {
    mockGetPortrait.mockResolvedValue(PNG_BYTES);
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => {
      expect(mockGetPortrait).toHaveBeenCalledWith(1);
      const img = screen.getByAltText('variant 1') as HTMLImageElement;
      expect(img.src).toMatch(/^data:image\/png;base64,/);
    });
  });

  it('persists the generated portrait to the backend on "Use as portrait"', async () => {
    mockGeneratePortrait.mockResolvedValue([
      { data: PNG_BYTES, filename: 'p.png', subfolder: '', type: 'output' },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      const btn = screen.getByText('Use as portrait').closest('button');
      expect(btn).not.toBeDisabled();
    });
    await user.click(screen.getByText('Use as portrait'));
    await waitFor(() => {
      expect(mockSavePortrait).toHaveBeenCalledWith(1, PNG_BYTES);
    });
  });
});
