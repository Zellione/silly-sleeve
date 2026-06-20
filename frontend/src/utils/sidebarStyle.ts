// Sidebar width tiers. Applied as a `data-sidebar` attribute on the document
// root so the styling lives entirely in CSS (.ss-side keys off it). Persisted
// to localStorage and re-applied on startup, mirroring the theme toggle.

export interface SidebarStyle {
  id: string;
  label: string;
}

/** Available sidebar styles, in display order. */
export const SIDEBAR_STYLES: SidebarStyle[] = [
  { id: 'rail', label: 'Rail' },
  { id: 'compact', label: 'Compact' },
  { id: 'wide', label: 'Wide' },
];

export const DEFAULT_SIDEBAR_STYLE = 'compact';

const STORAGE_KEY = 'ss-sidebar';

/** Returns the stored style id, falling back to the default when unset/unknown. */
export function getStoredSidebarStyle(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SIDEBAR_STYLES.some(s => s.id === saved)) return saved;
  return DEFAULT_SIDEBAR_STYLE;
}

/** Applies the given style to the document root and persists the choice. */
export function applySidebarStyle(id: string): void {
  const valid = SIDEBAR_STYLES.some(s => s.id === id) ? id : DEFAULT_SIDEBAR_STYLE;
  document.documentElement.setAttribute('data-sidebar', valid);
  localStorage.setItem(STORAGE_KEY, valid);
}

/** Applies the persisted style. Call once at startup. */
export function initSidebarStyle(): void {
  applySidebarStyle(getStoredSidebarStyle());
}
