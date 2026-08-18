import React from 'react';
import { compose, lorebook, loreextract } from '../../../wailsjs/go/models';
import { StagedSourcePanel } from './StagedSourcePanel';
import { CandidateList } from './CandidateList';
import { SuggestionList } from './SuggestionList';
import { useLoreStaging } from './useLoreStaging';

/** Connection review, owned by the screen so the action can live in its head. */
export type ConnectionReview = {
  suggestions: loreextract.Suggestion[];
  entries: lorebook.Entry[];
  onChange: (index: number, next: loreextract.Suggestion) => void;
  onSetAll: (selected: boolean) => void;
  onApply: () => void;
  onDismiss: () => void;
};

/**
 * The Extract tab: staged pages on the left, the facts extracted from the
 * selected one on the right.
 *
 * This is the whole reason a crawled page no longer becomes an entry directly.
 * A wiki page holds many facts, most of them not worth a lorebook entry, and
 * deciding which ones are — and what should trigger each — is the user's call.
 *
 * Connection suggestions take over the right-hand pane while any are pending:
 * they concern the whole lorebook rather than one page, and reviewing them
 * alongside a single page's candidates would be confusing.
 */
export const ExtractPanel: React.FC<{
  characters: compose.Character[];
  onEntriesChanged: (entries: lorebook.Entry[]) => void;
  connections?: ConnectionReview;
  onPersist?: () => void;
}> = ({ characters, onEntriesChanged, connections, onPersist }) => {
  const {
    sources, candidates, activeUrl, extracting, extractError, loaded,
    setActiveUrl, setMode, setStyle, removeSource, extract, updateCandidate, discard, approve,
  } = useLoreStaging(onEntriesChanged, onPersist);

  if (!loaded) {
    return (
      <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="shimmer" style={{ width: 200, height: 16 }} />
      </div>
    );
  }

  const forActive = candidates.filter(c => c.sourceUrl === activeUrl);

  return (
    <div className="ss-page-body scroll">
      <div className="lore-grid">
        <StagedSourcePanel
          sources={sources}
          candidates={candidates}
          activeUrl={activeUrl}
          extracting={extracting}
          onSelect={setActiveUrl}
          onSetMode={setMode}
          onSetStyle={setStyle}
          onExtract={extract}
          onRemove={removeSource}
        />
        {connections && connections.suggestions.length > 0 ? (
          <SuggestionList
            suggestions={connections.suggestions}
            entries={connections.entries}
            characters={characters}
            onChange={connections.onChange}
            onSetAll={connections.onSetAll}
            onApply={connections.onApply}
            onDismiss={connections.onDismiss}
          />
        ) : (
          <CandidateList
            candidates={candidates}
            characters={characters}
            sourceUrl={activeUrl}
            extracting={extracting === activeUrl}
            error={activeUrl ? extractError[activeUrl] : undefined}
            onChange={updateCandidate}
            onApprove={() => approve(forActive)}
            onDiscard={() => activeUrl && discard(activeUrl)}
          />
        )}
      </div>
    </div>
  );
};
