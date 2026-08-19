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
const mockGenerateImagePrompt = vi.fn().mockResolvedValue({ positive: 'a cat', negative: 'blurry' });
const mockGetComfySamplers = vi.fn().mockResolvedValue(['euler', 'dpmpp_2m']);
const mockGetComfySchedulers = vi.fn().mockResolvedValue(['karras', 'normal']);
const mockGetComfyCheckpoints = vi.fn().mockResolvedValue(['sd_xl_base_1.0.safetensors']);
const mockGetComfyVAEs = vi.fn().mockResolvedValue(['sdxl_vae.safetensors']);
const mockGetComfyUNets = vi.fn().mockResolvedValue([]);
const mockGetComfyCLIPs = vi.fn().mockResolvedValue([]);
const mockGetComfyLoRAs = vi.fn().mockResolvedValue([]);
const mockGetPortrait = vi.fn().mockResolvedValue([]);
const mockSavePortrait = vi.fn().mockResolvedValue(undefined);
const mockSaveProjectBundle = vi.fn().mockResolvedValue(undefined);

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
  GetComfyUNets: () => mockGetComfyUNets(),
  GetComfyCLIPs: () => mockGetComfyCLIPs(),
  GetComfyLoRAs: () => mockGetComfyLoRAs(),
  GetPortrait: (charID: number) => mockGetPortrait(charID),
  SavePortrait: (charID: number, data: number[]) => mockSavePortrait(charID, data),
  SaveProjectBundle: (path: string) => mockSaveProjectBundle(path),
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
    mockSaveProjectBundle.mockResolvedValue(undefined);
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

  it('offers the krea2 and zturbo built-in workflows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    const combobox = await screen.findByRole('combobox', { name: 'Workflow' });
    await user.click(combobox);
    expect(screen.getByRole('option', { name: /krea2_turbo/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /z_image_turbo/ })).toBeInTheDocument();
  });

  it('applies the turbo cfg and steps when selecting the zturbo workflow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    const combobox = await screen.findByRole('combobox', { name: 'Workflow' });
    await user.click(combobox);
    await user.click(screen.getByRole('option', { name: /z_image_turbo/ }));
    // A distilled turbo model fries at the SDXL default CFG; the preset must
    // carry its own value.
    expect(screen.getByLabelText('CFG scale')).toHaveValue(1);
    expect(screen.getByLabelText('Steps')).toHaveValue(8);
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

  it('auto-fill surfaces a warning toast when prompt generation fails', async () => {
    // The fallback is a tag-style template; without the toast, a dead LLM
    // endpoint silently masquerades as "natural style output".
    mockGenerateImagePrompt.mockRejectedValueOnce(new Error('no endpoint'));
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('auto-fill from card'));
    await user.click(screen.getByText('auto-fill from card'));

    expect(await screen.findByText('Prompt generation failed')).toBeInTheDocument();
    expect(screen.getByText(/no endpoint/)).toBeInTheDocument();
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

  it('persists the project bundle to disk after "Use as portrait" when a project is open', async () => {
    mockGeneratePortrait.mockResolvedValue([
      { data: PNG_BYTES, filename: 'p.png', subfolder: '', type: 'output' },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen projectPath="/project/test.slv" bundleSaveDelay={0} />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      const btn = screen.getByText('Use as portrait').closest('button');
      expect(btn).not.toBeDisabled();
    });
    await user.click(screen.getByText('Use as portrait'));
    await waitFor(() => {
      expect(mockSaveProjectBundle).toHaveBeenCalledWith('/project/test.slv');
    });
  });

  it('does not persist the project bundle when no project is open', async () => {
    mockGeneratePortrait.mockResolvedValue([
      { data: PNG_BYTES, filename: 'p.png', subfolder: '', type: 'output' },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen bundleSaveDelay={0} />);
    await waitFor(() => screen.getByText('Queue generation'));
    await user.click(screen.getByText('Queue generation'));
    await waitFor(() => {
      const btn = screen.getByText('Use as portrait').closest('button');
      expect(btn).not.toBeDisabled();
    });
    await user.click(screen.getByText('Use as portrait'));
    await waitFor(() => expect(mockSavePortrait).toHaveBeenCalled());
    expect(mockSaveProjectBundle).not.toHaveBeenCalled();
  });
});

describe('PortraitScreen VAE and LoRA selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([testChar]);
    mockGetActiveCharacter.mockResolvedValue(testChar);
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGetPortrait.mockResolvedValue([]);
    mockGeneratePortrait.mockResolvedValue([]);
    mockGetComfyVAEs.mockResolvedValue(['sdxl_vae.safetensors', 'other_vae.safetensors']);
    mockGetComfyLoRAs.mockResolvedValue(['oil_painting_v3.safetensors']);
  });

  it('defaults to the baked VAE and no LoRA, and sends empty selections', async () => {
    renderWithProviders(<PortraitScreen />);
    await screen.findByLabelText('VAE');

    await userEvent.click(await screen.findByText('Queue generation'));

    await waitFor(() => expect(mockGeneratePortrait).toHaveBeenCalled());
    const params = mockGeneratePortrait.mock.calls[0][0];
    // '' is the backend sentinel for "leave the loader node out of the graph".
    expect(params.vae).toBe('');
    expect(params.lora).toBe('');
  });

  it('sends the chosen VAE through to generation', async () => {
    renderWithProviders(<PortraitScreen />);
    const vaeControl = await screen.findByLabelText('VAE');

    await userEvent.click(vaeControl);
    await userEvent.click(await screen.findByText('sdxl_vae'));
    await userEvent.click(await screen.findByText('Queue generation'));

    await waitFor(() => expect(mockGeneratePortrait).toHaveBeenCalled());
    expect(mockGeneratePortrait.mock.calls[0][0].vae).toBe('sdxl_vae.safetensors');
  });

  it('sends the chosen LoRA through to generation', async () => {
    renderWithProviders(<PortraitScreen />);
    const loraControl = await screen.findByLabelText('LoRA');

    await userEvent.click(loraControl);
    await userEvent.click(await screen.findByText('oil_painting_v3'));
    await userEvent.click(await screen.findByText('Queue generation'));

    await waitFor(() => expect(mockGeneratePortrait).toHaveBeenCalled());
    expect(mockGeneratePortrait.mock.calls[0][0].lora).toBe('oil_painting_v3.safetensors');
  });

  it('keeps the selection visible after choosing it', async () => {
    renderWithProviders(<PortraitScreen />);
    const vaeControl = await screen.findByLabelText('VAE');

    await userEvent.click(vaeControl);
    await userEvent.click(await screen.findByText('other_vae'));

    // A controlled dropdown must reflect the choice; the previous uncontrolled
    // `defaultValue` version reverted on the next render.
    await waitFor(() => expect(vaeControl).toHaveTextContent('other_vae'));
  });
});

describe('PortraitScreen character switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGetPortrait.mockResolvedValue([]);
  });

  it('ignores a slow response for a character the user already switched away from', async () => {
    const charA = new compose.Character({ id: 1, name: 'Elara', tags: [], quotes: [], stats: [] });
    const charB = new compose.Character({ id: 2, name: 'Borin', tags: [], quotes: [], stats: [] });
    mockGetCharacters.mockResolvedValue([charA, charB]);

    // A's fetch resolves only after B's has already landed.
    let releaseA: (v: compose.Character) => void = () => {};
    mockGetActiveCharacter
      .mockImplementationOnce(() => Promise.resolve(charA))
      .mockImplementationOnce(() => new Promise(res => { releaseA = res; }))
      .mockImplementationOnce(() => Promise.resolve(charB));

    renderWithProviders(<PortraitScreen />);
    await screen.findByText('Elara');

    await userEvent.click(screen.getByText('Elara'));
    await userEvent.click(screen.getByText('Borin'));
    await waitFor(() => expect(mockSetActiveCharacter).toHaveBeenLastCalledWith(2));

    releaseA(charA);

    // The stale A response must not clobber B: the header still names Borin.
    await waitFor(() => {
      expect(screen.getByText('Borin').closest('button')).toHaveAttribute('data-on');
    });
  });
});

describe('PortraitScreen split-model workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([testChar]);
    mockGetActiveCharacter.mockResolvedValue(testChar);
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGetPortrait.mockResolvedValue([]);
    mockGeneratePortrait.mockResolvedValue([]);
    mockGetComfyUNets.mockResolvedValue(['wan_t2v.safetensors', 'z_image_turbo_bf16.safetensors']);
    mockGetComfyCLIPs.mockResolvedValue(['qwen3vl_4b.safetensors', 'qwen_3_4b.safetensors']);
    mockGetComfyVAEs.mockResolvedValue(['qwen_image_vae.safetensors', 'ae.safetensors']);
    mockGetComfyLoRAs.mockResolvedValue([]);
  });

  const switchToWorkflow = async (label: string) => {
    await userEvent.click(await screen.findByLabelText('Workflow'));
    await userEvent.click(await screen.findByText(label));
  };

  it('swaps the checkpoint dropdown for split-model dropdowns on a split workflow', async () => {
    renderWithProviders(<PortraitScreen />);
    await screen.findByLabelText('Checkpoint');

    await switchToWorkflow('z_image_turbo — 832×1216');

    expect(await screen.findByLabelText('Diffusion model')).toBeInTheDocument();
    expect(screen.getByLabelText('Text encoder')).toBeInTheDocument();
    expect(screen.queryByLabelText('Checkpoint')).not.toBeInTheDocument();
    // LoRA stays available: split graphs support LoraLoaderModelOnly.
    expect(screen.getByLabelText('LoRA')).toBeInTheDocument();
  });

  it('preselects the split files by hint and sends them to generation', async () => {
    renderWithProviders(<PortraitScreen />);
    await screen.findByLabelText('Checkpoint');

    await switchToWorkflow('z_image_turbo — 832×1216');
    await waitFor(() =>
      expect(screen.getByLabelText('Diffusion model')).toHaveTextContent('z_image_turbo_bf16'));

    await userEvent.click(await screen.findByText('Queue generation'));

    await waitFor(() => expect(mockGeneratePortrait).toHaveBeenCalled());
    const params = mockGeneratePortrait.mock.calls[0][0];
    expect(params.checkpoint).toBe('z_image_turbo_bf16.safetensors');
    expect(params.clip).toBe('qwen_3_4b.safetensors');
    expect(params.vae).toBe('ae.safetensors');
  });

  it('blocks generation and warns when no server file matches the hints', async () => {
    mockGetComfyUNets.mockResolvedValue(['wan_t2v.safetensors']);
    renderWithProviders(<PortraitScreen />);
    await screen.findByLabelText('Checkpoint');

    await switchToWorkflow('z_image_turbo — 832×1216');
    await screen.findByLabelText('Diffusion model');

    await userEvent.click(await screen.findByText('Queue generation'));

    expect(mockGeneratePortrait).not.toHaveBeenCalled();
    expect(await screen.findByText(/Pick a model/)).toBeInTheDocument();
  });

  it('offers checkpoint-packaged models and skips clip/VAE for them', async () => {
    // Community Z-Image merges live in models/checkpoints, not
    // models/diffusion_models — the Model dropdown must offer them too.
    mockGetComfyUNets.mockResolvedValue(['wan_t2v.safetensors']);
    mockGetComfyCheckpoints.mockResolvedValue([
      'sd_xl_base_1.0.safetensors', 'ZImageTurbo/beretMixZIT_v50.safetensors',
    ]);
    renderWithProviders(<PortraitScreen />);
    await screen.findByLabelText('Checkpoint');

    await switchToWorkflow('z_image_turbo — 832×1216');
    await waitFor(() =>
      expect(screen.getByLabelText('Diffusion model')).toHaveTextContent('ZImageTurbo/beretMixZIT_v50'));

    // Baked encoder and VAE: no text-encoder dropdown, VAE defaults to baked.
    expect(screen.queryByLabelText('Text encoder')).not.toBeInTheDocument();
    expect(screen.getByLabelText('VAE')).toHaveTextContent('— baked VAE —');

    await userEvent.click(await screen.findByText('Queue generation'));

    await waitFor(() => expect(mockGeneratePortrait).toHaveBeenCalled());
    const params = mockGeneratePortrait.mock.calls[0][0];
    expect(params.checkpoint).toBe('ZImageTurbo/beretMixZIT_v50.safetensors');
    expect(params.modelKind).toBe('checkpoint');
    expect(params.clip).toBe('');
    expect(params.vae).toBe('');
  });

  it('restores the checkpoint dropdown when switching back', async () => {
    renderWithProviders(<PortraitScreen />);
    await screen.findByLabelText('Checkpoint');

    await switchToWorkflow('z_image_turbo — 832×1216');
    await screen.findByLabelText('Diffusion model');

    await switchToWorkflow('portrait_sdxl_v3 — 832×1216');

    expect(await screen.findByLabelText('Checkpoint')).toBeInTheDocument();
    expect(screen.queryByLabelText('Diffusion model')).not.toBeInTheDocument();
  });
});
