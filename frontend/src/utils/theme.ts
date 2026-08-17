// Theme (light/dark) handling. Applied as `data-theme` on the document root
// plus an explicit `color-scheme` so WebKitGTK themes native controls (e.g.
// <select> option popups) to match — a dynamically applied CSS color-scheme
// does not reliably re-theme the native popup widget. Persisted to
// localStorage and re-applied on startup, mirroring the accent handling.

/** The v2 design defaults to dark mode. */
export const DEFAULT_DARK = true;

const STORAGE_KEY = 'ss-theme';

/** Returns the stored preference, defaulting to dark when unset. */
export function getStoredDark(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved === 'dark';
  return DEFAULT_DARK;
}

/** Applies the theme to the document root and persists the choice. */
export function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
}

/** Applies the persisted theme. Call once at startup. */
export function initTheme(): void {
  applyTheme(getStoredDark());
}
