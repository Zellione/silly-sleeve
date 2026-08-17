import type { Route } from './Layout';

export interface TabItem {
  id: Route;
  label: string;
}

/** Workflow tabs shown in the v2 top bar, in order. */
export const TABS: TabItem[] = [
  { id: 'crawler', label: 'Crawl' },
  { id: 'characters', label: 'Characters' },
  { id: 'lorebook', label: 'Lorebook' },
  { id: 'images', label: 'Images' },
  { id: 'preview', label: 'Preview' },
  { id: 'export', label: 'Export' },
];
