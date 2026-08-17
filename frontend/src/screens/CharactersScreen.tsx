import React, { useState, useEffect, useCallback } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import { PlusIcon, ArrowIcon } from '../icons';
import {
  GetCharacters, AddCharacter, SetActiveCharacter, ImportCard,
} from '../../wailsjs/go/app/App';
import EditorScreen from './EditorScreen';
import { logError } from '../utils/log';
import { errorMessage } from '../utils/errorMessage';
import { compose } from '../../wailsjs/go/models';
import { estimateCharTokens, charSummary, isCharReady } from './characterList';

interface CharactersScreenProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
}

export const CharactersScreen: React.FC<CharactersScreenProps> = ({ projectPath, onProjectPathChange }) => {
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [opened, setOpened] = useState<compose.Character | null>(null);

  const refresh = useCallback(() => {
    GetCharacters()
      .then(chars => setCharacters(chars ?? []))
      .catch(e => logError('CharactersScreen.load', e));
  }, []);

  useEffect(() => {
    if (view === 'list') refresh();
  }, [view, refresh]);

  const openChar = async (c: compose.Character) => {
    try {
      await SetActiveCharacter(c.id);
      setOpened(c);
      setView('edit');
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Open failed', body: errorMessage(e, 'Could not open character.') });
    }
  };

  const handleAdd = async () => {
    try {
      const ch = await AddCharacter();
      await SetActiveCharacter(ch.id);
      setOpened(ch);
      setView('edit');
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Add failed', body: errorMessage(e, 'Could not create character.') });
    }
  };

  const handleImport = async () => {
    try {
      const res = await ImportCard();
      if (!res) return; // cancelled
      const extra = res.importedEntries > 0 ? ` (+${res.importedEntries} lore entries)` : '';
      toast({ kind: 'ok', title: 'Card imported', body: `Imported "${res.character.name}"${extra}.` });
      await SetActiveCharacter(res.character.id);
      setOpened(res.character);
      setView('edit');
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Import failed', body: errorMessage(e, 'Could not import card.') });
    }
  };

  if (view === 'edit') {
    return (
      <div className="v2-char-detail">
        <div className="v2-backbar">
          <button type="button" className="back" onClick={() => setView('list')}>
            ← All characters
          </button>
          <span className="nm">{opened?.name?.trim() || 'Untitled'}</span>
          {opened?.epithet && <span className="ep">{opened.epithet}</span>}
        </div>
        <EditorScreen projectPath={projectPath} onProjectPathChange={onProjectPathChange} />
      </div>
    );
  }

  return (
    <>
      <PageHead
        title="Characters"
        subtitle="Everyone in this project. Open a character to edit their card on its own page."
        actions={
          <>
            <button type="button" className="btn ghost" onClick={handleImport}>
              Import card
            </button>
            <button type="button" className="btn primary" onClick={handleAdd}>
              <PlusIcon size={14} /> Add character
            </button>
          </>
        } />
      <div className="ss-page-body scroll">
        <div className="cl-wrap">
          {characters.map(c => {
            const ready = isCharReady(c);
            const summary = charSummary(c);
            return (
              <button type="button" key={c.id} className="cl-row" onClick={() => openChar(c)}>
                <span className="av" data-empty={ready ? '0' : '1'}>
                  {(c.name?.trim()[0] || '?').toUpperCase()}
                </span>
                <span className="id">
                  <b>{c.name?.trim() || 'Untitled'}</b>
                  {c.epithet && <span>{c.epithet}</span>}
                </span>
                <span className="sum">
                  {summary || 'No summary yet — crawl a source page or write fields by hand.'}
                </span>
                <span className="meta">
                  <span className="st">
                    <span className={`dot ${ready ? 'ok' : 'idle'}`} />
                    {ready ? 'ready' : 'draft'}
                  </span>
                  <span>~{estimateCharTokens(c)} tokens</span>
                </span>
                <span className="open">Open <ArrowIcon size={13} /></span>
              </button>
            );
          })}
          <button type="button" className="cl-add" onClick={handleAdd}>
            <PlusIcon size={13} /> New character — from a crawl summary or from scratch
          </button>
        </div>
      </div>
    </>
  );
};

export default CharactersScreen;
