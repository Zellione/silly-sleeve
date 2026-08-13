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

/** What a staged page is currently doing, in the order that matters most. */
function sourceState(source: loreextract.StagedSource, pending: number, extracting: string | null): string {
  if (extracting === source.url) return 'Extracting…';
  if (pending > 0) return `${pending} awaiting review`;
  return source.extracted ? 'Extracted' : 'Not yet extracted';
}

function extractLabel(source: loreextract.StagedSource, extracting: string | null): string {
  if (extracting === source.url) return 'Extracting…';
  return source.extracted ? 'Extract again' : 'Extract facts';
}

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
          const name = s.title || s.url;
          return (
            // Two sibling buttons in a wrapper, not a button inside a button:
            // selecting and removing are separate actions, and nesting them
            // would be invalid HTML however the inner one is marked up.
            <div key={s.url} className="lore-source" data-on={s.url === activeUrl ? '1' : '0'}>
              <button type="button" className="lore-source-pick" onClick={() => onSelect(s.url)}>
                <span className="body">
                  <b>{name}</b>
                  <span className="state">{sourceState(s, pendingFor(s.url), extracting)}</span>
                </span>
              </button>
              <button
                type="button"
                className="lore-source-remove"
                aria-label={`Remove ${name}`}
                onClick={() => onRemove(s.url)}
              >
                <TrashIcon size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {active && (
        <div className="lore-source-actions">
          {/* Dropdown is a composite, not a native control, so this is a span
              with the accessible name carried by the Dropdown's own aria-label. */}
          <span className="lore-mode-label">How should this page be split?</span>
          <Dropdown
            value={active.mode || 'split'}
            options={MODE_OPTIONS}
            onChange={v => onSetMode(active.url, v as ExtractionMode)}
            aria-label={`Extraction mode for ${active.title || active.url}`}
          />
          <small className="helpr">{MODE_HINTS[active.mode || 'split']}</small>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => onExtract(active.url)}
          >
            {extractLabel(active, extracting)}
          </button>
        </div>
      )}
    </div>
  );
};
