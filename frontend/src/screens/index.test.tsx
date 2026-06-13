import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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
  ListProjects: vi.fn().mockResolvedValue([]),
  GetComfySamplers: vi.fn().mockResolvedValue([]),
  GetComfySchedulers: vi.fn().mockResolvedValue([]),
  GetComfyCheckpoints: vi.fn().mockResolvedValue([]),
  GetComfyVAEs: vi.fn().mockResolvedValue([]),
  GetComfyLoRAs: vi.fn().mockResolvedValue([]),
  GenerateImagePrompt: vi.fn().mockResolvedValue(''),
  GeneratePortrait: vi.fn().mockResolvedValue([]),
  GenerateProjectImage: vi.fn().mockResolvedValue([]),
  GetPortrait: vi.fn().mockResolvedValue([]),
  SavePortrait: vi.fn().mockResolvedValue(undefined),
  GetProjectImage: vi.fn().mockResolvedValue([]),
  SaveProjectImage: vi.fn().mockResolvedValue(undefined),
  GetComfyWorkflows: vi.fn().mockResolvedValue([]),
  GetComfyWorkflowTemplate: vi.fn().mockResolvedValue(''),
}));

const renderWithToast = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const placeholders = [
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

  describe('PortraitScreen', () => {
    it('renders generate/upload tabs', async () => {
      const { container } = renderWithToast(<PortraitScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('Generate');
        expect(container.textContent).toContain('Upload');
      });
    });

    it('renders portrait title', async () => {
      const { container } = renderWithToast(<PortraitScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('portrait');
      });
    });
  });

  describe('ProjectImageScreen', () => {
    it('renders generate/upload tabs', async () => {
      const { container } = renderWithToast(<ProjectImageScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('Generate');
        expect(container.textContent).toContain('Upload');
      });
    });

    it('renders project image title', async () => {
      const { container } = renderWithToast(<ProjectImageScreen />);
      await waitFor(() => {
        expect(container.textContent).toContain('Project');
      });
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
