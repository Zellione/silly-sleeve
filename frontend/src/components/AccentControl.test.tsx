import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccentControl } from './AccentControl';
import { ACCENTS } from '../utils/accent';

describe('AccentControl', () => {
  beforeEach(() => {
    localStorage.clear();
    const s = document.documentElement.style;
    s.removeProperty('--acc-h');
  });

  it('renders every accent as a radio', () => {
    render(<AccentControl />);
    expect(screen.getAllByRole('radio')).toHaveLength(ACCENTS.length);
  });

  it('marks the stored accent as checked', () => {
    localStorage.setItem('ss-accent', 'green');
    render(<AccentControl />);
    expect(screen.getByRole('radio', { name: 'Green' })).toHaveAttribute('aria-checked', 'true');
  });

  it('defaults the checked accent to Terracotta', () => {
    render(<AccentControl />);
    expect(screen.getByRole('radio', { name: 'Terracotta' })).toHaveAttribute('aria-checked', 'true');
  });

  it('applies and persists the selected accent on click', async () => {
    const user = userEvent.setup();
    render(<AccentControl />);
    await user.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('ss-accent')).toBe('blue');
    expect(document.documentElement.style.getPropertyValue('--acc-h')).toBe('250');
  });
});
