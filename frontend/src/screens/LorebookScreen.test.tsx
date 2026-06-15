import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LorebookScreen from './LorebookScreen';
import { ToastProvider } from '../components/ToastProvider';

const mockGetLorebook = vi.fn();
const mockSaveLorebook = vi.fn();
const mockExportLorebook = vi.fn();
const mockPickExportFolder = vi.fn();
const mockGetCharacters = vi.fn();
const mockImportLorebook = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetLorebook: () => mockGetLorebook(),
  SaveLorebook: (...args: unknown[]) => mockSaveLorebook(...args),
  ExportLorebook: (...args: unknown[]) => mockExportLorebook(...args),
  PickExportFolder: () => mockPickExportFolder(),
  GetCharacters: () => mockGetCharacters(),
  ImportLorebook: () => mockImportLorebook(),
}));

const renderWithToast = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('LorebookScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLorebook.mockResolvedValue([]);
    mockSaveLorebook.mockResolvedValue(undefined);
    mockPickExportFolder.mockResolvedValue('');
    mockGetCharacters.mockResolvedValue([
      { id: 7, name: 'Aria' },
      { id: 8, name: 'Bram' },
    ]);
    mockImportLorebook.mockResolvedValue([]);
  });

  it('renders after loading', async () => {
    const { container } = renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(container.textContent).toContain('Lorebook');
      expect(container.textContent).toContain('New entry');
    });
  });

  it('shows empty state', async () => {
    const { container } = renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(container.textContent).toContain('No entries yet');
    });
  });

  it('adds a new entry on button click', async () => {
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('New entry')).toBeInTheDocument();
    });
    await user.click(screen.getByText('New entry'));
    await waitFor(() => {
      expect(mockSaveLorebook).toHaveBeenCalled();
    });
  });

  it('surfaces a toast when saving a new entry fails', async () => {
    mockSaveLorebook.mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('New entry')).toBeInTheDocument();
    });
    await user.click(screen.getByText('New entry'));
    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('loads existing entries', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'Test entry', key: ['test'], keysecondary: [], content: 'hello', order: 100, position: 0, probability: 100 },
    ]);
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('Test entry')).toBeInTheDocument();
    });
  });

  it('filters entries by search', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'Alpha', key: ['alpha'], keysecondary: [], content: '', order: 100 },
      { uid: 1, comment: 'Beta', key: ['beta'], keysecondary: [], content: '', order: 90 },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('Search by name or trigger key…');
    await user.type(input, 'Alpha');
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Beta')).toBeNull();
    });
  });

  it('selects entry and shows detail editor', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'Detail test', key: ['testkey'], keysecondary: [], content: 'test content', order: 100, position: 0, probability: 100 },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('Detail test')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Detail test'));
    await waitFor(() => {
      expect(screen.getByText('Triggers')).toBeInTheDocument();
      expect(screen.getByText('test content')).toBeInTheDocument();
    });
  });

  it('deletes selected entry', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'To delete', key: [], keysecondary: [], content: '', order: 100 },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('To delete')).toBeInTheDocument();
    });
    await user.click(screen.getByText('To delete'));
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
    // Click the "Delete" button in the footer
    const deleteBtns = screen.getAllByText('Delete');
    // The last one should be the footer delete button
    await user.click(deleteBtns[deleteBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByText('To delete')).toBeNull();
    });
  });

  it('shows entry count and token count', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'E1', key: [], keysecondary: [], content: 'some content', order: 100 },
      { uid: 1, comment: 'E2', key: [], keysecondary: [], content: 'more content here', order: 90 },
    ]);
    const { container } = renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('E1')).toBeInTheDocument();
      expect(screen.getByText('E2')).toBeInTheDocument();
      expect(container.querySelector('.lh .meta')).toBeTruthy();
    });
  });

  it('edits entry comment via title input', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'Old name', key: [], keysecondary: [], content: '', order: 100 },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('Old name')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Old name'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Old name')).toBeInTheDocument();
    });
    const titleInput = screen.getByPlaceholderText('Entry name…');
    await user.clear(titleInput);
    await user.type(titleInput, 'New name');
    expect(mockSaveLorebook).toHaveBeenCalled();
  });

  it('adds a primary key via trigger input', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'KeyTest', key: [], keysecondary: [], content: '', order: 100 },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('KeyTest')).toBeInTheDocument();
    });
    await user.click(screen.getByText('KeyTest'));
    await waitFor(() => {
      expect(screen.getByText('Triggers')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('e.g. "Harpers", "silver harp"…');
    await user.type(input, 'Harpers{Enter}');
    expect(mockSaveLorebook).toHaveBeenCalled();
  });

  it('shows empty detail placeholder when no entry selected', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'Entry', key: [], keysecondary: [], content: '', order: 100 },
    ]);
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('Pick an entry to edit')).toBeInTheDocument();
    });
  });

  it('calls export on export button click', async () => {
    mockPickExportFolder.mockResolvedValue('/mock/export/path');
    mockExportLorebook.mockResolvedValue('/mock/export/path/world_info.json');
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('Export world_info.json')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Export world_info.json'));
    await waitFor(() => {
      expect(mockPickExportFolder).toHaveBeenCalled();
      expect(mockExportLorebook).toHaveBeenCalledWith('/mock/export/path');
    });
  });

  it('shows position selection in detail editor', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'PosTest', key: [], keysecondary: [], content: 'test', order: 100, position: 0 },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => {
      expect(screen.getByText('PosTest')).toBeInTheDocument();
    });
    await user.click(screen.getByText('PosTest'));
    await waitFor(() => {
      expect(screen.getByText('Position in context')).toBeInTheDocument();
      expect(screen.getAllByText('Before Char Defs').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('scopes an entry to a character via a chip and persists the id string', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'E', key: [], characters: [] },
    ]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => expect(screen.getByText('E')).toBeInTheDocument());
    await user.click(screen.getByText('E'));
    await user.click(screen.getByRole('button', { name: /Aria/ }));
    await waitFor(() => {
      const last = mockSaveLorebook.mock.calls.at(-1)![0][0];
      expect(last.characters).toEqual(['7']);
    });
  });

  it('reorders entries on drop and persists gapped order', async () => {
    mockGetLorebook.mockResolvedValue([
      { uid: 0, comment: 'A', key: [], order: 300 },
      { uid: 1, comment: 'B', key: [], order: 200 },
      { uid: 2, comment: 'C', key: [], order: 100 },
    ]);
    renderWithToast(<LorebookScreen />);
    await waitFor(() => expect(screen.getByText('C')).toBeInTheDocument());
    const rows = screen.getAllByRole('button').filter(b => b.classList.contains('lb-entry'));
    const dt = { setData: vi.fn(), getData: vi.fn(), dropEffect: '', effectAllowed: '' };
    // rows render order-desc: [A(0), B(1), C(2)]; drag C onto A
    fireEvent.dragStart(rows[2], { dataTransfer: dt });
    fireEvent.dragOver(rows[0], { dataTransfer: dt });
    fireEvent.drop(rows[0], { dataTransfer: dt });
    await waitFor(() => {
      const saved = mockSaveLorebook.mock.calls.at(-1)![0] as Array<{ uid: number; order: number }>;
      const byUid = Object.fromEntries(saved.map(e => [e.uid, e.order]));
      expect(byUid[2]).toBe(1000);
      expect(byUid[0]).toBe(990);
      expect(byUid[1]).toBe(980);
    });
  });

  it('imports and merges, remapping UIDs onto existing entries', async () => {
    mockGetLorebook.mockResolvedValue([{ uid: 0, comment: 'Existing', key: [] }]);
    mockImportLorebook.mockResolvedValue([{ uid: 0, comment: 'Imported', key: [] }]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => expect(screen.getByText('Existing')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Import \.json/i }));
    await user.click(await screen.findByRole('button', { name: /^Merge/i }));
    await waitFor(() => {
      const saved = mockSaveLorebook.mock.calls.at(-1)![0] as Array<{ uid: number; comment: string }>;
      expect(saved).toHaveLength(2);
      expect(saved[1]).toMatchObject({ uid: 1, comment: 'Imported' });
    });
  });

  it('imports and replaces, renumbering from zero', async () => {
    mockGetLorebook.mockResolvedValue([{ uid: 0, comment: 'Existing', key: [] }]);
    mockImportLorebook.mockResolvedValue([{ uid: 9, comment: 'Imported', key: [] }]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => expect(screen.getByText('Existing')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Import \.json/i }));
    await user.click(await screen.findByRole('button', { name: /^Replace/i }));
    await waitFor(() => {
      const saved = mockSaveLorebook.mock.calls.at(-1)![0] as Array<{ uid: number; comment: string }>;
      expect(saved).toEqual([expect.objectContaining({ uid: 0, comment: 'Imported' })]);
    });
  });

  it('does nothing when import is cancelled or empty', async () => {
    mockImportLorebook.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithToast(<LorebookScreen />);
    await waitFor(() => expect(screen.getByText('New entry')).toBeInTheDocument());
    mockSaveLorebook.mockClear();
    await user.click(screen.getByRole('button', { name: /Import \.json/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Merge/i })).toBeNull());
    expect(mockSaveLorebook).not.toHaveBeenCalled();
  });
});
