import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredDark, applyTheme, initTheme } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to dark when nothing is stored', () => {
    expect(getStoredDark()).toBe(true);
  });

  it('returns the stored preference', () => {
    localStorage.setItem('ss-theme', 'light');
    expect(getStoredDark()).toBe(false);
    localStorage.setItem('ss-theme', 'dark');
    expect(getStoredDark()).toBe(true);
  });

  it('applies the theme to the root and persists it', () => {
    applyTheme(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('ss-theme')).toBe('light');

    applyTheme(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('ss-theme')).toBe('dark');
  });

  it('applies dark on init when nothing is stored', () => {
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('re-applies the persisted theme on init', () => {
    localStorage.setItem('ss-theme', 'light');
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
