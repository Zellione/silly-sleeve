import { describe, expect, it } from 'vitest';
import { SLOTS, resolveEndpoint } from './fieldEndpoints';
import type { settings } from '../../wailsjs/go/models';

const eps = [
  { id: 1, name: 'Default', isDefault: true },
  { id: 2, name: 'Global' },
  { id: 3, name: 'Project' },
] as unknown as settings.LLMEndpoint[];

describe('SLOTS', () => {
  it('starts with bulk and includes all 10 fields', () => {
    expect(SLOTS[0].id).toBe('bulk');
    expect(SLOTS).toHaveLength(11);
  });
});

describe('resolveEndpoint', () => {
  it('prefers the project override', () => {
    const r = resolveEndpoint('backstory', eps, { backstory: 2 }, { backstory: 3 });
    expect(r.endpoint?.id).toBe(3);
    expect(r.source).toBe('project');
  });

  it('falls back to the global default', () => {
    const r = resolveEndpoint('backstory', eps, { backstory: 2 }, {});
    expect(r.endpoint?.id).toBe(2);
    expect(r.source).toBe('global');
  });

  it('falls back to the default endpoint', () => {
    const r = resolveEndpoint('backstory', eps, {}, {});
    expect(r.endpoint?.id).toBe(1);
    expect(r.source).toBe('default');
  });

  it('treats a dangling id as unset', () => {
    const r = resolveEndpoint('tags', eps, { tags: 99 }, { tags: 77 });
    expect(r.endpoint?.id).toBe(1);
    expect(r.source).toBe('default');
  });
});
