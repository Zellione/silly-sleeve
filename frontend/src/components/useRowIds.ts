import { useState } from 'react';

/** One row paired with the identity React should reconcile it by. */
export type KeyedRow<T> = {
  item: T;
  key: string;
  index: number;
};

export type RowIds<T> = {
  /** The list, each row carrying a stable key and its position. */
  rows: KeyedRow<T>[];
  /** Call alongside the onChange that drops row `index`. */
  removeRow: (index: number) => void;
  /** Call alongside the onChange that appends a row. */
  addRow: () => void;
};

type IdState = { ids: string[]; next: number };

/** Grows or trims the id list to `length`, minting fresh ids for new rows. */
function resize(state: IdState, length: number): IdState {
  if (state.ids.length === length) return state;
  if (state.ids.length > length) {
    return { ids: state.ids.slice(0, length), next: state.next };
  }
  const ids = state.ids.slice();
  let next = state.next;
  while (ids.length < length) {
    ids.push(`row-${next}`);
    next += 1;
  }
  return { ids, next };
}

/**
 * Gives stable identities to list rows that carry no id of their own — stat
 * key/value pairs and free-text quotes, neither of which the character model
 * numbers.
 *
 * Keying such rows by array index means removing a row shifts every key after
 * it, so React reuses the wrong DOM nodes: the focused input jumps and its
 * selection is lost (and SonarCloud flags it as typescript:S6479). Ids here are
 * held in state and edited in lockstep with the data, so a removed row takes
 * its identity with it.
 *
 * When the list is replaced from outside — a different character is selected, a
 * reroll lands — the length stops matching and the ids are rebuilt during
 * render. That is the "adjusting state when a prop changes" pattern: React
 * re-runs the component with the new state before committing, so rows never
 * paint with a missing key.
 */
export function useRowIds<T>(items: readonly T[]): RowIds<T> {
  const [state, setState] = useState<IdState>(() => resize({ ids: [], next: 0 }, items.length));

  const synced = resize(state, items.length);
  if (synced !== state) setState(synced);

  return {
    rows: items.map((item, index) => ({ item, key: synced.ids[index], index })),
    removeRow: (index: number) =>
      setState(s => ({ ...s, ids: s.ids.filter((_, j) => j !== index) })),
    addRow: () =>
      setState(s => ({ ids: [...s.ids, `row-${s.next}`], next: s.next + 1 })),
  };
}
