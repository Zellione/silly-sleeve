import { describe, it, expect } from 'vitest';
import { reorderByDrag, remapForMerge, renumberFromZero } from './lorebook';
import { lorebook } from '../../wailsjs/go/models';

const mk = (uid: number, order: number, comment = ''): lorebook.Entry =>
  new lorebook.Entry({ uid, order, comment });

describe('reorderByDrag', () => {
  it('moves an entry and reassigns order with gaps (top=1000, step -10)', () => {
    const entries = [mk(0, 300, 'A'), mk(1, 200, 'B'), mk(2, 100, 'C')];
    const next = reorderByDrag(entries, 2, 0);
    const byUid = Object.fromEntries(next.map(e => [e.uid, e.order]));
    expect(byUid[2]).toBe(1000); // C now first
    expect(byUid[0]).toBe(990);  // A second
    expect(byUid[1]).toBe(980);  // B third
  });

  it('returns entries unchanged when source equals target', () => {
    const entries = [mk(0, 300), mk(1, 200)];
    const next = reorderByDrag(entries, 0, 0);
    expect(next.map(e => e.uid)).toEqual([0, 1]);
  });
});

describe('remapForMerge', () => {
  it('reassigns imported UIDs to start at maxUid+1 of existing', () => {
    const existing = [mk(0, 100), mk(5, 100)];
    const imported = [mk(0, 100, 'X'), mk(1, 100, 'Y')];
    const out = remapForMerge(existing, imported);
    expect(out.map(e => e.uid)).toEqual([6, 7]);
    expect(out.map(e => e.comment)).toEqual(['X', 'Y']);
  });

  it('starts at 0 when existing is empty', () => {
    const out = remapForMerge([], [mk(3, 100), mk(9, 100)]);
    expect(out.map(e => e.uid)).toEqual([0, 1]);
  });
});

describe('renumberFromZero', () => {
  it('renumbers UIDs sequentially from 0', () => {
    const out = renumberFromZero([mk(7, 100), mk(3, 100)]);
    expect(out.map(e => e.uid)).toEqual([0, 1]);
  });
});
