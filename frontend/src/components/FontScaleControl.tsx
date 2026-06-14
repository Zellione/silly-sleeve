import { useState } from 'react';
import { FONT_SCALES, applyFontScale, getStoredFontScaleId } from '../utils/fontScale';

// FontScaleControl renders the UI scale presets as a radiogroup. Selecting a
// preset applies it to the document root immediately and persists the choice;
// the persisted value is re-applied on startup (see utils/fontScale).
export const FontScaleControl: React.FC = () => {
  const [scaleId, setScaleId] = useState(getStoredFontScaleId);

  const select = (id: string) => {
    setScaleId(id);
    applyFontScale(id);
  };

  return (
    <div className="font-scale-control" role="radiogroup" aria-label="Font scale">
      {FONT_SCALES.map(s => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={scaleId === s.id}
          data-on={scaleId === s.id ? '1' : '0'}
          className="font-scale-opt"
          onClick={() => select(s.id)}
        >
          <b>{s.label}</b>
          <small>{Math.round(s.value * 100)}%</small>
        </button>
      ))}
    </div>
  );
};

export default FontScaleControl;
