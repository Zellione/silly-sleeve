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

/** Available accents, in display order. */
export const ACCENTS: AccentPreset[] = [
  { id: 'terracotta', label: 'Terracotta', l: 0.66, c: 0.18, h: 38 },
  { id: 'blue', label: 'Blue', l: 0.62, c: 0.16, h: 250 },
  { id: 'green', label: 'Green', l: 0.66, c: 0.15, h: 150 },
  { id: 'purple', label: 'Purple', l: 0.62, c: 0.18, h: 300 },
  { id: 'magenta', label: 'Magenta', l: 0.64, c: 0.2, h: 350 },
  { id: 'amber', label: 'Amber', l: 0.74, c: 0.15, h: 80 },
];

export const DEFAULT_ACCENT_ID = 'terracotta';

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
