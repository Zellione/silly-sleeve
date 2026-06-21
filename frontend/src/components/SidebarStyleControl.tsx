import { useState } from 'react';
import { SIDEBAR_STYLES, applySidebarStyle, getStoredSidebarStyle } from '../utils/sidebarStyle';
import { RadioGroup } from './RadioGroup';

// SidebarStyleControl renders the sidebar width tiers as an accessible
// radiogroup (see RadioGroup). Selecting a tier applies it to the document root
// immediately and persists the choice; the persisted value is re-applied on
// startup (see utils/sidebarStyle).
export const SidebarStyleControl: React.FC = () => {
  const [styleId, setStyleId] = useState(getStoredSidebarStyle);

  const select = (id: string) => {
    setStyleId(id);
    applySidebarStyle(id);
  };

  return (
    <RadioGroup
      ariaLabel="Sidebar style"
      className="sidebar-style-control"
      optionClassName="font-scale-opt"
      options={SIDEBAR_STYLES}
      value={styleId}
      onChange={select}
      renderOption={s => <b>{s.label}</b>}
    />
  );
};

export default SidebarStyleControl;
