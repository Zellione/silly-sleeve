import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
  ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './index';

const placeholders = [
  { name: 'DashboardScreen', component: DashboardScreen, title: 'Your projects' },
  { name: 'CrawlerScreen', component: CrawlerScreen, title: 'Crawl a wiki page' },
  { name: 'EditorScreen', component: EditorScreen, title: 'Compose character' },
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
