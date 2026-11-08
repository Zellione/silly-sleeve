/**
 * Backend→UI event subscriptions over SSE.
 *
 * Mirrors the old Wails runtime events API (EventsOn/EventsOff) so existing
 * call sites keep their shape: the callback receives the event payload
 * directly. A single shared EventSource is opened lazily on first
 * subscription; listeners registered on it survive the browser's automatic
 * reconnection.
 */

type Listener = (payload: unknown) => void;

interface Registration {
  name: string;
  raw: EventListener;
  cb: Listener;
}

let source: EventSource | null = null;
const registrations = new Set<Registration>();

function ensureSource(): EventSource {
  if (!source) {
    source = new EventSource('/api/events');
  }
  return source;
}

/** Subscribe to a backend event named `name`. The callback receives the
 * decoded event payload, typed by `T` (inferred from the callback argument).
 */
export function EventsOn<T = unknown>(name: string, callback: (payload: T) => void): void {
  const es = ensureSource();
  const raw: EventListener = (e: Event) => {
    const data = (e as MessageEvent).data;
    try {
      callback(JSON.parse(data) as T);
    } catch {
      callback(data as T);
    }
  };
  es.addEventListener(name, raw);
  registrations.add({ name, raw, cb: callback as Listener });
}

/** Detach from a backend event. With a callback, removes only that
 * listener; without one, removes every listener for the event (Wails
 * parity). */
export function EventsOff(name: string, callback?: Listener): void {
  if (!source) return;
  for (const reg of [...registrations]) {
    if (reg.name !== name) continue;
    if (callback !== undefined && reg.cb !== callback) continue;
    source.removeEventListener(name, reg.raw);
    registrations.delete(reg);
  }
}

/** Wails runtime parity no-op: the frontend never emits backend events. */
export function EventsEmit(_name: string, _payload?: unknown): void {
  /* the server is the only event source */
}
