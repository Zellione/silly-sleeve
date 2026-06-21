import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepBadgesControl } from './StepBadgesControl';

describe('StepBadgesControl', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-step-badges');
  });

  it('renders a switch checked by default', () => {
    render(<StepBadgesControl />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects a stored off value', () => {
    localStorage.setItem('ss-step-badges', '0');
    render(<StepBadgesControl />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles off: applies and persists on click', async () => {
    const user = userEvent.setup();
    render(<StepBadgesControl />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('ss-step-badges')).toBe('0');
    expect(document.documentElement.getAttribute('data-step-badges')).toBe('0');
  });

  it('toggles back on with a second click', async () => {
    const user = userEvent.setup();
    localStorage.setItem('ss-step-badges', '0');
    render(<StepBadgesControl />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('ss-step-badges')).toBe('1');
  });
});
