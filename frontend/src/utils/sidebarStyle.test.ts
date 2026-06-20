import { describe, it, expect, beforeEach } from 'vitest';
import {
  SIDEBAR_STYLES,
  DEFAULT_SIDEBAR_STYLE,
  getStoredSidebarStyle,
  applySidebarStyle,
  initSidebarStyle,
} from './sidebarStyle';

describe('sidebarStyle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-sidebar');
  });

  it('defaults to compact when nothing is stored', () => {
    expect(getStoredSidebarStyle()).toBe(DEFAULT_SIDEBAR_STYLE);
  });

  it('falls back to default for an unknown stored value', () => {
    localStorage.setItem('ss-sidebar', 'floating');
    expect(getStoredSidebarStyle()).toBe(DEFAULT_SIDEBAR_STYLE);
  });

  it('returns a valid stored style id', () => {
    localStorage.setItem('ss-sidebar', 'rail');
    expect(getStoredSidebarStyle()).toBe('rail');
  });

  it('applies a style as a data attribute and persists it', () => {
    applySidebarStyle('wide');
    expect(document.documentElement.getAttribute('data-sidebar')).toBe('wide');
    expect(localStorage.getItem('ss-sidebar')).toBe('wide');
  });

  it('falls back to the default for an unknown id', () => {
    applySidebarStyle('nope');
    expect(document.documentElement.getAttribute('data-sidebar')).toBe(DEFAULT_SIDEBAR_STYLE);
    expect(localStorage.getItem('ss-sidebar')).toBe(DEFAULT_SIDEBAR_STYLE);
  });

  it('re-applies the persisted style on init', () => {
    localStorage.setItem('ss-sidebar', 'rail');
    initSidebarStyle();
    expect(document.documentElement.getAttribute('data-sidebar')).toBe('rail');
  });

  it('exposes three styles in order', () => {
    expect(SIDEBAR_STYLES.map(s => s.id)).toEqual(['rail', 'compact', 'wide']);
  });
});
