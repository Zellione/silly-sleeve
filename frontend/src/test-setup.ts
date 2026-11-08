import '@testing-library/jest-dom/vitest';

globalThis.confirm = () => true;

Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// jsdom has no EventSource; the API client's SSE subscription creates one
// lazily. Provide a controllable fake: tests can emit events on
// FakeEventSource.instances[last] to drive EventsOn listeners.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  private listeners = new Map<string, Set<EventListener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, cb: EventListener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(cb);
  }

  removeEventListener(name: string, cb: EventListener) {
    this.listeners.get(name)?.delete(cb);
  }

  close() {
    const i = FakeEventSource.instances.indexOf(this);
    if (i !== -1) FakeEventSource.instances.splice(i, 1);
  }

  emit(name: string, data: unknown) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const cb of this.listeners.get(name) ?? []) cb({ data: payload } as MessageEvent);
  }
}
FakeEventSource.instances = [];
Object.defineProperty(globalThis, 'EventSource', {
  writable: true,
  configurable: true,
  value: FakeEventSource,
});

(HTMLDialogElement.prototype as any).showModal = function () {
  this.open = true;
};
(HTMLDialogElement.prototype as any).close = function () {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
