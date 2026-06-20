import { useState } from 'react';
import { ACCENTS, accentCss, applyAccent, getStoredAccentId } from '../utils/accent';

// AccentControl renders the accent presets as a swatch radiogroup. Selecting a
// swatch applies it to the document root immediately and persists the choice;
// the persisted value is re-applied on startup (see utils/accent).
export const AccentControl: React.FC = () => {
  const [accentId, setAccentId] = useState(getStoredAccentId);

  const select = (id: string) => {
    setAccentId(id);
    applyAccent(id);
  };

  return (
    <div className="accent-control" role="radiogroup" aria-label="Accent color">
      {ACCENTS.map(a => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={accentId === a.id}
          aria-label={a.label}
          data-on={accentId === a.id ? '1' : '0'}
          className="accent-swatch"
          style={{ background: accentCss(a) }}
          onClick={() => select(a.id)}
        />
      ))}
    </div>
  );
};

export default AccentControl;
