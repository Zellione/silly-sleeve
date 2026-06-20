import { useState } from 'react';
import { applyStepBadges, getStoredStepBadges } from '../utils/stepBadges';

// StepBadgesControl renders an on/off switch for the step number badges shown
// in the sidebar and page header. Toggling applies to the document root
// immediately and persists the choice (see utils/stepBadges).
export const StepBadgesControl: React.FC = () => {
  const [on, setOn] = useState(getStoredStepBadges);

  const toggle = () => {
    const next = !on;
    setOn(next);
    applyStepBadges(next);
  };

  return (
    <button
      type="button"
      className="ep-switch"
      data-on={on ? '1' : '0'}
      role="switch"
      aria-checked={on}
      aria-label="Step badges"
      onClick={toggle}
    >
      <i />
    </button>
  );
};

export default StepBadgesControl;
