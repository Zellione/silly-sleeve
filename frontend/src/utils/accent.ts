// Accent color presets. The app's accent is expressed through CSS custom
// properties derived from three oklch components (--acc-l/--acc-c/--acc-h) on
// the document root; selecting a preset just sets those three. The chosen
// preset is persisted to localStorage (mirroring the theme toggle) and
// re-applied on startup.

export interface AccentPreset {
  id: string;
  label: string;
  /** oklch lightness (0-1). */
  l: number;
  /** oklch chroma. */
  c: number;
  /** oklch hue (degrees). */
  h: number;
}

/** Available accents, in display order (v2 design palette). */
export const ACCENTS: AccentPreset[] = [
  { id: 'slate', label: 'Slate blue', l: 0.50, c: 0.10, h: 258 },
  { id: 'violet', label: 'Violet', l: 0.52, c: 0.12, h: 294 },
  { id: 'green', label: 'Green', l: 0.57, c: 0.10, h: 165 },
  { id: 'rust', label: 'Rust', l: 0.58, c: 0.13, h: 39 },
];

export const DEFAULT_ACCENT_ID = 'slate';

const STORAGE_KEY = 'ss-accent';

function accentById(id: string): AccentPreset {
  return ACCENTS.find(a => a.id === id)
    ?? ACCENTS.find(a => a.id === DEFAULT_ACCENT_ID)!;
}

/** CSS color string for a preset (used by the picker swatches). */
export function accentCss(a: AccentPreset): string {
  return `oklch(${a.l} ${a.c} ${a.h})`;
}

/** Returns the stored accent id, falling back to the default when unset/unknown. */
export function getStoredAccentId(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && ACCENTS.some(a => a.id === saved)) return saved;
  return DEFAULT_ACCENT_ID;
}

/** Applies the given accent to the document root and persists the choice. */
export function applyAccent(id: string): void {
  const accent = accentById(id);
  const root = document.documentElement.style;
  root.setProperty('--acc-l', String(accent.l));
  root.setProperty('--acc-c', String(accent.c));
  root.setProperty('--acc-h', String(accent.h));
  localStorage.setItem(STORAGE_KEY, accent.id);
}

/** Applies the persisted accent. Call once at startup. */
export function initAccent(): void {
  applyAccent(getStoredAccentId());
}
