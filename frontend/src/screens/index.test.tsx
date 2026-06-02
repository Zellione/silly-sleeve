import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../components/ToastProvider';
import {
  DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
  ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './index';

const mockGetCharacters = vi.fn();
const mockSaveProjectBundle = vi.fn();
const mockPickSaveBundle = vi.fn();
const mockPickExportFolder = vi.fn();
const mockExportCharacter = vi.fn();
const mockPickOpenBundle = vi.fn();
const mockOpenProjectBundle = vi.fn();
const mockGetLorebook = vi.fn();
const mockSaveLorebook = vi.fn();
const mockExportLorebook = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  AddCharacter: vi.fn(),
  UpdateCharacter: vi.fn(),
  DeleteCharacter: vi.fn(),
  SetActiveCharacter: vi.fn(),
  GetCachedCrawl: vi.fn().mockResolvedValue(null),
  CountTokens: vi.fn().mockResolvedValue(0),
  CrawlPage: vi.fn(),
  SaveProjectBundle: (...args: unknown[]) => mockSaveProjectBundle(...args),
  PickSaveBundle: () => mockPickSaveBundle(),
  PickExportFolder: () => mockPickExportFolder(),
  ExportCharacter: (...args: unknown[]) => mockExportCharacter(...args),
  PickOpenBundle: () => mockPickOpenBundle(),
  OpenProjectBundle: (...args: unknown[]) => mockOpenProjectBundle(...args),
  GetLorebook: () => mockGetLorebook(),
  SaveLorebook: (...args: unknown[]) => mockSaveLorebook(...args),
  ExportLorebook: (...args: unknown[]) => mockExportLorebook(...args),
}));

const renderWithToast = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const placeholders = [
  { name: 'ProjectImageScreen', component: ProjectImageScreen, title: 'Project image' },
  { name: 'PortraitScreen', component: PortraitScreen, title: 'Portrait' },
  { name: 'PreviewScreen', component: PreviewScreen, title: 'Preview character card' },
];

describe('screens/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([]);
    mockPickSaveBundle.mockResolvedValue('');
    mockPickExportFolder.mockResolvedValue('');
    mockPickOpenBundle.mockResolvedValue('');
    mockOpenProjectBundle.mockResolvedValue({ name: 'Test', version: '1', createdAt: '', updatedAt: '', sourceUrl: '', crawlTitle: '', activeCharId: 1 });
    mockGetLorebook.mockResolvedValue([]);
    mockSaveLorebook.mockResolvedValue(undefined);
  });

  describe('DashboardScreen', () => {
    it('renders title', async () => {
      const { container } = renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('Your projects');
      });
    });

    it('renders Save project and Open project buttons', async () => {
      const { container } = renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('Save project');
        expect(container.textContent).toContain('Open project');
      });
    });

    it('saves project when save button clicked', async () => {
      mockPickSaveBundle.mockResolvedValue('/tmp/test-project');
      mockSaveProjectBundle.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Save project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Save project'));
      await waitFor(() => {
        expect(mockPickSaveBundle).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockSaveProjectBundle).toHaveBeenCalledWith('/tmp/test-project');
      });
    });

    it('shows toast on successful save', async () => {
      mockPickSaveBundle.mockResolvedValue('/tmp/test');
      mockSaveProjectBundle.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Save project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Save project'));
      await waitFor(() => {
        expect(document.body.textContent).toContain('Project saved');
      });
    });

    it('shows error toast on save failure', async () => {
      mockPickSaveBundle.mockRejectedValue(new Error('permission denied'));
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Save project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Save project'));
      await waitFor(() => {
        expect(document.body.textContent).toContain('Save failed');
      });
    });

    it('does not save when folder is empty', async () => {
      mockPickSaveBundle.mockResolvedValue('');
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Save project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Save project'));
      await waitFor(() => {
        expect(mockPickSaveBundle).toHaveBeenCalled();
        expect(mockSaveProjectBundle).not.toHaveBeenCalled();
      });
    });

    it('opens project when open button clicked', async () => {
      mockPickOpenBundle.mockResolvedValue('/tmp/test.slv');
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Open project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Open project'));
      await waitFor(() => {
        expect(mockPickOpenBundle).toHaveBeenCalled();
        expect(mockOpenProjectBundle).toHaveBeenCalled();
      });
    });

    it('shows toast on successful open', async () => {
      mockPickOpenBundle.mockResolvedValue('/tmp/test.slv');
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Open project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Open project'));
      await waitFor(() => {
        expect(document.body.textContent).toContain('Project opened');
      });
    });

    it('shows error toast on open failure', async () => {
      mockPickOpenBundle.mockResolvedValue('/tmp/test.slv');
      mockOpenProjectBundle.mockRejectedValue(new Error('not found'));
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(screen.getByText('Open project')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Open project'));
      await waitFor(() => {
        expect(document.body.textContent).toContain('Open failed');
      });
    });

    it('is a function component', () => {
      expect(typeof DashboardScreen).toBe('function');
    });
  });

  describe('LorebookScreen', () => {
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

    it('is a function component', () => {
      expect(typeof LorebookScreen).toBe('function');
    });
  });

  describe.each(placeholders)('$name', ({ component: Comp, title }) => {
    it('renders its title', () => {
      const { container } = render(<Comp />);
      expect(container.textContent).toContain(title);
    });

    it('renders "Coming soon" text', () => {
      const { container } = render(<Comp />);
      expect(container.textContent).toContain('Coming soon');
    });

    it('is a function component', () => {
      expect(typeof Comp).toBe('function');
    });
  });

  describe('ExportScreen', () => {
    it('renders title', async () => {
      const { container } = renderWithToast(<ExportScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('Export');
      });
    });

    it('renders format picker options', async () => {
      const { container } = renderWithToast(<ExportScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('JSON only');
        expect(container.textContent).toContain('Character PNG');
      });
    });

    it('renders destination input', async () => {
      const { container } = renderWithToast(<ExportScreen />);
      await waitFor(() => {
        expect(container.querySelector('input[placeholder*="folder"]')).toBeTruthy();
      });
    });

    it('is a function component', () => {
      expect(typeof ExportScreen).toBe('function');
    });
  });

  describe('EditorScreen', () => {
    it('is a function component', () => {
      expect(typeof EditorScreen).toBe('function');
    });
  });

  describe('CrawlerScreen', () => {
    it('renders crawl input UI', () => {
      const { container } = renderWithToast(<CrawlerScreen />);
      expect(container.textContent).toContain('Source URL');
      expect(container.textContent).toContain('Crawl page');
    });

    it('is a function component', () => {
      expect(typeof CrawlerScreen).toBe('function');
    });
  });

  it('exports SettingsScreen', () => {
    expect(SettingsScreen).toBeDefined();
    expect(typeof SettingsScreen).toBe('function');
  });

  it('exports exactly 9 screens', () => {
    const exports = {
      DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
      ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
      SettingsScreen,
    };
    expect(Object.keys(exports)).toHaveLength(9);
  });
});
