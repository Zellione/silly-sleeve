import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarStyleControl } from './SidebarStyleControl';
import { SIDEBAR_STYLES } from '../utils/sidebarStyle';

describe('SidebarStyleControl', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-sidebar');
  });

  it('renders every style as a radio', () => {
    render(<SidebarStyleControl />);
    expect(screen.getAllByRole('radio')).toHaveLength(SIDEBAR_STYLES.length);
  });

  it('defaults the checked style to Compact', () => {
    render(<SidebarStyleControl />);
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
  });

  it('marks the stored style as checked', () => {
    localStorage.setItem('ss-sidebar', 'rail');
    render(<SidebarStyleControl />);
    expect(screen.getByRole('radio', { name: 'Rail' })).toHaveAttribute('aria-checked', 'true');
  });

  it('applies and persists the selected style on click', async () => {
    const user = userEvent.setup();
    render(<SidebarStyleControl />);
    await user.click(screen.getByRole('radio', { name: 'Wide' }));
    expect(screen.getByRole('radio', { name: 'Wide' })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('ss-sidebar')).toBe('wide');
    expect(document.documentElement.getAttribute('data-sidebar')).toBe('wide');
  });
});
