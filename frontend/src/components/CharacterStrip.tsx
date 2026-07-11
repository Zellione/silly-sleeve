import React from 'react';
import { PlusIcon } from '../icons';
import { compose } from '../../wailsjs/go/models';

export const CharacterStrip: React.FC<{
  characters: compose.Character[];
  activeId: number;
  onSelect: (id: number) => void;
  onAdd?: () => void;
  onImport?: () => void;
}> = ({ characters, activeId, onSelect, onAdd, onImport }) => (
  <div className="ss-char-strip scroll">
    <span className="uplabel">Characters · {characters.length}</span>
    {characters.map(c => (
      <button key={c.id} className="ss-char-tab"
        data-on={c.id === activeId ? '1' : '0'}
        onClick={() => onSelect(c.id)}>
        <span className="av">{c.name[0] || '?'}</span>
        <span className="nm">{c.name || 'Untitled'}</span>
        {c.epithet && <span className="ep">{c.epithet}</span>}
      </button>
    ))}
    {onImport && (
      <button className="ss-char-add" onClick={onImport}>
        <PlusIcon size={11} /> Import card
      </button>
    )}
    {onAdd && (
      <button className="ss-char-add" onClick={onAdd}>
        <PlusIcon size={11} /> Add character
      </button>
    )}
  </div>
);
