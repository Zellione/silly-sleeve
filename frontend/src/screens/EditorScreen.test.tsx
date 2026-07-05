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
const mockGetActiveCharacter = vi.fn();
const mockAddCharacter = vi.fn();
const mockUpdateCharacter = vi.fn();
const mockDeleteCharacter = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockGetCrawlForCharacter = vi.fn();
const mockCountTokens = vi.fn();
const mockGenerateField = vi.fn();
const mockGenerateCharacterBulk = vi.fn();
const mockPickSaveBundle = vi.fn();
const mockSaveProjectBundle = vi.fn();
const mockGetSettings = vi.fn();
const mockGetProjectFieldEndpoints = vi.fn();
const mockSetProjectFieldEndpoint = vi.fn();
const mockImportCard = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  GetActiveCharacter: () => mockGetActiveCharacter(),
  AddCharacter: () => mockAddCharacter(),
  UpdateCharacter: (c: any) => mockUpdateCharacter(c),
  DeleteCharacter: (id: any) => mockDeleteCharacter(id),
  SetActiveCharacter: (id: any) => mockSetActiveCharacter(id),
  GetCrawlForCharacter: (id: any) => mockGetCrawlForCharacter(id),
  CountTokens: (t: any) => mockCountTokens(t),
  GenerateField: (fieldID: any, customPrompt: any) => mockGenerateField(fieldID, customPrompt),
  GenerateCharacterBulk: (locked: any) => mockGenerateCharacterBulk(locked),
  PickSaveBundle: () => mockPickSaveBundle(),
  SaveProjectBundle: (p: any) => mockSaveProjectBundle(p),
  GetSettings: () => mockGetSettings(),
  GetProjectFieldEndpoints: () => mockGetProjectFieldEndpoints(),
  SetProjectFieldEndpoint: (slot: any, id: any) => mockSetProjectFieldEndpoint(slot, id),
  ImportCard: () => mockImportCard(),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const renderEditor = () =>
  renderWithProviders(<EditorScreen projectPath="" onProjectPathChange={vi.fn()} />);

describe('EditorScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([mockCharacter]);
    mockGetActiveCharacter.mockResolvedValue(mockCharacter);
    mockGetCrawlForCharacter.mockResolvedValue(mockCrawlResult);
    mockCountTokens.mockResolvedValue(10);
    mockUpdateCharacter.mockResolvedValue(undefined);
    mockDeleteCharacter.mockResolvedValue(undefined);
    mockSetActiveCharacter.mockResolvedValue(undefined);
    mockGenerateField.mockResolvedValue(mockCharacter);
    mockGenerateCharacterBulk.mockResolvedValue(mockCharacter);
    mockGetSettings.mockResolvedValue({ endpoints: [], fieldEndpoints: {}, autoSaveMode: 'off' });
    mockGetProjectFieldEndpoints.mockResolvedValue({});
    mockSetProjectFieldEndpoint.mockResolvedValue(undefined);
  });

  it('renders the PageHead with step 2 and character name', async () => {
    renderEditor();
    await waitFor(() => {
      const elaraElements = screen.getAllByText('Elara');
      expect(elaraElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders all 10 field labels', async () => {
    renderEditor();
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
    renderEditor();
    await waitFor(() => {
      const required = screen.getAllByText('required');
      const optional = screen.getAllByText('optional');
      expect(required.length).toBe(3);
      expect(optional.length).toBe(7);
    });
  });

  it('shows character strip with character tabs', async () => {
    renderEditor();
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
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add character'));

    await waitFor(() => {
      expect(mockAddCharacter).toHaveBeenCalled();
    });
  });

  it('updates name field on input change', async () => {
    renderEditor();

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('shows save and re-roll buttons in header', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });
  });

  it('shows delete button in header', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('delete button is disabled with one character', async () => {
    renderEditor();
    await waitFor(() => {
      const deleteBtn = screen.getByText('Delete').closest('button')!;
      expect(deleteBtn).toBeDisabled();
    });
  });

  it('shows source panel with crawl title', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText(/elara_wynd/)).toBeInTheDocument();
    });
  });

  it('opens on the backend active character, not the first', async () => {
    const second = compose.Character.createFrom({ id: 2, name: 'Tatsumi', epithet: '', tags: [], quotes: [''], stats: [] });
    mockGetCharacters.mockResolvedValue([mockCharacter, second]);
    mockGetActiveCharacter.mockResolvedValue(second);

    renderEditor();

    await waitFor(() => {
      // PageHead title reads "Compose <first word of active name>".
      expect(screen.getAllByText('Tatsumi').length).toBeGreaterThanOrEqual(1);
    });
    expect(mockSetActiveCharacter).toHaveBeenCalledWith(2);
  });

  it('loads the source for the active character', async () => {
    const second = compose.Character.createFrom({ id: 2, name: 'Tatsumi', epithet: '', tags: [], quotes: [''], stats: [] });
    const secondCrawl = { ...mockCrawlResult, title: 'tatsumi_page' };
    mockGetCharacters.mockResolvedValue([mockCharacter, second]);
    mockGetActiveCharacter.mockResolvedValue(second);
    mockGetCrawlForCharacter.mockImplementation((id: number) =>
      Promise.resolve(id === 2 ? secondCrawl : mockCrawlResult));

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText(/tatsumi_page/)).toBeInTheDocument();
    });
    expect(mockGetCrawlForCharacter).toHaveBeenCalledWith(2);
    expect(screen.queryByText(/elara_wynd/)).not.toBeInTheDocument();
  });

  it('does not apply a mid-reroll result after switching characters', async () => {
    const second = compose.Character.createFrom({ id: 2, name: 'Tatsumi', epithet: '', tags: [], appearance: 'Tatsumi look', quotes: [''], stats: [] });
    mockGetCharacters.mockResolvedValue([mockCharacter, second]);
    mockGetActiveCharacter.mockResolvedValue(mockCharacter);

    let resolveField: (c: unknown) => void = () => {};
    mockGenerateField.mockReturnValue(new Promise(res => { resolveField = res; }));

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => expect(screen.getByText('The Lark')).toBeInTheDocument());

    // Start a reroll of the Appearance field (index 3) on the active character.
    await user.click(screen.getAllByTitle('Re-roll this field')[3]);

    // Switch to Tatsumi while the reroll is still in flight.
    await user.click(screen.getByText('Tatsumi'));
    await waitFor(() => expect(mockSetActiveCharacter).toHaveBeenCalledWith(2));

    // The reroll resolves with the original character's result.
    resolveField(compose.Character.createFrom({ ...mockCharacter, appearance: 'HIJACKED' }));

    // The result must not leak into the now-active character's view.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Tatsumi look')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('HIJACKED')).not.toBeInTheDocument();
  });

  it('renders tags as chips', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText('half-elf')).toBeInTheDocument();
      expect(screen.getByText('bard')).toBeInTheDocument();
    });
  });

  it('renders stat rows', async () => {
    renderEditor();
    await waitFor(() => {
      const statKeys = screen.getAllByDisplayValue('STR');
      const statVals = screen.getAllByDisplayValue('10');
      expect(statKeys.length).toBeGreaterThan(0);
      expect(statVals.length).toBeGreaterThan(0);
    });
  });

  it('renders quote textareas', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Hello there.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A song is a contract.')).toBeInTheDocument();
    });
  });

  it('shows lock toggle button', async () => {
    renderEditor();
    await waitFor(() => {
      const lockButtons = screen.getAllByTitle("Lock — won't re-roll with Compose All");
      expect(lockButtons.length).toBe(10);
    });
  });

  it('calls save on save click', async () => {
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateCharacter).toHaveBeenCalled();
    });
  });

  it('shows re-roll all button as enabled', async () => {
    renderEditor();
    await waitFor(() => {
      const rerollBtn = screen.getByText('Re-roll all').closest('button')!;
      expect(rerollBtn).not.toBeDisabled();
    });
  });

  it('shows character ephemeral name in title', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getAllByText('Elara').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows the full multi-word name in the title, not just the first word', async () => {
    const longName = compose.Character.createFrom({
      id: 3, name: 'A Delivery Girl Ate Your Pizza', epithet: '', tags: [], quotes: [''], stats: [],
    });
    mockGetCharacters.mockResolvedValue([longName]);
    mockGetActiveCharacter.mockResolvedValue(longName);

    renderEditor();

    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Compose A Delivery Girl Ate Your Pizza');
    });
  });

  it('shows footer with field summary', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText(/save/)).toBeInTheDocument();
    });
  });

  it('shows source panel fallback when no crawl', async () => {
    mockGetCrawlForCharacter.mockResolvedValue(null);
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText(/No source crawled/)).toBeInTheDocument();
    });
  });

  it('toggles lock on lock button click', async () => {
    const user = userEvent.setup();
    renderEditor();

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
    renderEditor();

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
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add character'));

    await waitFor(() => {
      expect(screen.getByText('Add failed')).toBeInTheDocument();
    });
  });

  it('displays character epithet in character strip', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText('The Lark')).toBeInTheDocument();
    });
  });

  it('shows re-crawl button as disabled placeholder', async () => {
    renderEditor();
    await waitFor(() => {
      const recrawlBtn = screen.getByText('Re-crawl').closest('button')!;
      expect(recrawlBtn).toBeDisabled();
    });
  });

  it('shows continue button as disabled', async () => {
    renderEditor();
    await waitFor(() => {
      const continueBtn = screen.getByText('Continue to Lorebook').closest('button')!;
      expect(continueBtn).toBeDisabled();
    });
  });

  it('shows Save project button', async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText('Save project')).toBeInTheDocument();
    });
  });

  it('calls SaveProjectBundle on save project click', async () => {
    mockPickSaveBundle.mockResolvedValue('/mock/test.slv');
    mockSaveProjectBundle.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderEditor();

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
    renderEditor();

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
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Re-roll all'));

    await waitFor(() => {
      expect(mockGenerateCharacterBulk).toHaveBeenCalled();
    });
  });

  it('shows compose error toast on failure', async () => {
    mockGenerateCharacterBulk.mockRejectedValue(new Error('compose error'));
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Re-roll all')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Re-roll all'));

    await waitFor(() => {
      expect(screen.getByText('Compose failed')).toBeInTheDocument();
    });
  });

  it('calls GenerateField for per-field reroll', async () => {
    mockGenerateField.mockResolvedValue({
      id: 1, name: 'Test', epithet: '', tags: [], appearance: 'new look',
      personality: 'friendly', backstory: '', abilities: '', relationships: '',
      quotes: [], stats: [], dirty: false,
    });
    const user = userEvent.setup();
    renderEditor();

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

  it('flushes dirty fields before saving project', async () => {
    const callOrder: string[] = [];
    mockUpdateCharacter.mockImplementation(async () => {
      callOrder.push('update');
    });
    mockSaveProjectBundle.mockImplementation(async () => {
      callOrder.push('bundle');
    });
    mockPickSaveBundle.mockResolvedValue('/mock/test.slv');
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Save project')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Elara');
    await user.clear(nameInput);
    await user.type(nameInput, 'Modified Name');

    await user.click(screen.getByText('Save project'));

    await waitFor(() => {
      expect(mockUpdateCharacter).toHaveBeenCalled();
      expect(mockSaveProjectBundle).toHaveBeenCalledWith('/mock/test.slv');
    });

    expect(callOrder).toEqual(['update', 'bundle']);
    const updated = mockUpdateCharacter.mock.calls[0][0] as compose.Character;
    expect(updated.name).toBe('Modified Name');
  });

  it('flushes character before saving via Save button', async () => {
    const callOrder: string[] = [];
    mockUpdateCharacter.mockImplementation(async () => {
      callOrder.push('update');
    });
    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Elara');
    await user.clear(nameInput);
    await user.type(nameInput, 'Modified Name');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateCharacter).toHaveBeenCalled();
    });

    const updated = mockUpdateCharacter.mock.calls[0][0] as compose.Character;
    expect(updated.name).toBe('Modified Name');
    expect(callOrder).toContain('update');
  });

  it('imports a card and toasts on success', async () => {
    const importedChar = compose.Character.createFrom({
      id: 2,
      name: 'Pix',
      epithet: '',
      tags: [],
      appearance: '',
      personality: '',
      backstory: '',
      abilities: '',
      relationships: '',
      quotes: [''],
      stats: [],
      dirty: false,
    });
    mockImportCard.mockResolvedValue({
      character: importedChar,
      importedEntries: 3,
    });
    mockGetCharacters.mockResolvedValueOnce([mockCharacter]).mockResolvedValueOnce([mockCharacter, importedChar]);

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import card/i });
    expect(importBtn).toBeInTheDocument();

    await user.click(importBtn);

    await waitFor(() => {
      expect(mockImportCard).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Imported "Pix"/)).toBeInTheDocument();
      expect(screen.getByText(/\+3 lore entries/)).toBeInTheDocument();
    });
  });

  it('is a no-op when the dialog is cancelled', async () => {
    mockImportCard.mockResolvedValue(null);

    const user = userEvent.setup();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Add character')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import card/i });
    await user.click(importBtn);

    await waitFor(() => {
      expect(mockImportCard).toHaveBeenCalled();
    });

    // Assert no error toast and character count unchanged
    expect(screen.queryByText(/Import failed/)).not.toBeInTheDocument();
    expect(screen.getByText('Characters · 1')).toBeInTheDocument();
  });
});
