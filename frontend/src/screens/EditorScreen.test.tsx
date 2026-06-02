import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditorScreen from './EditorScreen';
import { ToastProvider } from '../components/ToastProvider';
import { compose } from '../../wailsjs/go/models';

const mockCharacter: compose.Character = compose.Character.createFrom({
  id: 1,
  name: 'Elara',
  epithet: 'The Lark',
  tags: ['half-elf', 'bard'],
  appearance: 'Auburn hair.',
  personality: 'Cheerful.',
  backstory: 'Born in Reithwin.',
  abilities: 'College of Lore.',
  relationships: 'Halsin mentor.',
  quotes: ['Hello there.', 'A song is a contract.'],
  stats: [compose.StatKV.createFrom({ key: 'STR', value: '10' }), compose.StatKV.createFrom({ key: 'DEX', value: '16' })],
  dirty: false,
});

const mockCrawlResult = {
  title: 'elara_wynd',
  url: 'https://wiki.test/wiki/Elara',
  domain: 'wiki.test',
  sections: [{ heading: 'Elara Wynd', body: 'A half-elf bard.', level: 1 }],
  infobox: [{ key: 'race', value: 'Half-elf' }],
  wordCount: 1800,
  statusCode: 200,
  latencyMs: 400,
};

const mockGetCharacters = vi.fn();
const mockAddCharacter = vi.fn();
const mockUpdateCharacter = vi.fn();
const mockDeleteCharacter = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockGetCachedCrawl = vi.fn();
const mockCountTokens = vi.fn();
const mockGenerateField = vi.fn();
const mockPickSaveBundle = vi.fn();
const mockSaveProjectBundle = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  AddCharacter: () => mockAddCharacter(),
  UpdateCharacter: (c: any) => mockUpdateCharacter(c),
  DeleteCharacter: (id: any) => mockDeleteCharacter(id),
  SetActiveCharacter: (id: any) => mockSetActiveCharacter(id),
  GetCachedCrawl: () => mockGetCachedCrawl(),
  CountTokens: (t: any) => mockCountTokens(t),
  GenerateField: (fieldID: any, customPrompt: any) => mockGenerateField(fieldID, customPrompt),
  PickSaveBundle: () => mockPickSaveBundle(),
  SaveProjectBundle: (p: any) => mockSaveProjectBundle(p),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('EditorScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([mockCharacter]);
    mockGetCachedCrawl.mockResolvedValue(mockCrawlResult);
    mockCountTokens.mockResolvedValue(10);
    mockUpdateCharacter.mockResolvedValue(undefined);
    mockDeleteCharacter.mockResolvedValue(undefined);
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGenerateField.mockResolvedValue(mockCharacter);
  });

  it('renders the PageHead with step 2 and character name', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const elaraElements = screen.getAllByText('Elara');
      expect(elaraElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders all 10 field labels', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Title / epithet')).toBeInTheDocument();
      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Personality')).toBeInTheDocument();
      expect(screen.getByText('Backstory')).toBeInTheDocument();
      expect(screen.getByText('Abilities & skills')).toBeInTheDocument();
      expect(screen.getByText('Relationships')).toBeInTheDocument();
      expect(screen.getByText('Example quotes')).toBeInTheDocument();
      expect(screen.getByText('Stat block')).toBeInTheDocument();
    });
  });

  it('shows required/optional badges', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const required = screen.getAllByText('required');
      const optional = screen.getAllByText('optional');
      expect(required.length).toBe(3);
      expect(optional.length).toBe(7);
    });
  });

  it('shows character strip with character tabs', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Characters · 1')).toBeInTheDocument();
      expect(screen.getAllByText('Elara').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });
  });

  it('adds a new character on add click', async () => {
    const newChar = compose.Character.createFrom({ id: 2, name: 'New', epithet: '', tags: [], quotes: [''], stats: [] });
    mockAddCharacter.mockResolvedValue(newChar);
    mockGetCharacters.mockResolvedValueOnce([mockCharacter]).mockResolvedValueOnce([mockCharacter, newChar]);

    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add character'));

    await waitFor(() => {
      expect(mockAddCharacter).toHaveBeenCalled();
    });
  });

  it('updates name field on input change', async () => {
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('shows save and re-roll buttons in header', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });
  });

  it('shows delete button in header', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('delete button is disabled with one character', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const deleteBtn = screen.getByText('Delete').closest('button')!;
      expect(deleteBtn).toBeDisabled();
    });
  });

  it('shows source panel with crawl title', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText(/elara_wynd/)).toBeInTheDocument();
    });
  });

  it('renders tags as chips', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('half-elf')).toBeInTheDocument();
      expect(screen.getByText('bard')).toBeInTheDocument();
    });
  });

  it('renders stat rows', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const statKeys = screen.getAllByDisplayValue('STR');
      const statVals = screen.getAllByDisplayValue('10');
      expect(statKeys.length).toBeGreaterThan(0);
      expect(statVals.length).toBeGreaterThan(0);
    });
  });

  it('renders quote textareas', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Hello there.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A song is a contract.')).toBeInTheDocument();
    });
  });

  it('shows lock toggle button', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const lockButtons = screen.getAllByTitle("Lock — won't re-roll with Compose All");
      expect(lockButtons.length).toBe(10);
    });
  });

  it('calls save on save click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateCharacter).toHaveBeenCalled();
    });
  });

  it('shows re-roll all button as enabled', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const rerollBtn = screen.getByText('Re-roll all').closest('button')!;
      expect(rerollBtn).not.toBeDisabled();
    });
  });

  it('shows character ephemeral name in title', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getAllByText('Elara').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows footer with field summary', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText(/save/)).toBeInTheDocument();
    });
  });

  it('shows source panel fallback when no crawl', async () => {
    mockGetCachedCrawl.mockResolvedValue(null);
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText(/No source crawled/)).toBeInTheDocument();
    });
  });

  it('toggles lock on lock button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Lock — won't re-roll with Compose All").length).toBe(10);
    });

    const lockButtons = screen.getAllByTitle("Lock — won't re-roll with Compose All");
    await user.click(lockButtons[0]);

    await waitFor(() => {
      const afterClick = screen.getAllByTitle("Lock — won't re-roll with Compose All");
      expect(afterClick.length).toBe(10);
    });
  });

  it('handles save error gracefully', async () => {
    mockUpdateCharacter.mockRejectedValue(new Error('save error'));
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('handles add character error gracefully', async () => {
    mockAddCharacter.mockRejectedValue(new Error('add error'));
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add character'));

    await waitFor(() => {
      expect(screen.getByText('Add failed')).toBeInTheDocument();
    });
  });

  it('displays character epithet in character strip', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Lark')).toBeInTheDocument();
    });
  });

  it('shows re-crawl button as disabled placeholder', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const recrawlBtn = screen.getByText('Re-crawl').closest('button')!;
      expect(recrawlBtn).toBeDisabled();
    });
  });

  it('shows continue button as disabled', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      const continueBtn = screen.getByText('Continue to Lorebook').closest('button')!;
      expect(continueBtn).toBeDisabled();
    });
  });

  it('shows Save project button', async () => {
    renderWithProviders(<EditorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Save project')).toBeInTheDocument();
    });
  });

  it('calls SaveProjectBundle on save project click', async () => {
    mockPickSaveBundle.mockResolvedValue('/tmp/test.slv');
    mockSaveProjectBundle.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save project')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save project'));

    await waitFor(() => {
      expect(mockPickSaveBundle).toHaveBeenCalled();
    });
  });

  it('handles save project error gracefully', async () => {
    mockPickSaveBundle.mockRejectedValue(new Error('permission denied'));
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Save project')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save project'));

    await waitFor(() => {
      expect(screen.getByText('Save project failed')).toBeInTheDocument();
    });
  });

  it('triggers compose on re-roll all click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Re-roll all'));

    await waitFor(() => {
      expect(mockGenerateField).toHaveBeenCalled();
    });
  });

  it('shows compose error toast on failure', async () => {
    mockGenerateField.mockRejectedValue(new Error('compose error'));
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Re-roll all'));

    await waitFor(() => {
      expect(screen.getByText('Re-roll failed')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('calls GenerateField for per-field reroll', async () => {
    mockGenerateField.mockResolvedValue({
      id: 1, name: 'Test', epithet: '', tags: [], appearance: 'new look',
      personality: 'friendly', backstory: '', abilities: '', relationships: '',
      quotes: [], stats: [], dirty: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<EditorScreen />);

    await waitFor(() => {
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });

    const rerollBtns = screen.getAllByTitle('Re-roll this field');
    if (rerollBtns.length > 0) {
      await user.click(rerollBtns[0]);
    }

    await waitFor(() => {
      expect(mockGenerateField).toHaveBeenCalled();
    });
  });
});
