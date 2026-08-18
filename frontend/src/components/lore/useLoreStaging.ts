import { useState, useEffect, useCallback } from 'react';
import {
  GetStagedSources, SetStagedSourceMode, SetStagedSourceStyle, RemoveStagedSource,
  GetLorebookCandidates, DiscardLorebookCandidates, ExtractLorebookCandidates,
  ApproveLorebookCandidates,
} from '../../../wailsjs/go/app/App';
import { loreextract, lorebook } from '../../../wailsjs/go/models';
import { useToast } from '../ToastProvider';
import { errorMessage } from '../../utils/errorMessage';
import { logError, logDebug } from '../../utils/log';

export type ExtractionMode = 'split' | 'summary';
export type ContentStyle = 'prose' | 'factual';

/**
 * Owns the lorebook extraction review: which pages are staged, what has been
 * extracted from them, and the local edits the user makes before approving.
 *
 * Candidates are held here rather than pushed to the backend on every
 * keystroke. The backend deliberately takes the edited candidates back at
 * approval time, so this state *is* the source of truth for edits in flight.
 */
/**
 * @param onPersist Called after any backend staging mutation (mode change,
 * removal, successful extraction) so the owner can schedule a bundle save —
 * without it the staging state exists only in memory until some other action
 * happens to write the project.
 */
export function useLoreStaging(onApproved: (entries: lorebook.Entry[]) => void, onPersist?: () => void) {
  const [sources, setSources] = useState<loreextract.StagedSource[]>([]);
  const [candidates, setCandidates] = useState<loreextract.Candidate[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  // Why the last extraction of a page failed, keyed by page URL. Kept until a
  // retry starts so the reason outlives the transient failure toast.
  const [extractError, setExtractError] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([GetStagedSources(), GetLorebookCandidates()])
      .then(([s, c]) => {
        setSources(s || []);
        setCandidates(c || []);
        if (s?.length) setActiveUrl(prev => prev ?? s[0].url);
      })
      .catch(() => toast({ kind: 'bad', title: 'Load failed', body: 'Could not load staged sources.' }))
      .finally(() => setLoaded(true));
  }, [toast]);

  const setMode = useCallback((url: string, mode: ExtractionMode) => {
    // Wails types this parameter as loreextract.ExtractionMode but never emits
    // that type — it is a Go string alias, and the generator only emits structs.
    // It is a plain string on the wire, so the cast is the whole fix.
    SetStagedSourceMode(url, mode as unknown as Parameters<typeof SetStagedSourceMode>[1])
      .then(s => {
        setSources(s || []);
        onPersist?.();
      })
      .catch(() => toast({ kind: 'bad', title: 'Could not change mode' }));
  }, [toast, onPersist]);

  const setStyle = useCallback((url: string, style: ContentStyle) => {
    // Same string-alias situation as SetStagedSourceMode above.
    SetStagedSourceStyle(url, style as unknown as Parameters<typeof SetStagedSourceStyle>[1])
      .then(s => {
        setSources(s || []);
        onPersist?.();
      })
      .catch(() => toast({ kind: 'bad', title: 'Could not change style' }));
  }, [toast, onPersist]);

  const removeSource = useCallback((url: string) => {
    RemoveStagedSource(url)
      .then(s => {
        setSources(s || []);
        setCandidates(prev => prev.filter(c => c.sourceUrl !== url));
        setActiveUrl(prev => (prev === url ? (s?.[0]?.url ?? null) : prev));
        setExtractError(prev => {
          if (!(url in prev)) return prev;
          const next = { ...prev };
          delete next[url];
          return next;
        });
        onPersist?.();
      })
      .catch(() => toast({ kind: 'bad', title: 'Could not remove source' }));
  }, [toast, onPersist]);

  const extract = useCallback(async (url: string) => {
    setExtracting(url);
    setExtractError(prev => {
      if (!(url in prev)) return prev;
      const next = { ...prev };
      delete next[url];
      return next;
    });
    logDebug('LoreStaging.extract', 'extracting', url);
    try {
      const fresh = await ExtractLorebookCandidates(url);
      // Replace this page's candidates rather than appending: the backend does
      // the same, and a re-extraction supersedes the previous attempt.
      setCandidates(prev => [...prev.filter(c => c.sourceUrl !== url), ...(fresh || [])]);
      setSources(prev => prev.map(s => (s.url === url ? { ...s, extracted: true } as loreextract.StagedSource : s)));
      setActiveUrl(url);
      onPersist?.();
      toast({
        kind: 'ok',
        title: `Extracted ${fresh?.length ?? 0} ${fresh?.length === 1 ? 'entry' : 'entries'}`,
        body: 'Review and edit them before approving.',
      });
    } catch (e: any) {
      const reason = errorMessage(e, 'The model could not be reached.');
      logError('LoreStaging.extract', e);
      setExtractError(prev => ({ ...prev, [url]: reason }));
      toast({ kind: 'bad', title: 'Extraction failed', body: reason });
    } finally {
      setExtracting(null);
    }
  }, [toast, onPersist]);

  /** Replaces one candidate in place, keyed by its position within its page. */
  const updateCandidate = useCallback((index: number, next: loreextract.Candidate) => {
    setCandidates(prev => prev.map((c, i) => (i === index ? next : c)));
  }, []);

  const discard = useCallback((url: string) => {
    DiscardLorebookCandidates(url)
      .then(c => {
        setCandidates(c || []);
        setSources(prev => prev.map(s => (s.url === url ? { ...s, extracted: false } as loreextract.StagedSource : s)));
      })
      .catch(() => toast({ kind: 'bad', title: 'Could not discard candidates' }));
  }, [toast]);

  const approve = useCallback(async (toApprove: loreextract.Candidate[]) => {
    const count = toApprove.filter(c => c.selected).length;
    if (count === 0) return;
    try {
      const entries = await ApproveLorebookCandidates(toApprove);
      onApproved(entries || []);
      // Mirror the backend: approval consumes the whole review for the pages
      // with a ticked candidate — their candidates and their staging slot.
      const urls = new Set(toApprove.filter(c => c.selected).map(c => c.sourceUrl));
      setCandidates(prev => prev.filter(c => !urls.has(c.sourceUrl)));
      const remaining = sources.filter(s => !urls.has(s.url));
      setSources(remaining);
      setActiveUrl(prev => (prev && urls.has(prev) ? (remaining[0]?.url ?? null) : prev));
      toast({
        kind: 'ok',
        title: `Added ${count} ${count === 1 ? 'entry' : 'entries'}`,
        body: 'The rest were discarded.',
      });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Approve failed', body: errorMessage(e, 'Could not add the entries.') });
    }
  }, [toast, onApproved, sources]);

  return {
    sources, candidates, activeUrl, extracting, extractError, loaded,
    setActiveUrl, setMode, setStyle, removeSource, extract, updateCandidate, discard, approve,
  };
}
