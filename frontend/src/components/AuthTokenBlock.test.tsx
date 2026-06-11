import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthTokenBlock } from './AuthTokenBlock';

const base = {
  enabled: true,
  onToggle: () => {},
  value: '',
  onChange: () => {},
  toggleLabel: 'Use API key',
  placeholder: 'sk-…',
};

describe('AuthTokenBlock', () => {
  it('renders the toggle label and switch state', () => {
    render(<AuthTokenBlock {...base} enabled={false} />);
    expect(screen.getByText('Use API key')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('hides the secret input while disabled', () => {
    render(<AuthTokenBlock {...base} enabled={false} />);
    expect(screen.queryByPlaceholderText('sk-…')).toBeNull();
  });

  it('shows a masked input when enabled and reveals it on demand', async () => {
    const user = userEvent.setup();
    render(<AuthTokenBlock {...base} value="secret" />);
    const input = screen.getByPlaceholderText('sk-…');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByTitle('Reveal key'));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByTitle('Hide key'));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('uses the secret noun in the reveal tooltip', () => {
    render(<AuthTokenBlock {...base} secretNoun="token" />);
    expect(screen.getByTitle('Reveal token')).toBeInTheDocument();
  });

  it('reports toggle and value changes', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onChange = vi.fn();
    render(<AuthTokenBlock {...base} onToggle={onToggle} onChange={onChange} inputId="tok" />);
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledWith(false);
    const input = screen.getByPlaceholderText('sk-…');
    expect(input).toHaveAttribute('id', 'tok');
    await user.type(input, 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
