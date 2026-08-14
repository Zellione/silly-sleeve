import { describe, it, expect } from 'vitest';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('returns a plain-string rejection as-is (how Wails surfaces Go errors)', () => {
    expect(errorMessage('llm complete: HTTP 500', 'fallback')).toBe('llm complete: HTTP 500');
  });

  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('connection refused'), 'fallback')).toBe('connection refused');
  });

  it('falls back for an empty string', () => {
    expect(errorMessage('', 'fallback')).toBe('fallback');
  });

  it('falls back for a whitespace-only string', () => {
    expect(errorMessage('   ', 'fallback')).toBe('fallback');
  });

  it('falls back for undefined and null', () => {
    expect(errorMessage(undefined, 'fallback')).toBe('fallback');
    expect(errorMessage(null, 'fallback')).toBe('fallback');
  });

  it('falls back for an Error with an empty message', () => {
    expect(errorMessage(new Error(''), 'fallback')).toBe('fallback');
  });

  it('falls back for objects without a usable message', () => {
    expect(errorMessage({ code: 500 }, 'fallback')).toBe('fallback');
    expect(errorMessage({ message: 42 }, 'fallback')).toBe('fallback');
  });
});
