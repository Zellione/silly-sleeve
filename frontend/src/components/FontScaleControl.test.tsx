import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FontScaleControl } from './FontScaleControl';
import { FONT_SCALES } from '../utils/fontScale';

describe('FontScaleControl', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.zoom = '';
  });

  it('renders every preset as a radio', () => {
    render(<FontScaleControl />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(FONT_SCALES.length);
    expect(screen.getByRole('radio', { name: /Extra Large/ })).toBeInTheDocument();
  });

  it('marks the stored preset as checked', () => {
    localStorage.setItem('ss-font-scale', 'large');
    render(<FontScaleControl />);
    expect(screen.getByRole('radio', { name: /^Large/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('defaults the checked preset to Default', () => {
    render(<FontScaleControl />);
    expect(screen.getByRole('radio', { name: /^Default/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('applies and persists the selected preset on click', async () => {
    const user = userEvent.setup();
    render(<FontScaleControl />);
    await user.click(screen.getByRole('radio', { name: /^Small/ }));
    expect(screen.getByRole('radio', { name: /^Small/ })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('ss-font-scale')).toBe('small');
    expect(document.documentElement.style.zoom).toBe('0.9');
  });
});
