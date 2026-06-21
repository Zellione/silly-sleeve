import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_STEP_BADGES,
  getStoredStepBadges,
  applyStepBadges,
  initStepBadges,
} from './stepBadges';

describe('stepBadges', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-step-badges');
  });

  it('defaults to on when nothing is stored', () => {
    expect(getStoredStepBadges()).toBe(DEFAULT_STEP_BADGES);
    expect(getStoredStepBadges()).toBe(true);
  });

  it('reads a stored "off" value', () => {
    localStorage.setItem('ss-step-badges', '0');
    expect(getStoredStepBadges()).toBe(false);
  });

  it('reads a stored "on" value', () => {
    localStorage.setItem('ss-step-badges', '1');
    expect(getStoredStepBadges()).toBe(true);
  });

  it('defaults to on for an invalid stored value', () => {
    localStorage.setItem('ss-step-badges', 'maybe');
    expect(getStoredStepBadges()).toBe(true);
  });

  it('applies off as a data attribute and persists it', () => {
    applyStepBadges(false);
    expect(document.documentElement.getAttribute('data-step-badges')).toBe('0');
    expect(localStorage.getItem('ss-step-badges')).toBe('0');
  });

  it('applies on as a data attribute and persists it', () => {
    applyStepBadges(true);
    expect(document.documentElement.getAttribute('data-step-badges')).toBe('1');
    expect(localStorage.getItem('ss-step-badges')).toBe('1');
  });

  it('re-applies the persisted value on init', () => {
    localStorage.setItem('ss-step-badges', '0');
    initStepBadges();
    expect(document.documentElement.getAttribute('data-step-badges')).toBe('0');
  });
});
