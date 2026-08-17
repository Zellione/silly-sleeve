import type { Route } from './Layout';

export interface TabItem {
  id: Route;
  label: string;
}

/** Workflow tabs shown in the v2 top bar, in order. */
export const TABS: TabItem[] = [
  { id: 'crawler', label: 'Crawl' },
  { id: 'editor', label: 'Compose' },
  { id: 'lorebook', label: 'Lorebook' },
  { id: 'projectImage', label: 'Project image' },
  { id: 'image', label: 'Portrait' },
  { id: 'preview', label: 'Preview' },
  { id: 'export', label: 'Export' },
];
