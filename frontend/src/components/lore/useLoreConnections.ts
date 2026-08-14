import { useState, useEffect, useCallback } from 'react';
import {
  GetLorebookSuggestions, SuggestLorebookConnections, ApplyLorebookSuggestions,
} from '../../../wailsjs/go/app/App';
import { loreextract, lorebook, compose } from '../../../wailsjs/go/models';
import { useToast } from '../ToastProvider';
import { errorMessage } from '../../utils/errorMessage';

/**
 * Owns the whole-project connection pass: running it, holding the proposals
 * while the user reviews them, and applying the ones they keep.
 *
 * Like candidates, suggestions are edited locally before being sent back —
 * a relationship rewrite is editable, and the backend applies exactly what it
 * is given.
 */
export function useLoreConnections(
  onApplied: (entries: lorebook.Entry[], characters: compose.Character[]) => void,
) {
  const [suggestions, setSuggestions] = useState<loreextract.Suggestion[]>([]);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    GetLorebookSuggestions().then(s => setSuggestions(s || [])).catch(() => setSuggestions([]));
  }, []);

  const suggest = useCallback(async () => {
    setRunning(true);
    try {
      const found = await SuggestLorebookConnections();
      setSuggestions(found || []);
      if ((found?.length ?? 0) === 0) {
        toast({
          kind: 'info',
          title: 'No new connections',
          body: 'Everything worth linking already is.',
        });
      } else {
        toast({
          kind: 'ok',
          title: `${found.length} connection${found.length === 1 ? '' : 's'} suggested`,
          body: 'Review them before applying.',
        });
      }
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Could not suggest connections', body: errorMessage(e, 'The model could not be reached.') });
    } finally {
      setRunning(false);
    }
  }, [toast]);

  const updateSuggestion = useCallback((index: number, next: loreextract.Suggestion) => {
    setSuggestions(prev => prev.map((s, i) => (i === index ? next : s)));
  }, []);

  const dismiss = useCallback(() => setSuggestions([]), []);

  const apply = useCallback(async () => {
    const count = suggestions.filter(s => s.selected).length;
    if (count === 0) return;
    try {
      const result = await ApplyLorebookSuggestions(suggestions);
      onApplied(result?.lorebook || [], result?.characters || []);
      setSuggestions([]);
      toast({
        kind: 'ok',
        title: `Applied ${count} connection${count === 1 ? '' : 's'}`,
      });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Could not apply', body: errorMessage(e, 'Nothing was changed.') });
    }
  }, [suggestions, toast, onApplied]);

  return { suggestions, running, suggest, updateSuggestion, dismiss, apply };
}
