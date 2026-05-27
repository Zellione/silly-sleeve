import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastProvider';

const TestConsumer: React.FC = () => {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast({ kind: 'ok', title: 'Success', body: 'Done!' })}>
        Show OK
      </button>
      <button onClick={() => toast({ kind: 'bad', title: 'Error', body: 'Failed!' })}>
        Show Bad
      </button>
      <button onClick={() => toast({ kind: 'warn', title: 'Warning' })}>
        Show Warn
      </button>
      <button onClick={() => toast({ kind: 'info', title: 'Info' })}>
        Show Info
      </button>
    </div>
  );
};

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useToast is used outside provider', () => {
    const BadConsumer = () => {
      useToast();
      return null;
    };
    expect(() => render(<BadConsumer />)).toThrow(
      'useToast must be used inside ToastProvider'
    );
  });

  it('renders toast with correct title and body', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show OK'));
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Done!')).toBeInTheDocument();
  });

  it('renders toast without body when body is omitted', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Warn'));
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders toasts with correct kind attributes', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show OK'));
    expect(screen.getByText('Success').closest('[data-kind="ok"]')).toBeTruthy();

    await user.click(screen.getByText('Show Bad'));
    expect(screen.getByText('Error').closest('[data-kind="bad"]')).toBeTruthy();

    await user.click(screen.getByText('Show Info'));
    expect(screen.getByText('Info').closest('[data-kind="info"]')).toBeTruthy();
  });

  it('auto-dismisses after 4.2 seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show OK'));
    expect(screen.getByText('Success')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(screen.queryByText('Success')).not.toBeInTheDocument();
  });

  it('dismisses on X button click', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show OK'));

    const xButton = screen.getByText('Success')
      .closest('.ss-toast')!
      .querySelector('.ss-toast-x') as HTMLElement;
    await user.click(xButton);

    await waitFor(() => {
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });
  });

  it('stacks multiple toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show OK'));
    await user.click(screen.getByText('Show Bad'));

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders progress bar on toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show OK'));

    const progress = document.querySelector('.ss-toast-progress');
    expect(progress).toBeTruthy();
  });

  it('renders all 4 toast kinds', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show OK'));
    await user.click(screen.getByText('Show Bad'));
    await user.click(screen.getByText('Show Warn'));
    await user.click(screen.getByText('Show Info'));

    expect(document.querySelectorAll('.ss-toast')).toHaveLength(4);
  });
});
