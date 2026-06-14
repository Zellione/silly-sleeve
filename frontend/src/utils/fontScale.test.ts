import { describe, it, expect, beforeEach } from 'vitest';
import {
  FONT_SCALES,
  DEFAULT_FONT_SCALE_ID,
  getStoredFontScaleId,
  applyFontScale,
  initFontScale,
} from './fontScale';

describe('fontScale', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.zoom = '';
  });

  it('defaults to the default preset when nothing is stored', () => {
    expect(getStoredFontScaleId()).toBe(DEFAULT_FONT_SCALE_ID);
  });

  it('falls back to default for an unknown stored value', () => {
    localStorage.setItem('ss-font-scale', 'gigantic');
    expect(getStoredFontScaleId()).toBe(DEFAULT_FONT_SCALE_ID);
  });

  it('returns a valid stored preset id', () => {
    localStorage.setItem('ss-font-scale', 'large');
    expect(getStoredFontScaleId()).toBe('large');
  });

  it('applies a preset to the document root and persists it', () => {
    applyFontScale('xl');
    const xl = FONT_SCALES.find(s => s.id === 'xl')!;
    expect(document.documentElement.style.zoom).toBe(String(xl.value));
    expect(localStorage.getItem('ss-font-scale')).toBe('xl');
  });

  it('falls back to the default preset value for an unknown id', () => {
    applyFontScale('nope');
    const def = FONT_SCALES.find(s => s.id === DEFAULT_FONT_SCALE_ID)!;
    expect(document.documentElement.style.zoom).toBe(String(def.value));
    expect(localStorage.getItem('ss-font-scale')).toBe(DEFAULT_FONT_SCALE_ID);
  });

  it('re-applies the persisted preset on init', () => {
    localStorage.setItem('ss-font-scale', 'small');
    initFontScale();
    const small = FONT_SCALES.find(s => s.id === 'small')!;
    expect(document.documentElement.style.zoom).toBe(String(small.value));
  });
});
