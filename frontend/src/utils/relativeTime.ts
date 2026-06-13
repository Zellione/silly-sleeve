/**
 * Render an ISO timestamp as a compact relative label ("2h ago", "3 wks ago").
 * `now` is injectable for deterministic tests; defaults to Date.now().
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 60) return 'just now';

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} wk${weeks === 1 ? '' : 's'} ago`;
}
