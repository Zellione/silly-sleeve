import React, { useState } from 'react';
import { loreextract, compose, lorebook } from '../../../wailsjs/go/models';
import { TagsInput } from '../TagsInput';
import { Dropdown } from '../Dropdown';
import { CharacterScopeChips } from './CharacterScopeChips';
import { DownIcon, BoltIcon } from '../../icons';

/** Categories must match internal/lorebook/category.go. */
const CATEGORIES = [
  { value: 'character', label: 'Character' },
  { value: 'location', label: 'Location' },
  { value: 'organization', label: 'Organization' },
  { value: 'item', label: 'Item' },
  { value: 'rule', label: 'Rule' },
  { value: 'event', label: 'Event' },
  { value: 'concept', label: 'Concept' },
];

const estimateTokens = (s: string) => Math.round((s || '').length / 4);

/**
 * One reviewable candidate: a checkbox to keep it, and editors for everything
 * the user is likely to want to change before it becomes an entry.
 *
 * Edits stay local until the whole batch is approved — the backend takes the
 * edited candidates back at approval time rather than reading its own copy.
 */
export const CandidateRow: React.FC<{
  candidate: loreextract.Candidate;
  characters: compose.Character[];
  index: number;
  onChange: (next: loreextract.Candidate) => void;
}> = ({ candidate, characters, index, onChange }) => {
  const [open, setOpen] = useState(false);
  const entry = candidate.entry;

  const setEntry = <K extends keyof lorebook.Entry>(k: K, v: lorebook.Entry[K]) =>
    onChange({ ...candidate, entry: { ...entry, [k]: v } } as loreextract.Candidate);

  const keys = entry.key || [];
  const hasKeys = keys.length > 0;

  return (
    <div className="lore-cand" data-on={candidate.selected ? '1' : '0'}>
      <div className="lore-cand-head">
        <input
          type="checkbox"
          checked={candidate.selected}
          aria-label={`Keep ${entry.comment || 'untitled entry'}`}
          onChange={e => onChange({ ...candidate, selected: e.target.checked } as loreextract.Candidate)}
        />

        <button
          type="button"
          className="lore-cand-toggle"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          <DownIcon size={12} style={{ transform: open ? undefined : 'rotate(-90deg)' }} />
        </button>

        <div className="lore-cand-summary">
          <b>{entry.comment || 'Untitled'}</b>
          <div className="keys">
            {keys.slice(0, 4).map(k => <span key={k} className="k">{k}</span>)}
            {keys.length > 4 && <span className="ko">+{keys.length - 4}</span>}
            {!hasKeys && <span className="ko warn">no keys — cannot trigger</span>}
          </div>
        </div>

        <div className="lore-cand-meta">
          <span className="cat">{entry.category || 'concept'}</span>
          <span className="ord">{entry.order || 100}</span>
        </div>
      </div>

      {(candidate.adjustments?.length ?? 0) > 0 && (
        <ul className="lore-adjust" aria-label={`Adjustments to ${entry.comment || 'untitled entry'}`}>
          {candidate.adjustments.map(a => (
            <li key={a}><BoltIcon size={11} /> {a}</li>
          ))}
        </ul>
      )}

      {open && (
        <div className="lore-cand-body">
          <label className="lore-field">
            <span>Title</span>
            <input
              className="field"
              value={entry.comment || ''}
              aria-label={`Title for candidate ${index + 1}`}
              onChange={e => setEntry('comment', e.target.value)}
            />
          </label>

          {/* Dropdown and TagsInput are composites, not native controls, so a
              <label> could never be associated with one. Each carries its own
              aria-label instead. */}
          <div className="lore-field">
            <span>Category<small>Sets where the entry is inserted and whether it cascades.</small></span>
            <Dropdown
              value={entry.category || 'concept'}
              options={CATEGORIES}
              onChange={v => setEntry('category', v)}
              aria-label={`Category for candidate ${index + 1}`}
            />
          </div>

          <div className="lore-field">
            <span>Trigger keys<small>What a chat has to mention for this entry to fire.</small></span>
            <TagsInput
              value={keys}
              onChange={v => setEntry('key', v)}
              placeholder="Type and press Enter…"
              placeholderWhenFilled="Add another…"
              className="lb-keys"
              emptyClassName="empty"
              tagClassName="lb-key"
              accentClassName="primary"
              accentCount={1}
            />
          </div>

          <label className="lore-field">
            <span>
              Content
              <small>~{estimateTokens(entry.content)} tokens</small>
            </span>
            <textarea
              className="field"
              rows={5}
              value={entry.content || ''}
              aria-label={`Content for candidate ${index + 1}`}
              onChange={e => setEntry('content', e.target.value)}
            />
          </label>

          <div className="lore-field">
            <span>Applies to<small>No selection = global (all characters).</small></span>
            <CharacterScopeChips
              characters={characters}
              value={entry.characters || []}
              onChange={v => setEntry('characters', v)}
              idPrefix={`cand-${index}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
