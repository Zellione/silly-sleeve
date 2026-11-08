import { describe, it, expect, vi } from 'vitest';
import { EventsOn, EventsOff, EventsEmit } from './events';

// The test setup replaces EventSource with a controllable fake; reach it
// through the global so we can emit events at registered listeners.
interface FakeEventSource {
  url: string;
  emit(name: string, data: unknown): void;
}
const Fake = globalThis.EventSource as unknown as {
  new (url: string): FakeEventSource;
  instances: FakeEventSource[];
};

const lastSource = () => Fake.instances[Fake.instances.length - 1];

describe('EventsOn / EventsOff (SSE)', () => {
  it('EventsOff before any subscription is a safe no-op', () => {
    // The module starts with no open source; this must not throw.
    expect(() => EventsOff('comfy:progress')).not.toThrow();
  });

  it('opens a single shared /api/events source and delivers JSON payloads', () => {
    const before = Fake.instances.length;
    const a = vi.fn();
    const b = vi.fn();
    EventsOn('comfy:progress', a);
    EventsOn('comfy:progress', b);
    expect(Fake.instances.length).toBe(before + 1);
    expect(lastSource().url).toBe('/api/events');

    lastSource().emit('comfy:progress', { progress: 1, max: 2 });
    expect(a).toHaveBeenCalledWith({ progress: 1, max: 2 });
    expect(b).toHaveBeenCalledWith({ progress: 1, max: 2 });
    EventsOff('comfy:progress', a);
    EventsOff('comfy:progress', b);
  });

  it('passes non-JSON payloads through untouched', () => {
    const cb = vi.fn();
    EventsOn('plain', cb);
    lastSource().emit('plain', 'raw-text');
    expect(cb).toHaveBeenCalledWith('raw-text');
    EventsOff('plain');
  });

  it('EventsOff with a callback removes only that listener', () => {
    const keep = vi.fn();
    const drop = vi.fn();
    EventsOn('comfy:error', keep);
    EventsOn('comfy:error', drop);

    EventsOff('comfy:error', drop);
    lastSource().emit('comfy:error', { error: 'x' });
    expect(drop).not.toHaveBeenCalled();
    expect(keep).toHaveBeenCalledWith({ error: 'x' });

    EventsOff('comfy:error'); // remove the rest
    lastSource().emit('comfy:error', { error: 'y' });
    expect(keep).toHaveBeenCalledTimes(1);
  });

  it('does not deliver events of other names', () => {
    const cb = vi.fn();
    EventsOn('export:progress', cb);
    lastSource().emit('comfy:error', { error: 'nope' });
    expect(cb).not.toHaveBeenCalled();
    EventsOff('export:progress');
  });

  it('EventsEmit is a parity no-op that never throws', () => {
    expect(() => EventsEmit('anything', { payload: 1 })).not.toThrow();
  });
});
