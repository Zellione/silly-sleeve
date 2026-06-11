import { describe, it, expect, vi, afterEach } from 'vitest';
import { logError } from './log';

afterEach(() => vi.restoreAllMocks());

describe('logError', () => {
  it('logs an Error with its message and a context label', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    logError('LoadThing', err);
    expect(spy).toHaveBeenCalledWith('[LoadThing] boom', err);
  });

  it('stringifies non-Error values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('LoadThing', 'plain string');
    expect(spy).toHaveBeenCalledWith('[LoadThing] plain string', 'plain string');
  });
});
