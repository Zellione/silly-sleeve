import { lorebook } from '../../wailsjs/go/models';

type Entry = lorebook.Entry;

const ORDER_TOP = 1000;
const ORDER_STEP = 10;

/** Reassign `order` to every entry by its position (top=1000, step -10). */
function applyGappedOrder(entries: Entry[]): Entry[] {
  return entries.map((e, i) =>
    new lorebook.Entry({ ...e, order: ORDER_TOP - i * ORDER_STEP }),
  );
}

/**
 * Move the dragged entry (sourceUid) to the slot of targetUid within the
 * order-descending visual list, then reassign `order` with gaps. Returns a new
 * array. No-op when source === target or either uid is missing.
 */
export function reorderByDrag(entries: Entry[], sourceUid: number, targetUid: number): Entry[] {
  if (sourceUid === targetUid) return entries;
  const visual = [...entries].sort((a, b) => (b.order || 0) - (a.order || 0));
  const from = visual.findIndex(e => e.uid === sourceUid);
  const to = visual.findIndex(e => e.uid === targetUid);
  if (from === -1 || to === -1) return entries;
  const [moved] = visual.splice(from, 1);
  visual.splice(to, 0, moved);
  return applyGappedOrder(visual);
}

/** Imported entries with UIDs reassigned to start at max(existing)+1. */
export function remapForMerge(existing: Entry[], imported: Entry[]): Entry[] {
  const start = existing.reduce((m, e) => Math.max(m, e.uid || 0), -1) + 1;
  return imported.map((e, i) => new lorebook.Entry({ ...e, uid: start + i }));
}

/** Imported entries renumbered 0..n-1. */
export function renumberFromZero(imported: Entry[]): Entry[] {
  return imported.map((e, i) => new lorebook.Entry({ ...e, uid: i }));
}
