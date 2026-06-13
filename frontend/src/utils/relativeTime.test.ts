import { describe, it, expect } from 'vitest';
import { formatRelative } from './relativeTime';

const NOW = new Date('2026-06-13T12:00:00Z').getTime();

describe('formatRelative', () => {
  it('renders just now under a minute', () => {
    expect(formatRelative('2026-06-13T11:59:30Z', NOW)).toBe('just now');
  });
  it('renders minutes', () => {
    expect(formatRelative('2026-06-13T11:45:00Z', NOW)).toBe('15m ago');
  });
  it('renders hours', () => {
    expect(formatRelative('2026-06-13T09:00:00Z', NOW)).toBe('3h ago');
  });
  it('renders days', () => {
    expect(formatRelative('2026-06-10T12:00:00Z', NOW)).toBe('3d ago');
  });
  it('renders weeks', () => {
    expect(formatRelative('2026-05-23T12:00:00Z', NOW)).toBe('3 wks ago');
  });
  it('handles empty/invalid input', () => {
    expect(formatRelative('', NOW)).toBe('—');
    expect(formatRelative('not-a-date', NOW)).toBe('—');
  });
});
