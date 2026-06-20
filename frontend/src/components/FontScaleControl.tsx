import { useState } from 'react';
import { FONT_SCALES, applyFontScale, getStoredFontScaleId } from '../utils/fontScale';
import { RadioGroup } from './RadioGroup';

// FontScaleControl renders the UI scale presets as an accessible radiogroup
// (see RadioGroup). Selecting a preset applies it to the document root
// immediately and persists the choice; the persisted value is re-applied on
// startup (see utils/fontScale).
export const FontScaleControl: React.FC = () => {
  const [scaleId, setScaleId] = useState(getStoredFontScaleId);

  const select = (id: string) => {
    setScaleId(id);
    applyFontScale(id);
  };

  return (
    <RadioGroup
      ariaLabel="Font scale"
      className="font-scale-control"
      optionClassName="font-scale-opt"
      options={FONT_SCALES}
      value={scaleId}
      onChange={select}
      renderOption={s => (
        <>
          <b>{s.label}</b>
          <small>{Math.round(s.value * 100)}%</small>
        </>
      )}
    />
  );
};

export default FontScaleControl;
