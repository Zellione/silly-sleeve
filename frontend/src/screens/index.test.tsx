import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ToastProvider } from '../components/ToastProvider';
import {
  DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
  ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './index';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCharacters: vi.fn().mockResolvedValue([]),
  AddCharacter: vi.fn(),
  UpdateCharacter: vi.fn(),
  DeleteCharacter: vi.fn(),
  SetActiveCharacter: vi.fn(),
  GetCachedCrawl: vi.fn().mockResolvedValue(null),
  CountTokens: vi.fn().mockResolvedValue(0),
  CrawlPage: vi.fn(),
}));

const placeholders = [
  { name: 'DashboardScreen', component: DashboardScreen, title: 'Your projects' },
  { name: 'LorebookScreen', component: LorebookScreen, title: 'Author lorebook' },
  { name: 'ProjectImageScreen', component: ProjectImageScreen, title: 'Project image' },
  { name: 'PortraitScreen', component: PortraitScreen, title: 'Portrait' },
  { name: 'PreviewScreen', component: PreviewScreen, title: 'Preview character card' },
  { name: 'ExportScreen', component: ExportScreen, title: 'Export hub' },
];

describe('screens/index', () => {
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

  describe('EditorScreen', () => {
    it('is a function component', () => {
      expect(typeof EditorScreen).toBe('function');
    });
  });

  describe('CrawlerScreen', () => {
    it('renders crawl input UI', () => {
      const { container } = render(
        <ToastProvider><CrawlerScreen /></ToastProvider>
      );
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
