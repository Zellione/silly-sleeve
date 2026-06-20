// Step badges visibility. Applied as a `data-step-badges` attribute ('1'/'0')
// on the document root; CSS hides the sidebar number badges (.ss-nav-num) and
// the page-head step pill (.step-pill) when off. Persisted to localStorage and
// re-applied on startup, mirroring the theme toggle.

export const DEFAULT_STEP_BADGES = true;

const STORAGE_KEY = 'ss-step-badges';

/** Returns the stored visibility, defaulting to on when unset/invalid. */
export function getStoredStepBadges(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === '1') return true;
  if (saved === '0') return false;
  return DEFAULT_STEP_BADGES;
}

/** Applies the given visibility to the document root and persists the choice. */
export function applyStepBadges(on: boolean): void {
  document.documentElement.setAttribute('data-step-badges', on ? '1' : '0');
  localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
}

/** Applies the persisted visibility. Call once at startup. */
export function initStepBadges(): void {
  applyStepBadges(getStoredStepBadges());
}
