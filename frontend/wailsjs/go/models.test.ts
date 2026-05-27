import { describe, it, expect, vi } from 'vitest';
import { settings, llm } from './models';

describe('llm.TestResult', () => {
  it('creates from object', () => {
    const tr = new llm.TestResult({ ok: true, latency_ms: 42, error: 'err' });
    expect(tr.ok).toBe(true);
    expect(tr.latency_ms).toBe(42);
    expect(tr.error).toBe('err');
  });

  it('creates from JSON string', () => {
    const tr = new llm.TestResult(JSON.stringify({ ok: false, latency_ms: 10 }));
    expect(tr.ok).toBe(false);
    expect(tr.latency_ms).toBe(10);
    expect(tr.error).toBeUndefined();
  });

  it('createFrom returns a TestResult', () => {
    const tr = llm.TestResult.createFrom({ ok: true, latency_ms: 5 });
    expect(tr).toBeInstanceOf(llm.TestResult);
    expect(tr.ok).toBe(true);
  });

  it('handles empty object', () => {
    const tr = new llm.TestResult();
    expect(tr.ok).toBeUndefined();
    expect(tr.latency_ms).toBeUndefined();
  });
});

describe('settings.LLMEndpoint', () => {
  it('creates from object with all fields', () => {
    const ep = new settings.LLMEndpoint({
      id: 1, name: 'Test', url: 'https://test.com/v1', model: 'gpt',
      key: 'sk-abc', isDefault: true, contextSize: 4096, temperature: 0.7,
      systemPrompt: 'Hello', ok: true,
    });
    expect(ep.id).toBe(1);
    expect(ep.name).toBe('Test');
    expect(ep.url).toBe('https://test.com/v1');
    expect(ep.model).toBe('gpt');
    expect(ep.key).toBe('sk-abc');
    expect(ep.isDefault).toBe(true);
    expect(ep.contextSize).toBe(4096);
    expect(ep.temperature).toBe(0.7);
    expect(ep.systemPrompt).toBe('Hello');
    expect(ep.ok).toBe(true);
  });

  it('creates from JSON string', () => {
    const ep = new settings.LLMEndpoint(JSON.stringify({ id: 2, name: 'JSON' }));
    expect(ep.id).toBe(2);
    expect(ep.name).toBe('JSON');
  });

  it('createFrom returns an LLMEndpoint', () => {
    const ep = settings.LLMEndpoint.createFrom({ id: 3 });
    expect(ep).toBeInstanceOf(settings.LLMEndpoint);
    expect(ep.id).toBe(3);
  });

  it('handles undefined key', () => {
    const ep = new settings.LLMEndpoint({ id: 1, key: undefined });
    expect(ep.key).toBeUndefined();
  });

  it('handles missing fields', () => {
    const ep = new settings.LLMEndpoint({});
    expect(ep.id).toBeUndefined();
    expect(ep.name).toBeUndefined();
  });
});

describe('settings.Settings', () => {
  it('creates from object with endpoints array', () => {
    const s = new settings.Settings({
      endpoints: [
        { id: 1, name: 'Ep1' },
        { id: 2, name: 'Ep2' },
      ],
    });
    expect(s.endpoints).toHaveLength(2);
    expect(s.endpoints[0]).toBeInstanceOf(settings.LLMEndpoint);
    expect(s.endpoints[0].name).toBe('Ep1');
    expect(s.endpoints[1].name).toBe('Ep2');
  });

  it('creates from JSON string', () => {
    const s = new settings.Settings(JSON.stringify({ endpoints: [{ id: 5, name: 'StrEp' }] }));
    expect(s.endpoints).toHaveLength(1);
    expect(s.endpoints[0].name).toBe('StrEp');
  });

  it('createFrom returns a Settings', () => {
    const s = settings.Settings.createFrom({ endpoints: [] });
    expect(s).toBeInstanceOf(settings.Settings);
    expect(s.endpoints).toEqual([]);
  });

  it('handles null endpoints', () => {
    const s = new settings.Settings({});
    expect(s.endpoints).toBeUndefined();
  });

  it('handles undefined endpoints via createFrom', () => {
    const s = settings.Settings.createFrom({});
    expect(s.endpoints).toBeUndefined();
  });
});

describe('settings.Settings.convertValues', () => {
  it('converts array of values', () => {
    const s = new settings.Settings({
      endpoints: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    });
    expect(s.endpoints[0]).toBeInstanceOf(settings.LLMEndpoint);
    expect(s.endpoints[1]).toBeInstanceOf(settings.LLMEndpoint);
  });

  it('converts with asMap = true', () => {
    const s = new settings.Settings();
    const input = { a: { id: 1 }, b: { id: 2 } };
    const result = s.convertValues(input, settings.LLMEndpoint, true);
    expect(result.a).toBeInstanceOf(settings.LLMEndpoint);
    expect(result.b).toBeInstanceOf(settings.LLMEndpoint);
  });

  it('returns null/undefined as-is', () => {
    const s = new settings.Settings();
    expect(s.convertValues(null, settings.LLMEndpoint)).toBeNull();
    expect(s.convertValues(undefined, settings.LLMEndpoint)).toBeUndefined();
  });
});
