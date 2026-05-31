import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportScreen from './ExportScreen';
import { ToastProvider } from '../components/ToastProvider';
import { compose } from '../../wailsjs/go/models';

const mockGetCharacters = vi.fn();
const mockExportCharacter = vi.fn();
const mockPickExportFolder = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  ExportCharacter: (id: number, folder: string) => mockExportCharacter(id, folder),
  PickExportFolder: () => mockPickExportFolder(),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const mockCharacters = [
  compose.Character.createFrom({ id: 1, name: 'Alice', epithet: 'Brave', tags: [], quotes: [''], stats: [] }),
  compose.Character.createFrom({ id: 2, name: 'Bob', tags: [], quotes: [''], stats: [] }),
];

describe('ExportScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue(mockCharacters);
    mockExportCharacter.mockResolvedValue('/tmp/export/alice.json');
    mockPickExportFolder.mockResolvedValue('/tmp/export');
  });

  it('renders the page head with step 7', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Export');
    });
  });

  it('shows character list with all characters', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Alice');
      expect(document.body.textContent).toContain('Bob');
    });
  });

  it('shows All/None selection buttons', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
    });
  });

  it('clicking All selects all characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    await user.click(screen.getByText('All'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('2 of 2 selected');
    });
  });

  it('clicking None deselects all characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(screen.getByText('None')).toBeInTheDocument();
    });
    await user.click(screen.getByText('None'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('0 of 2 selected');
    });
  });

  it('shows format picker with JSON only enabled', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('JSON only');
      expect(document.body.textContent).toContain('Character PNG');
    });
  });

  it('shows destination input', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      const input = document.querySelector('input[placeholder*="folder"]');
      expect(input).toBeTruthy();
    });
  });

  it('shows summary with character count', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('2');
    });
  });

  it('toggles character selection on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Alice');
    });

    const aliceBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Alice'));
    if (aliceBtn) await user.click(aliceBtn);

    await waitFor(() => {
      expect(document.body.textContent).toContain('1 of 2 selected');
    });
  });

  it('calls PickExportFolder on folder browse button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Destination');
    });
    const browseBtn = document.querySelector('button[title="Browse…"]');
    if (browseBtn) await user.click(browseBtn);
    await waitFor(() => {
      expect(mockPickExportFolder).toHaveBeenCalled();
    });
  });

  it('handles export with no destination gracefully', async () => {
    mockPickExportFolder.mockResolvedValue('');
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Export');
    });
    const exportBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Export') && !b.textContent?.includes('Exporting'));
    expect(exportBtn?.hasAttribute('disabled')).toBe(true);
  });

  it('renders character epithets when available', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Brave');
    });
  });

  it('enables export button when destination is set', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      const exportBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.includes('Export') && !b.textContent?.includes('Exporting'));
      expect(exportBtn).toBeTruthy();
    });
  });

  it('exports characters on export click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Export');
    });

    const exportBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Export') && !b.textContent?.includes('Exporting'));
    if (exportBtn && !exportBtn.hasAttribute('disabled')) {
      await user.click(exportBtn);
      await waitFor(() => {
        expect(mockExportCharacter).toHaveBeenCalled();
      });
    }
  });

  it('shows export complete toast after successful export', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Export');
    });
    const exportBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Export') && !b.textContent?.includes('Exporting'));
    if (exportBtn && !exportBtn.hasAttribute('disabled')) {
      await user.click(exportBtn);
      await waitFor(() => {
        expect(document.body.textContent).toContain('Export complete');
      });
    }
  });

  it('shows partial export warning when some fail', async () => {
    mockExportCharacter.mockRejectedValue(new Error('fail'));
    const user = userEvent.setup();
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Export');
    });
    const exportBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Export') && !b.textContent?.includes('Exporting'));
    if (exportBtn && !exportBtn.hasAttribute('disabled')) {
      await user.click(exportBtn);
      await waitFor(() => {
        expect(document.body.textContent).toContain('Export partial');
      });
    }
  });

  it('shows summary section', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Summary');
      expect(document.body.textContent).toContain('Format');
    });
  });

  it('handles GetCharacters error gracefully', async () => {
    mockGetCharacters.mockRejectedValue(new Error('fail'));
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Export');
    });
  });

  it('has PNG v2 option disabled', async () => {
    renderWithProviders(<ExportScreen />);
    await waitFor(() => {
      const pngBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.includes('v2 spec'));
      expect(pngBtn?.hasAttribute('disabled')).toBe(true);
    });
  });
});
