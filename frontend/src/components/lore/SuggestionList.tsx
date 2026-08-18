import React from 'react';
import { loreextract, compose, lorebook } from '../../../wailsjs/go/models';
import { LinkIcon, CheckIcon, XIcon } from '../../icons';

const KIND_LABELS: Record<string, string> = {
  entryCharacter: 'Scope to characters',
  triggerKeys: 'Add trigger keys',
  entryEntry: 'Link entries',
  characterCharacter: 'Record a relationship',
  entryOrder: 'Re-tier order',
  entryPosition: 'Move position',
  entryFlags: 'Adjust behavior',
  removeKeys: 'Remove keys',
};

const KIND_ORDER = [
  'triggerKeys', 'removeKeys', 'entryCharacter', 'entryEntry',
  'entryOrder', 'entryPosition', 'entryFlags', 'characterCharacter',
];

const POSITION_NAMES = [
  'Before Char Defs', 'After Char Defs', 'Before Example Msgs',
  'After Example Msgs', '@ Depth', 'Before Author Note', 'After Author Note',
];

const LOGIC_NAMES = ['AND ANY', 'NOT ALL', 'NOT ANY', 'AND ALL'];

/** The behavior fields an entryFlags suggestion may carry, with display labels. */
const FLAG_FIELDS: { field: keyof loreextract.FlagChanges; label: string }[] = [
  { field: 'constant', label: 'constant' },
  { field: 'selective', label: 'selective' },
  { field: 'selectiveLogic', label: 'selective logic' },
  { field: 'probability', label: 'probability' },
  { field: 'useProbability', label: 'use probability' },
  { field: 'excludeRecursion', label: 'exclude recursion' },
  { field: 'preventRecursion', label: 'prevent recursion' },
];

const flagValue = (field: string, v: boolean | number | undefined): string => {
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (field === 'selectiveLogic') return LOGIC_NAMES[v ?? 0] || String(v ?? 0);
  return String(v ?? 0);
};

const Delta: React.FC<{ from: React.ReactNode; to: React.ReactNode }> = ({ from, to }) => (
  <span className="lore-delta"><s>{from}</s><span className="arr">→</span><b>{to}</b></span>
);

const positionName = (i?: number) => POSITION_NAMES[i ?? 0] || `position ${i}`;

/**
 * Review for the whole-project optimization pass.
 *
 * Every suggestion is either accepted or rejected — nothing touches the
 * project until the user confirms with Apply, which commits exactly the
 * accepted ones. Rule-change kinds render as a current → proposed delta so
 * the user sees what a change costs, not just its new value. The relationship
 * kind replaces prose that may be hand-written, so it additionally shows the
 * current text beside an editable proposal.
 */
export const SuggestionList: React.FC<{
  suggestions: loreextract.Suggestion[];
  entries: lorebook.Entry[];
  characters: compose.Character[];
  onChange: (index: number, next: loreextract.Suggestion) => void;
  onSetAll: (selected: boolean) => void;
  onApply: () => void;
  onDismiss: () => void;
}> = ({ suggestions, entries, characters, onChange, onSetAll, onApply, onDismiss }) => {
  const entryName = (uid?: number) =>
    entries.find(e => e.uid === uid)?.comment || `entry ${uid ?? '?'}`;
  const charName = (id?: number) =>
    characters.find(c => c.id === id)?.name || `character ${id ?? '?'}`;

  const describe = (s: loreextract.Suggestion) => {
    switch (s.kind) {
      case 'entryCharacter':
        // addCharacters holds character *id strings*, which is what entry
        // scoping is stored as; the roster is keyed by number.
        return <><b>{entryName(s.entryUid)}</b> → {(s.addCharacters || []).map(id => charName(Number(id))).join(', ')}</>;
      case 'triggerKeys':
        return <><b>{entryName(s.entryUid)}</b> gains {(s.addKeys || []).map(k => <span key={k} className="k">{k}</span>)}</>;
      case 'entryEntry':
        return <><b>{entryName(s.entryUid)}</b> → <b>{entryName(s.targetUid)}</b> via {(s.addSecondary || []).map(k => <span key={k} className="k">{k}</span>)}</>;
      case 'characterCharacter':
        return <><b>{charName(s.charId)}</b> ↔ <b>{charName(s.targetCharId)}</b></>;
      case 'entryOrder':
        return <><b>{entryName(s.entryUid)}</b> order <Delta from={s.currentOrder ?? 0} to={s.proposedOrder ?? 0} /></>;
      case 'entryPosition': {
        const to = s.proposedPosition === 4
          ? `${positionName(s.proposedPosition)} · depth ${s.proposedDepth ?? 0}`
          : positionName(s.proposedPosition);
        return <><b>{entryName(s.entryUid)}</b> <Delta from={positionName(s.currentPosition)} to={to} /></>;
      }
      case 'entryFlags':
        return <>
          <b>{entryName(s.entryUid)}</b>{' '}
          {FLAG_FIELDS.filter(({ field }) => s.proposedFlags?.[field] !== undefined).map(({ field, label }) => (
            <span key={field} className="lore-flag-delta">
              <span className="fname">{label}</span>{' '}
              <Delta from={flagValue(field, s.currentFlags?.[field])} to={flagValue(field, s.proposedFlags?.[field])} />
            </span>
          ))}
        </>;
      case 'removeKeys':
        return <><b>{entryName(s.entryUid)}</b> loses {(s.removeKeys || []).map(k => <s key={k} className="k">{k}</s>)}</>;
      default:
        return <b>{s.kind}</b>;
    }
  };

  const subject = (s: loreextract.Suggestion) =>
    s.kind === 'characterCharacter' ? charName(s.charId) : entryName(s.entryUid);

  const indexed = suggestions.map((s, index) => ({ s, index }));
  const groups = KIND_ORDER
    .map(kind => ({ kind, items: indexed.filter(({ s }) => s.kind === kind) }))
    .filter(g => g.items.length > 0);

  const selected = suggestions.filter(s => s.selected).length;

  return (
    <div className="lore-suggestions">
      <div className="lore-cands-head">
        <h3 className="name">Suggested improvements</h3>
        <div className="meta"><b>{suggestions.length}</b> found · <b>{selected}</b> accepted</div>
        <div className="lore-sugg-actions">
          <button type="button" className="btn ghost" onClick={() => onSetAll(true)}>
            <CheckIcon size={12} /> Accept all
          </button>
          <button type="button" className="btn ghost" onClick={() => onSetAll(false)}>
            <XIcon size={12} /> Reject all
          </button>
        </div>
      </div>

      <div className="lore-sugg-list">
        {groups.map(({ kind, items }) => (
          <section key={kind} className="lore-sugg-group">
            <h4><LinkIcon size={12} /> {KIND_LABELS[kind] || kind}</h4>
            {items.map(({ s, index }) => (
              <div key={index} className="lore-sugg" data-on={s.selected ? '1' : '0'}>
                <div className="lore-sugg-head">
                  <div className="lore-sugg-verdict">
                    <button
                      type="button" className="v-btn accept" data-on={s.selected ? '1' : '0'}
                      title="Accept" aria-label={`Accept: ${KIND_LABELS[kind] || kind} for ${subject(s)}`}
                      onClick={() => onChange(index, { ...s, selected: true } as loreextract.Suggestion)}
                    ><CheckIcon size={12} /></button>
                    <button
                      type="button" className="v-btn reject" data-on={s.selected ? '0' : '1'}
                      title="Reject" aria-label={`Reject: ${KIND_LABELS[kind] || kind} for ${subject(s)}`}
                      onClick={() => onChange(index, { ...s, selected: false } as loreextract.Suggestion)}
                    ><XIcon size={12} /></button>
                  </div>
                  <div className="lore-sugg-body">
                    <div className="what">{describe(s)}</div>
                    {s.rationale && <small className="why">{s.rationale}</small>}
                  </div>
                </div>

                {s.kind === 'characterCharacter' && (
                  <div className="lore-sugg-diff">
                    <div className="side">
                      <span className="lbl">Now</span>
                      <p>{s.currentRelationships?.trim() || <em>(nothing recorded)</em>}</p>
                    </div>
                    <div className="side">
                      <span className="lbl">Proposed<small>Replaces the text — edit it before applying.</small></span>
                      <textarea
                        className="field"
                        rows={4}
                        value={s.proposedRelationships || ''}
                        aria-label={`Proposed relationships for ${charName(s.charId)}`}
                        onChange={e => onChange(index, { ...s, proposedRelationships: e.target.value } as loreextract.Suggestion)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      <div className="lore-cands-foot">
        <button type="button" className="btn ghost" onClick={onDismiss}>Discard</button>
        <button type="button" className="btn primary" disabled={selected === 0} onClick={onApply}>
          {selected === 0 ? 'Nothing accepted' : `Apply ${selected} accepted`}
        </button>
      </div>
    </div>
  );
};
