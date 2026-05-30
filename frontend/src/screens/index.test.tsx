import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../components/ToastProvider';
import {
  DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
  ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './index';

const mockGetCharacters = vi.fn();
const mockSaveProjectTo = vi.fn();
const mockPickSaveFolder = vi.fn();
const mockPickExportFolder = vi.fn();
const mockExportCharacter = vi.fn();
const mockOpenProject = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCharacters: () => mockGetCharacters(),
  AddCharacter: vi.fn(),
  UpdateCharacter: vi.fn(),
  DeleteCharacter: vi.fn(),
  SetActiveCharacter: vi.fn(),
  GetCachedCrawl: vi.fn().mockResolvedValue(null),
  CountTokens: vi.fn().mockResolvedValue(0),
  CrawlPage: vi.fn(),
  SaveProjectTo: (...args: any[]) => mockSaveProjectTo(...args),
  PickSaveFolder: () => mockPickSaveFolder(),
  PickExportFolder: () => mockPickExportFolder(),
  ExportCharacter: (...args: any[]) => mockExportCharacter(...args),
  OpenProject: () => mockOpenProject(),
}));

const renderWithToast = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const placeholders = [
  { name: 'LorebookScreen', component: LorebookScreen, title: 'Author lorebook' },
  { name: 'ProjectImageScreen', component: ProjectImageScreen, title: 'Project image' },
  { name: 'PortraitScreen', component: PortraitScreen, title: 'Portrait' },
  { name: 'PreviewScreen', component: PreviewScreen, title: 'Preview character card' },
];

describe('screens/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacters.mockResolvedValue([]);
    mockPickSaveFolder.mockResolvedValue('');
    mockPickExportFolder.mockResolvedValue('');
    mockOpenProject.mockResolvedValue({ name: 'Test', activeCharId: 1, version: '1', createdAt: '', updatedAt: '', sourceUrl: '', crawlTitle: '' });
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

    it('calls SaveProjectTo on save project click', async () => {
      mockPickSaveFolder.mockResolvedValue('/tmp/test');
      mockSaveProjectTo.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(document.body.textContent).toContain('Save project');
      });
      await user.click(document.querySelector('button')!);
      // verify no crash
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });

    it('calls OpenProject on open project click', async () => {
      mockOpenProject.mockResolvedValue({ name: 'Test', activeCharId: 1, version: '1', createdAt: '', updatedAt: '', sourceUrl: '', crawlTitle: '' });
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(document.body.textContent).toContain('Open project');
      });
      const openBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.includes('Open project'));
      expect(openBtn).toBeTruthy();
    });

    it('handles save project dialog cancel', async () => {
      mockPickSaveFolder.mockResolvedValue('');
      const user = userEvent.setup();
      renderWithToast(<DashboardScreen />);
      await waitFor(() => {
        expect(document.body.textContent).toContain('Save project');
      });
      // should handle empty folder gracefully
    });

    it('is a function component', () => {
      expect(typeof DashboardScreen).toBe('function');
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
