// Font (UI) scaling presets. The app uses fixed-px typography throughout
// style.css, so a single CSS `zoom` on the document root is the robust way to
// scale every screen uniformly and legibly — analogous to an editor's zoom.
// The chosen preset is persisted to localStorage (mirroring the theme toggle)
// and re-applied on startup.

export interface FontScale {
  id: string;
  label: string;
  /** Multiplier applied as `document.documentElement.style.zoom`. */
  value: number;
}

/** Available presets, in display order. */
export const FONT_SCALES: FontScale[] = [
  { id: 'small', label: 'Small', value: 0.9 },
  { id: 'default', label: 'Default', value: 1 },
  { id: 'large', label: 'Large', value: 1.1 },
  { id: 'xl', label: 'Extra Large', value: 1.25 },
];

export const DEFAULT_FONT_SCALE_ID = 'default';

const STORAGE_KEY = 'ss-font-scale';

function scaleById(id: string): FontScale {
  return FONT_SCALES.find(s => s.id === id)
    ?? FONT_SCALES.find(s => s.id === DEFAULT_FONT_SCALE_ID)!;
}

/** Returns the stored preset id, falling back to the default when unset/unknown. */
export function getStoredFontScaleId(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && FONT_SCALES.some(s => s.id === saved)) return saved;
  return DEFAULT_FONT_SCALE_ID;
}

/** Applies the given preset to the document root and persists the choice. */
export function applyFontScale(id: string): void {
  const scale = scaleById(id);
  document.documentElement.style.zoom = String(scale.value);
  localStorage.setItem(STORAGE_KEY, scale.id);
}

/** Applies the persisted preset. Call once at startup. */
export function initFontScale(): void {
  applyFontScale(getStoredFontScaleId());
}

/**
 * Returns the zoom factor currently applied to the document root (1 when
 * unset/invalid). WebKit/Blink treat a zoomed ancestor as the containing
 * block for `position: fixed` descendants — unlike the spec, where only the
 * viewport (or a transform/filter/perspective ancestor) qualifies — so any
 * code that positions a fixed element from `getBoundingClientRect()` pixels
 * (which are always true/visual screen pixels) must divide by this factor
 * before assigning `top`/`left`, or the element renders offset by the zoom.
 */
export function getCurrentZoom(): number {
  const z = Number.parseFloat(document.documentElement.style.zoom || '');
  return Number.isFinite(z) && z > 0 ? z : 1;
}
