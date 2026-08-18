import { describe, it, expect, vi, afterEach } from 'vitest';
import { logError, logDebug } from './log';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem('ss-debug');
});

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

describe('logDebug', () => {
  it('is silent unless the ss-debug flag is set', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logDebug('LoreStaging', 'extracting', 'https://w');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs with a context label when ss-debug is "1"', () => {
    localStorage.setItem('ss-debug', '1');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logDebug('LoreStaging', 'extracting', 'https://w');
    expect(spy).toHaveBeenCalledWith('[LoreStaging]', 'extracting', 'https://w');
  });
});
