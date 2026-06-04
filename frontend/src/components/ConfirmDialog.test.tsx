import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirmDialog } from './ConfirmDialog';

const Trigger: React.FC<{
  message: string;
  onResult: (ok: boolean) => void;
}> = ({ message, onResult }) => {
  const { confirm } = useConfirmDialog();
  const handle = async () => {
    const ok = await confirm(message);
    onResult(ok);
  };
  return <button onClick={handle}>Trigger</button>;
};

describe('ConfirmDialog', () => {
  it('renders confirmation dialog and resolves on confirm', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <Trigger message="Delete everything?" onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Trigger'));

    expect(screen.getByText('Delete everything?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();

    await user.click(screen.getByText('Confirm'));

    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('resolves false on cancel', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <Trigger message="Are you sure?" onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Trigger'));
    await user.click(screen.getByText('Cancel'));

    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('resolves false on backdrop click', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <Trigger message="Are you sure?" onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Trigger'));

    const backdrop = document.querySelector('.ss-confirm-backdrop') as HTMLElement;
    await user.click(backdrop);

    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('falls back to window.confirm when no provider', async () => {
    const onResult = vi.fn();

    render(<Trigger message="Sure?" onResult={onResult} />);

    await act(async () => {
      screen.getByText('Trigger').click();
    });

    // window.confirm is mocked to return true in test-setup.ts
    expect(onResult).toHaveBeenCalledWith(true);
  });
});
