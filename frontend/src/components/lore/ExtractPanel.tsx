import React from 'react';
import { compose, lorebook } from '../../../wailsjs/go/models';
import { StagedSourcePanel } from './StagedSourcePanel';
import { CandidateList } from './CandidateList';
import { useLoreStaging } from './useLoreStaging';

/**
 * The Extract tab: staged pages on the left, the facts extracted from the
 * selected one on the right.
 *
 * This is the whole reason a crawled page no longer becomes an entry directly.
 * A wiki page holds many facts, most of them not worth a lorebook entry, and
 * deciding which ones are — and what should trigger each — is the user's call.
 */
export const ExtractPanel: React.FC<{
  characters: compose.Character[];
  onEntriesChanged: (entries: lorebook.Entry[]) => void;
}> = ({ characters, onEntriesChanged }) => {
  const {
    sources, candidates, activeUrl, extracting, loaded,
    setActiveUrl, setMode, removeSource, extract, updateCandidate, discard, approve,
  } = useLoreStaging(onEntriesChanged);

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
          onExtract={extract}
          onRemove={removeSource}
        />
        <CandidateList
          candidates={candidates}
          characters={characters}
          sourceUrl={activeUrl}
          extracting={extracting === activeUrl}
          onChange={updateCandidate}
          onApprove={() => approve(forActive)}
          onDiscard={() => activeUrl && discard(activeUrl)}
        />
      </div>
    </div>
  );
};
