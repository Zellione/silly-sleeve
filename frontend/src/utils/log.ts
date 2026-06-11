// logError records a failed operation to the console with a stable context
// label. Use it on otherwise-silent promise rejections (e.g. background data
// loads) so failures are diagnosable instead of vanishing.
export function logError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] ${message}`, err);
}
