import React from 'react';
import { loreextract, compose } from '../../../wailsjs/go/models';
import { CandidateRow } from './CandidateRow';
import { SparksIcon } from '../../icons';

/**
 * The candidate review column: everything extracted from the selected page,
 * each editable and individually keepable, with one action to approve the
 * ticked ones.
 *
 * Approving is destructive to the rest by design — an unticked candidate was
 * rejected, not deferred — so the button says how many of each.
 */
export const CandidateList: React.FC<{
  candidates: loreextract.Candidate[];
  characters: compose.Character[];
  sourceUrl: string | null;
  extracting: boolean;
  onChange: (index: number, next: loreextract.Candidate) => void;
  onApprove: () => void;
  onDiscard: () => void;
}> = ({ candidates, characters, sourceUrl, extracting, onChange, onApprove, onDiscard }) => {
  const forSource = candidates
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => c.sourceUrl === sourceUrl);

  if (extracting) {
    return (
      <div className="lore-cands">
        <div className="lore-empty">
          <div className="shimmer" style={{ width: 200, height: 16 }} />
          <p className="helpr">Pulling the facts out of this page…</p>
        </div>
      </div>
    );
  }

  if (forSource.length === 0) {
    return (
      <div className="lore-cands">
        <div className="lore-empty">
          <SparksIcon size={30} style={{ opacity: 0.4 }} />
          <p>Nothing to review yet.</p>
          <p className="helpr">
            {sourceUrl
              ? 'Extract this page to see the facts it contains, then keep the ones worth having.'
              : 'Pick a staged page on the left.'}
          </p>
        </div>
      </div>
    );
  }

  const keeping = forSource.filter(({ c }) => c.selected).length;
  const dropping = forSource.length - keeping;

  return (
    <div className="lore-cands">
      <div className="lore-cands-head">
        <h3 className="name">Extracted facts</h3>
        <div className="meta">
          <b>{forSource.length}</b> found · <b>{keeping}</b> kept
        </div>
      </div>

      <div className="lore-cand-list">
        {forSource.map(({ c, index }) => (
          <CandidateRow
            key={`${c.sourceUrl}-${index}`}
            candidate={c}
            characters={characters}
            index={index}
            onChange={next => onChange(index, next)}
          />
        ))}
      </div>

      <div className="lore-cands-foot">
        <button className="btn ghost" onClick={onDiscard}>Discard all</button>
        <button className="btn primary" disabled={keeping === 0} onClick={onApprove}>
          {keeping === 0
            ? 'Nothing selected'
            : `Add ${keeping} to lorebook${dropping > 0 ? ` · discard ${dropping}` : ''}`}
        </button>
      </div>
    </div>
  );
};
