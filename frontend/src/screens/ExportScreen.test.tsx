import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, waitFor, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportScreen from './ExportScreen';
import { ToastProvider } from '../components/ToastProvider';
import { compose, lorebook } from '../../wailsjs/go/models';

const mockGetCharacters = vi.fn();
const mockGetLorebook = vi.fn();
const mockExportCharactersBulk = vi.fn();
const mockExportLorebook = vi.fn();
const mockPickExportFolder = vi.fn();
const mockPickSaveBundle = vi.fn();
const mockSaveProjectBundle = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  GetLorebook: () => mockGetLorebook(),
  ExportCharactersBulk: (ids: number[], fmt: string, opts: unknown, dest: string) =>
    mockExportCharactersBulk(ids, fmt, opts, dest),
  ExportLorebook: (dest: string) => mockExportLorebook(dest),
  PickExportFolder: () => mockPickExportFolder(),
  PickSaveBundle: () => mockPickSaveBundle(),
  SaveProjectBundle: (path: string) => mockSaveProjectBundle(path),
}));

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

import { EventsOn } from '../../wailsjs/runtime/runtime';

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const mockCharacters = [
  compose.Character.createFrom({ id: 1, name: 'Alice', epithet: 'Brave', tags: [], quotes: [''], stats: [] }),
  compose.Character.createFrom({ id: 2, name: 'Bob', tags: [], quotes: [''], stats: [] }),
];

const mockEntries = [
  lorebook.Entry.createFrom({ uid: 0, comment: 'The Harpers', order: 100, position: 0 }),
  lorebook.Entry.createFrom({ uid: 1, comment: 'Faerûn baseline', order: 200, position: 1 }),
];

// findExportButton returns the primary export/save action button.
const findExportButton = () =>
  Array.from(document.querySelectorAll('button'))
    .find(b => /Export \d|Save bundle/.test(b.textContent ?? ''));

describe('ExportScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue(mockCharacters);
    mockGetLorebook.mockResolvedValue(mockEntries);
    mockExportCharactersBulk.mockResolvedValue({ exported: 2, failed: 0, paths: ['/a.png', '/b.png'] });
    mockExportLorebook.mockResolvedValue('/mock/world_info.json');
    mockPickExportFolder.mockResolvedValue('/mock/export');
    mockPickSaveBundle.mockResolvedValue('/mock/project.slv');
    mockSaveProjectBundle.mockResolvedValue(undefined);
  });

  it('renders the page head', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Ship the project'));
  });

  it('lists characters with a selected count', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Alice');
      expect(document.body.textContent).toContain('Bob');
      expect(document.body.textContent).toContain('2 of 2 selected');
    });
  });

  it('lists lorebook entries with a selected count', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('The Harpers');
      expect(document.body.textContent).toContain('Faerûn baseline');
    });
  });

  it('shows an empty state when there are no lorebook entries', async () => {
    mockGetLorebook.mockResolvedValue([]);
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('No lorebook entries'));
  });

  it('character All/None toggles the selection count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(screen.getAllByText('None').length).toBeGreaterThan(0));
    await user.click(screen.getAllByText('None')[0]);
    await waitFor(() => expect(document.body.textContent).toContain('0 of 2 selected'));
    await user.click(screen.getAllByText('All')[0]);
    await waitFor(() => expect(document.body.textContent).toContain('2 of 2 selected'));
  });

  it('toggles a single character off', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Alice'));
    const aliceBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Alice'));
    await user.click(aliceBtn!);
    await waitFor(() => expect(document.body.textContent).toContain('1 of 2 selected'));
  });

  it('shows embedding options for PNG formats and hides them for JSON', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Embed lorebook in each character (CCv3)'));

    const jsonBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('JSON only'));
    await user.click(jsonBtn!);
    await waitFor(() => expect(document.body.textContent).not.toContain('Strip generation metadata'));
  });

  it('browse button calls PickExportFolder and fills the destination', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Destination'));
    await user.click(screen.getByTitle('Browse…'));
    await waitFor(() => {
      expect(mockPickExportFolder).toHaveBeenCalled();
      const input = document.querySelector('input[placeholder*="folder"]') as HTMLInputElement;
      expect(input.value).toBe('/mock/export');
    });
  });

  it('disables export until a destination is set', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(findExportButton()).toBeTruthy());
    expect(findExportButton()!.hasAttribute('disabled')).toBe(true);
  });

  it('exports characters via ExportCharactersBulk and toasts success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Alice'));

    const input = document.querySelector('input[placeholder*="folder"]') as HTMLInputElement;
    await user.type(input, '/out');
    await user.click(findExportButton()!);

    await waitFor(() => {
      expect(mockExportCharactersBulk).toHaveBeenCalledWith([1, 2], 'png-v2', expect.anything(), '/out');
      expect(document.body.textContent).toContain('Export complete');
    });
  });

  it('warns when some exports fail', async () => {
    mockExportCharactersBulk.mockResolvedValue({ exported: 1, failed: 1, paths: ['/a.png'] });
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Alice'));
    const input = document.querySelector('input[placeholder*="folder"]') as HTMLInputElement;
    await user.type(input, '/out');
    await user.click(findExportButton()!);
    await waitFor(() => expect(document.body.textContent).toContain('Export partial'));
  });

  it('toasts an error when the bulk export rejects', async () => {
    mockExportCharactersBulk.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Alice'));
    const input = document.querySelector('input[placeholder*="folder"]') as HTMLInputElement;
    await user.type(input, '/out');
    await user.click(findExportButton()!);
    await waitFor(() => expect(document.body.textContent).toContain('Export failed'));
  });

  it('switches to bundle format and saves via PickSaveBundle + SaveProjectBundle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Silly Sleeve bundle'));

    const bundleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Silly Sleeve bundle'));
    await user.click(bundleBtn!);

    // Destination card is hidden in bundle mode; the action becomes Save bundle.
    await waitFor(() => expect(document.body.textContent).toContain('Save bundle'));
    await user.click(findExportButton()!);
    await waitFor(() => {
      expect(mockPickSaveBundle).toHaveBeenCalled();
      expect(mockSaveProjectBundle).toHaveBeenCalledWith('/mock/project.slv');
      expect(document.body.textContent).toContain('Bundle saved');
    });
  });

  it('exports the lorebook via ExportLorebook', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('The Harpers'));
    const input = document.querySelector('input[placeholder*="folder"]') as HTMLInputElement;
    await user.type(input, '/out');

    const loreBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Export lorebook'));
    await user.click(loreBtn!);
    await waitFor(() => {
      expect(mockExportLorebook).toHaveBeenCalledWith('/out');
      expect(document.body.textContent).toContain('Lorebook exported');
    });
  });

  it('renders an export queue driven by progress events', async () => {
    // Hold the bulk call open so the queue panel stays mounted.
    let resolveBulk!: (v: { exported: number; failed: number; paths: string[] }) => void;
    mockExportCharactersBulk.mockImplementation(() => new Promise(r => { resolveBulk = r; }));

    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => expect(document.body.textContent).toContain('Alice'));
    const input = document.querySelector('input[placeholder*="folder"]') as HTMLInputElement;
    await user.type(input, '/out');
    await user.click(findExportButton()!);

    await waitFor(() => expect(document.body.textContent).toContain('Export queue'));

    // Fire a progress event captured from the EventsOn subscription.
    const onCall = (EventsOn as unknown as Mock).mock.calls.find(c => c[0] === 'export:progress');
    expect(onCall).toBeTruthy();
    act(() => onCall![1]({ charId: 1, status: 'done' }));
    await waitFor(() => expect(document.body.textContent).toContain('done'));

    act(() => resolveBulk({ exported: 2, failed: 0, paths: [] }));
    await waitFor(() => expect(document.body.textContent).toContain('Export complete'));
  });
});
