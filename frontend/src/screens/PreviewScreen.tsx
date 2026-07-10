import React, { useState, useEffect, useCallback } from 'react';
import { PageHead } from '../components/Layout';
import { CharacterStrip } from '../components/CharacterStrip';
import { GetCharacters, GetActiveCharacter, SetActiveCharacter, GetPortrait } from '../../wailsjs/go/app/App';
import { compose } from '../../wailsjs/go/models';
import { arrayBufferToDataURL } from '../utils/image';
import { logError } from '../utils/log';

const hasStats = (stats: compose.StatKV[]) => stats.some(s => s.key !== '' || s.value !== '');

const TextField: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  body ? (
    <div className="field">
      <h5 className="field-title">{title}</h5>
      <p className="field-body">{body}</p>
    </div>
  ) : null
);

const CharacterCard: React.FC<{ ch: compose.Character; portrait: string | null }> = ({ ch, portrait }) => (
  <div className="character-card">
    <div className="portrait">
      {portrait && <img src={portrait} alt={`${ch.name || 'Untitled'} portrait`} />}
      <div className="id">
        <b>{ch.name || 'Untitled'}</b>
        {'#' + ch.id}
      </div>
      <div className="tags">
        {(ch.tags ?? []).map(t => <span key={t} className="tag">{t}</span>)}
      </div>
    </div>
    <div className="body scroll">
      <div className="title-block">
        {ch.epithet && <span className="epithet">{ch.epithet}</span>}
        <h2>{ch.name || 'Untitled'}</h2>
      </div>

      <TextField title="Appearance" body={ch.appearance} />
      <TextField title="Personality" body={ch.personality} />
      <TextField title="Backstory" body={ch.backstory} />
      <TextField title="Abilities & skills" body={ch.abilities} />
      <TextField title="Relationships" body={ch.relationships} />

      {ch.quotes?.[0] && (
        <div className="field">
          <h5 className="field-title">Voice — example exchange</h5>
          <blockquote style={{
            margin: 0, padding: '12px 14px', borderLeft: '2px solid var(--acc)',
            background: 'var(--bg)', borderRadius: '0 4px 4px 0',
            font: 'italic 14px/1.55 var(--f-display)', color: 'var(--ink)',
          }}>
            {ch.quotes[0]}
          </blockquote>
        </div>
      )}

      {hasStats(ch.stats ?? []) && (
        <div className="field">
          <h5 className="field-title">Stat block</h5>
          <div className="stat-mini">
            {ch.stats.filter(s => s.key !== '' || s.value !== '').map((s, i) => (
              <div key={i}><b>{s.value}</b><span>{s.key}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const PreviewScreen: React.FC = () => {
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [activeChar, setActiveChar] = useState<compose.Character | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([GetCharacters(), GetActiveCharacter()]).then(([chars, active]) => {
      setCharacters(chars);
      if (chars.length > 0) {
        setActiveChar(chars.find(c => c.id === active.id) ?? chars[0]);
      }
    }).catch(e => logError('PreviewScreen.loadCharacters', e));
  }, []);

  const activeId = activeChar?.id ?? 0;

  useEffect(() => {
    const fetchPortrait = activeId ? GetPortrait(activeId) : Promise.resolve([]);
    fetchPortrait
      .then(bytes => setPortrait(activeId ? (arrayBufferToDataURL(bytes) || null) : null))
      .catch(() => setPortrait(null));
  }, [activeId]);

  const selectChar = useCallback((id: number) => {
    setActiveChar(characters.find(c => c.id === id) ?? null);
    SetActiveCharacter(id).catch(e => logError('PreviewScreen.selectChar', e));
  }, [characters]);

  return (
    <>
      <PageHead step={6} subtitle="Inspect the assembled card"
        title={<>Preview <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>{activeChar?.name?.split(' ')[0] ?? ''}</em></>} />
      <CharacterStrip characters={characters} activeId={activeId} onSelect={selectChar} />
      <div className="ss-page-body scroll">
        {activeChar ? (
          <div className="export-grid">
            <div className="col" style={{ gap: 18 }}>
              <CharacterCard ch={activeChar} portrait={portrait} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
            <div className="col" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div className="serif-i" style={{ fontSize: 28, color: 'var(--ink-2)' }}>No characters yet</div>
              <div className="uplabel">Add a character in Compose to preview it here.</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PreviewScreen;
