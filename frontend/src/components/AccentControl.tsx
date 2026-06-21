import { useState } from 'react';
import { ACCENTS, accentCss, applyAccent, getStoredAccentId } from '../utils/accent';
import { RadioGroup } from './RadioGroup';

// AccentControl renders the accent presets as an accessible swatch radiogroup
// (see RadioGroup). Selecting a swatch applies it to the document root
// immediately and persists the choice; the persisted value is re-applied on
// startup (see utils/accent).
export const AccentControl: React.FC = () => {
  const [accentId, setAccentId] = useState(getStoredAccentId);

  const select = (id: string) => {
    setAccentId(id);
    applyAccent(id);
  };

  return (
    <RadioGroup
      ariaLabel="Accent color"
      className="accent-control"
      optionClassName="accent-swatch"
      options={ACCENTS}
      value={accentId}
      onChange={select}
      getOptionLabel={a => a.label}
      getOptionStyle={a => ({ background: accentCss(a) })}
    />
  );
};

export default AccentControl;
