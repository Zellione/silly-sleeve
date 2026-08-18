// logError records a failed operation to the console with a stable context
// label. Use it on otherwise-silent promise rejections (e.g. background data
// loads) so failures are diagnosable instead of vanishing.
export function logError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] ${message}`, err);
}

// logDebug records diagnostic detail to the console, but only when debug
// logging is switched on: run `localStorage.setItem('ss-debug', '1')` in the
// devtools console (and remove the key to switch it off again). Checked per
// call so the toggle works without a reload.
export function logDebug(context: string, ...data: unknown[]): void {
  if (localStorage.getItem('ss-debug') !== '1') return;
  console.debug(`[${context}]`, ...data);
}
