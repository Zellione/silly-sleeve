import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACCENTS,
  DEFAULT_ACCENT_ID,
  getStoredAccentId,
  applyAccent,
  initAccent,
  accentCss,
} from './accent';

describe('accent', () => {
  beforeEach(() => {
    localStorage.clear();
    const s = document.documentElement.style;
    s.removeProperty('--acc-l');
    s.removeProperty('--acc-c');
    s.removeProperty('--acc-h');
  });

  it('defaults to slate when nothing is stored', () => {
    expect(getStoredAccentId()).toBe(DEFAULT_ACCENT_ID);
  });

  it('falls back to default for an unknown stored value', () => {
    localStorage.setItem('ss-accent', 'chartreuse');
    expect(getStoredAccentId()).toBe(DEFAULT_ACCENT_ID);
  });

  it('returns a valid stored accent id', () => {
    localStorage.setItem('ss-accent', 'violet');
    expect(getStoredAccentId()).toBe('violet');
  });

  it('applies an accent as three oklch props and persists it', () => {
    applyAccent('violet');
    const violet = ACCENTS.find(a => a.id === 'violet')!;
    const s = document.documentElement.style;
    expect(s.getPropertyValue('--acc-l')).toBe(String(violet.l));
    expect(s.getPropertyValue('--acc-c')).toBe(String(violet.c));
    expect(s.getPropertyValue('--acc-h')).toBe(String(violet.h));
    expect(localStorage.getItem('ss-accent')).toBe('violet');
  });

  it('falls back to the default accent for an unknown id', () => {
    applyAccent('nope');
    const def = ACCENTS.find(a => a.id === DEFAULT_ACCENT_ID)!;
    expect(document.documentElement.style.getPropertyValue('--acc-h')).toBe(String(def.h));
    expect(localStorage.getItem('ss-accent')).toBe(DEFAULT_ACCENT_ID);
  });

  it('re-applies the persisted accent on init', () => {
    localStorage.setItem('ss-accent', 'green');
    initAccent();
    const green = ACCENTS.find(a => a.id === 'green')!;
    expect(document.documentElement.style.getPropertyValue('--acc-h')).toBe(String(green.h));
  });

  it('builds an oklch css string for a preset', () => {
    expect(accentCss({ id: 'x', label: 'X', l: 0.66, c: 0.18, h: 38 })).toBe('oklch(0.66 0.18 38)');
  });
});
