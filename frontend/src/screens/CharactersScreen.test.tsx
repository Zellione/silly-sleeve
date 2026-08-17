import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../components/ToastProvider';
import CharactersScreen from './CharactersScreen';
import { estimateCharTokens, charSummary, isCharReady } from './characterList';
import { compose } from '../../wailsjs/go/models';

const mockGetCharacters = vi.fn();
const mockAddCharacter = vi.fn();
const mockSetActiveCharacter = vi.fn();
const mockImportCard = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  AddCharacter: () => mockAddCharacter(),
  SetActiveCharacter: (id: number) => mockSetActiveCharacter(id),
  ImportCard: () => mockImportCard(),
}));

vi.mock('./EditorScreen', () => ({
  default: () => <div data-testid="editor-screen">editor</div>,
}));

const char = (over: Partial<compose.Character> = {}) =>
  compose.Character.createFrom({
    id: 1, name: 'Elara', epithet: 'Crimson Lark', tags: [],
    appearance: '', personality: '', backstory: '', abilities: '',
    relationships: '', quotes: [], altGreetings: [], stats: [],
    dirty: false, portrait: [],
    ...over,
  });

const renderScreen = () =>
  render(
    <ToastProvider>
      <CharactersScreen projectPath="" onProjectPathChange={() => {}} />
    </ToastProvider>,
  );

describe('character list helpers', () => {
  it('estimates tokens from prose fields', () => {
    const c = char({ personality: 'one two three four', quotes: ['five six'] });
    expect(estimateCharTokens(c)).toBe(Math.round(6 * 1.35));
  });

  it('estimates zero tokens for an empty character', () => {
    expect(estimateCharTokens(char())).toBe(0);
  });

  it('uses the first non-empty prose field as summary', () => {
    expect(charSummary(char({ backstory: 'Born in Reithwin.' }))).toBe('Born in Reithwin.');
    expect(charSummary(char({ personality: 'Cheerful.', backstory: 'x' }))).toBe('Cheerful.');
    expect(charSummary(char())).toBe('');
  });

  it('marks characters with a name and prose as ready', () => {
    expect(isCharReady(char({ personality: 'Watchful.' }))).toBe(true);
    expect(isCharReady(char())).toBe(false);
    expect(isCharReady(char({ name: ' ', personality: 'x' }))).toBe(false);
  });
});

describe('CharactersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([
      char({ id: 1, name: 'Elara', personality: 'Cheerful in taverns.' }),
      char({ id: 2, name: 'Olly', epithet: 'Tavernkeeper' }),
    ]);
    mockSetActiveCharacter.mockResolvedValue(undefined);
  });

  it('shows the portrait as the row thumbnail when one exists', async () => {
    mockGetCharacters.mockResolvedValue([
      char({ id: 1, name: 'Elara', portrait: [0xFF, 0xD8, 0xFF, 0xE0] }),
      char({ id: 2, name: 'Olly' }),
    ]);
    const { container } = renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    const imgs = container.querySelectorAll('.cl-row .av img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
    // The portraitless character keeps the initial-letter avatar.
    expect(screen.getByText('O')).toBeInTheDocument();
  });

  it('lists every character with status and summary', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Elara')).toBeInTheDocument();
    });
    expect(screen.getByText('Olly')).toBeInTheDocument();
    expect(screen.getByText('Cheerful in taverns.')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText(/No summary yet/)).toBeInTheDocument();
  });

  it('opens a character into the editor detail view', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Elara')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Elara'));
    await waitFor(() => {
      expect(screen.getByTestId('editor-screen')).toBeInTheDocument();
    });
    expect(mockSetActiveCharacter).toHaveBeenCalledWith(1);
    expect(screen.getByText('← All characters')).toBeInTheDocument();
    expect(screen.getByText('Crimson Lark')).toBeInTheDocument();
  });

  it('returns to the list and refetches on back', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByText('Elara'));
    await waitFor(() => expect(screen.getByTestId('editor-screen')).toBeInTheDocument());
    expect(mockGetCharacters).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('← All characters'));
    await waitFor(() => expect(screen.getByText('Olly')).toBeInTheDocument());
    expect(mockGetCharacters).toHaveBeenCalledTimes(2);
  });

  it('shows a toast when opening fails', async () => {
    mockSetActiveCharacter.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByText('Elara'));
    await waitFor(() => {
      expect(screen.getByText('Open failed')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('editor-screen')).not.toBeInTheDocument();
  });

  it('adds a character and opens it', async () => {
    mockAddCharacter.mockResolvedValue(char({ id: 9, name: 'New', epithet: '' }));
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Add character/ }));
    await waitFor(() => expect(screen.getByTestId('editor-screen')).toBeInTheDocument());
    expect(mockSetActiveCharacter).toHaveBeenCalledWith(9);
  });

  it('shows a toast when adding fails', async () => {
    mockAddCharacter.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Add character/ }));
    await waitFor(() => {
      expect(screen.getByText('Add failed')).toBeInTheDocument();
    });
  });

  it('imports a card and opens the imported character', async () => {
    mockImportCard.mockResolvedValue({
      character: char({ id: 5, name: 'Yennefer' }),
      importedEntries: 2,
    });
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Import card' }));
    await waitFor(() => expect(screen.getByTestId('editor-screen')).toBeInTheDocument());
    expect(mockSetActiveCharacter).toHaveBeenCalledWith(5);
    expect(screen.getByText(/\+2 lore entries/)).toBeInTheDocument();
  });

  it('stays on the list when import is cancelled', async () => {
    mockImportCard.mockResolvedValue(null);
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Import card' }));
    expect(screen.queryByTestId('editor-screen')).not.toBeInTheDocument();
  });

  it('shows a toast when import fails', async () => {
    mockImportCard.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Import card' }));
    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument();
    });
  });

  it('offers the dashed new-character row', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());
    expect(screen.getByText(/New character — from a crawl summary/)).toBeInTheDocument();
  });
});
