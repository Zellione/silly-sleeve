/**
 * Extracts a human-readable message from a rejected promise's reason.
 *
 * Wails bindings reject with the Go error as a bare string, while ordinary
 * JS failures reject with an Error — `e?.message` alone silently drops the
 * former, which is how backend errors ended up hidden behind generic toasts.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'string' && e.trim() !== '') return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string' && m.trim() !== '') return m;
  }
  return fallback;
}
