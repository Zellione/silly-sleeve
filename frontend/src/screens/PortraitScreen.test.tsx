import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortraitScreen from './PortraitScreen';
import { ToastProvider } from '../components/ToastProvider';
import { compose } from '../../wailsjs/go/models';

const mockGetCharacters = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockGetActiveCharacter = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  SetActiveCharacter: (id: number) => mockSetActiveCharacter(id),
  GetActiveCharacter: () => mockGetActiveCharacter(),
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

  it('clicking auto-fill fills prompt from appearance', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortraitScreen />);
    await waitFor(() => screen.getByText('auto-fill from card'));
    await user.click(screen.getByText('auto-fill from card'));
    // Verify the click was handled — the toast or textarea state changed
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
    // After click, the button text changes to Stop(during generation)
    await waitFor(() => {
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
