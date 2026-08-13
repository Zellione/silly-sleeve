import React from 'react';
import { loreextract } from '../../../wailsjs/go/models';
import { Dropdown } from '../Dropdown';
import { TrashIcon, BookIcon } from '../../icons';
import type { ExtractionMode } from './useLoreStaging';

const MODE_OPTIONS = [
  { value: 'split', label: 'Split into facts' },
  { value: 'summary', label: 'Single summary' },
];

const MODE_HINTS: Record<string, string> = {
  split: 'Many small entries, one concept each.',
  summary: 'One compressed entry for the whole page.',
};

/**
 * The staged-sources column: crawled pages queued for extraction, the mode
 * each will be extracted with, and the Extract action.
 *
 * A source stays listed after its candidates are approved, marked done, so it
 * can be extracted again — with a different mode, or after the prompts change
 * — without going back to the Crawler.
 */
export const StagedSourcePanel: React.FC<{
  sources: loreextract.StagedSource[];
  candidates: loreextract.Candidate[];
  activeUrl: string | null;
  extracting: string | null;
  onSelect: (url: string) => void;
  onSetMode: (url: string, mode: ExtractionMode) => void;
  onExtract: (url: string) => void;
  onRemove: (url: string) => void;
}> = ({ sources, candidates, activeUrl, extracting, onSelect, onSetMode, onExtract, onRemove }) => {
  const pendingFor = (url: string) => candidates.filter(c => c.sourceUrl === url).length;

  if (sources.length === 0) {
    return (
      <div className="lore-sources">
        <div className="lh">
          <h3 className="name">Staged pages</h3>
        </div>
        <div className="lore-empty">
          <BookIcon size={30} style={{ opacity: 0.4 }} />
          <p>No pages staged.</p>
          <p className="helpr">
            Crawl a wiki page and send it to the lorebook. It is queued here so you can pull
            the facts out of it and review them before anything is added.
          </p>
        </div>
      </div>
    );
  }

  const active = sources.find(s => s.url === activeUrl) ?? null;
  const busy = extracting !== null;

  return (
    <div className="lore-sources">
      <div className="lh">
        <h3 className="name">Staged pages</h3>
        <div className="meta"><b>{sources.length}</b> queued</div>
      </div>

      <div className="lore-source-list">
        {sources.map(s => {
          const pending = pendingFor(s.url);
          return (
            <button
              key={s.url}
              type="button"
              className="lore-source"
              data-on={s.url === activeUrl ? '1' : '0'}
              onClick={() => onSelect(s.url)}
            >
              <div className="body">
                <b>{s.title || s.url}</b>
                <span className="state">
                  {extracting === s.url ? 'Extracting…'
                    : pending > 0 ? `${pending} awaiting review`
                    : s.extracted ? 'Extracted'
                    : 'Not yet extracted'}
                </span>
              </div>
              <span
                className="lore-source-remove"
                role="button"
                tabIndex={0}
                aria-label={`Remove ${s.title || s.url}`}
                onClick={e => { e.stopPropagation(); onRemove(s.url); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRemove(s.url); }
                }}
              >
                <TrashIcon size={12} />
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="lore-source-actions">
          <label className="lore-mode-label" htmlFor="lore-mode">How should this page be split?</label>
          <Dropdown
            value={active.mode || 'split'}
            options={MODE_OPTIONS}
            onChange={v => onSetMode(active.url, v as ExtractionMode)}
            aria-label={`Extraction mode for ${active.title || active.url}`}
          />
          <small className="helpr">{MODE_HINTS[active.mode || 'split']}</small>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => onExtract(active.url)}
          >
            {extracting === active.url ? 'Extracting…' : active.extracted ? 'Extract again' : 'Extract facts'}
          </button>
        </div>
      )}
    </div>
  );
};
