import React from 'react';
import { loreextract, compose } from '../../../wailsjs/go/models';
import { CandidateRow } from './CandidateRow';
import { SparksIcon, BoltIcon } from '../../icons';

/**
 * Approving is destructive to whatever is left unticked, so the button says
 * both numbers rather than only the happy one.
 */
function approveLabel(keeping: number, dropping: number): string {
  if (keeping === 0) return 'Nothing selected';
  const discard = dropping > 0 ? ` · discard ${dropping}` : '';
  return `Add ${keeping} to lorebook${discard}`;
}

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
  /** Why the last extraction of this page failed; shown in place of the
   * loading state so the reason outlives the transient failure toast. */
  error?: string;
  onChange: (index: number, next: loreextract.Candidate) => void;
  onApprove: () => void;
  onDiscard: () => void;
}> = ({ candidates, characters, sourceUrl, extracting, error, onChange, onApprove, onDiscard }) => {
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

  if (error && forSource.length === 0) {
    return (
      <div className="lore-cands">
        <div className="lore-empty">
          <BoltIcon size={30} style={{ opacity: 0.5, color: 'var(--bad, #d66)' }} />
          <p>Extraction failed.</p>
          <p className="helpr">{error}</p>
          <p className="helpr">Check the endpoint and prompt, then extract again.</p>
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
        <button type="button" className="btn ghost" onClick={onDiscard}>Discard all</button>
        <button type="button" className="btn primary" disabled={keeping === 0} onClick={onApprove}>
          {approveLabel(keeping, dropping)}
        </button>
      </div>
    </div>
  );
};
