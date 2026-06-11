import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from './useFocusTrap';

const Modal: React.FC<{ onEscape?: () => void; autofocus?: boolean }> = ({ onEscape, autofocus }) => {
  const ref = useFocusTrap<HTMLDivElement>(true, onEscape);
  return (
    <div ref={ref} data-testid="modal" tabIndex={-1}>
      <button>first</button>
      <button data-autofocus={autofocus ? '' : undefined}>middle</button>
      <button>last</button>
    </div>
  );
};

const Harness: React.FC<{ onEscape?: () => void; autofocus?: boolean }> = ({ onEscape, autofocus }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <>
          <Modal onEscape={onEscape} autofocus={autofocus} />
          <button onClick={() => setOpen(false)}>close</button>
        </>
      )}
    </>
  );
};

describe('useFocusTrap', () => {
  it('focuses the first focusable child on activation', () => {
    render(<Modal />);
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('honours [data-autofocus] over document order', () => {
    render(<Modal autofocus />);
    expect(document.activeElement).toBe(screen.getByText('middle'));
  });

  it('routes Escape to onEscape', () => {
    const onEscape = vi.fn();
    render(<Modal onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByTestId('modal'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when no handler is provided', () => {
    render(<Modal />);
    // Should not throw.
    fireEvent.keyDown(screen.getByTestId('modal'), { key: 'Escape' });
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('wraps Tab from the last element back to the first', () => {
    render(<Modal />);
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(screen.getByTestId('modal'), { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    render(<Modal />);
    const first = screen.getByText('first');
    first.focus();
    fireEvent.keyDown(screen.getByTestId('modal'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('restores focus to the trigger when the trap unmounts', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText('open');
    opener.focus();
    await user.click(opener);
    // Trap stole focus into the modal.
    expect(document.activeElement).toBe(screen.getByText('first'));
    await user.click(screen.getByText('close'));
    expect(document.activeElement).toBe(opener);
  });
});
