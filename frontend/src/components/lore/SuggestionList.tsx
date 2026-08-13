import React from 'react';
import { loreextract, compose, lorebook } from '../../../wailsjs/go/models';
import { LinkIcon } from '../../icons';

const KIND_LABELS: Record<string, string> = {
  entryCharacter: 'Scope to characters',
  triggerKeys: 'Add trigger keys',
  entryEntry: 'Link entries',
  characterCharacter: 'Record a relationship',
};

const KIND_ORDER = ['triggerKeys', 'entryCharacter', 'entryEntry', 'characterCharacter'];

/**
 * Review for the whole-project connection pass.
 *
 * Every kind except a relationship rewrite is additive — approving merges keys
 * or scoping in and cannot discard anything. The relationship kind replaces
 * prose that may be hand-written, so it is the one that shows the current text
 * beside the proposal and lets the proposal be edited before it is applied.
 */
export const SuggestionList: React.FC<{
  suggestions: loreextract.Suggestion[];
  entries: lorebook.Entry[];
  characters: compose.Character[];
  onChange: (index: number, next: loreextract.Suggestion) => void;
  onApply: () => void;
  onDismiss: () => void;
}> = ({ suggestions, entries, characters, onChange, onApply, onDismiss }) => {
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
      default:
        return <b>{s.kind}</b>;
    }
  };

  const indexed = suggestions.map((s, index) => ({ s, index }));
  const groups = KIND_ORDER
    .map(kind => ({ kind, items: indexed.filter(({ s }) => s.kind === kind) }))
    .filter(g => g.items.length > 0);

  const selected = suggestions.filter(s => s.selected).length;

  return (
    <div className="lore-suggestions">
      <div className="lore-cands-head">
        <h3 className="name">Suggested connections</h3>
        <div className="meta"><b>{suggestions.length}</b> found · <b>{selected}</b> selected</div>
      </div>

      <div className="lore-sugg-list">
        {groups.map(({ kind, items }) => (
          <section key={kind} className="lore-sugg-group">
            <h4><LinkIcon size={12} /> {KIND_LABELS[kind] || kind}</h4>
            {items.map(({ s, index }) => (
              <div key={index} className="lore-sugg" data-on={s.selected ? '1' : '0'}>
                <label className="lore-sugg-head">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    aria-label={`Apply: ${KIND_LABELS[kind] || kind} for ${entryName(s.entryUid) || charName(s.charId)}`}
                    onChange={e => onChange(index, { ...s, selected: e.target.checked } as loreextract.Suggestion)}
                  />
                  <div className="lore-sugg-body">
                    <div className="what">{describe(s)}</div>
                    {s.rationale && <small className="why">{s.rationale}</small>}
                  </div>
                </label>

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
        <button type="button" className="btn ghost" onClick={onDismiss}>Dismiss all</button>
        <button type="button" className="btn primary" disabled={selected === 0} onClick={onApply}>
          {selected === 0 ? 'Nothing selected' : `Apply ${selected}`}
        </button>
      </div>
    </div>
  );
};
