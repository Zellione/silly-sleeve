import React from 'react';
import { compose } from '../../../wailsjs/go/models';

/**
 * Character scoping control: a chip per project character, toggled on to scope
 * an entry to it. An empty selection means the entry is global.
 *
 * Scoping is stored as character *id strings*, not names, so the chips map
 * between the two — the ids are what SillyTavern and the backend both use.
 *
 * Shared by the entry editor and the extraction candidate review, which need
 * the same control over the same field.
 */
export const CharacterScopeChips: React.FC<{
  characters: compose.Character[];
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix?: string;
}> = ({ characters, value, onChange, idPrefix = 'scope' }) => {
  const selected = value || [];

  if (characters.length === 0) {
    return <span className="lb-scope-empty">No characters in project.</span>;
  }

  return (
    <>
      <div className="lb-scope">
        {characters.map(c => {
          const id = String(c.id);
          const on = selected.includes(id);
          return (
            <button
              key={c.id}
              type="button"
              className="lb-scope-chip"
              data-on={on ? '1' : '0'}
              aria-pressed={on}
              id={`${idPrefix}-${c.id}`}
              onClick={() => onChange(on ? selected.filter(x => x !== id) : [...selected, id])}
            >
              {c.name || `#${c.id}`}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && <small className="lb-scope-note">Global · all characters</small>}
    </>
  );
};
