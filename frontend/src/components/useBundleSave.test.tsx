import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBundleSave } from './useBundleSave';
import { ToastProvider } from './ToastProvider';

const mockSaveProjectBundle = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  SaveProjectBundle: (path: string) => mockSaveProjectBundle(path),
}));

const Harness: React.FC<{ projectPath?: string; delay?: number; label?: string }> = ({
  projectPath = '/tmp/p.slv', delay = 0, label = 'Portrait',
}) => {
  const scheduleSave = useBundleSave(projectPath, delay, label);
  return <button type="button" onClick={scheduleSave}>save</button>;
};

const renderHarness = (props: Parameters<typeof Harness>[0] = {}) =>
  render(<ToastProvider><Harness {...props} /></ToastProvider>);

describe('useBundleSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveProjectBundle.mockResolvedValue(undefined);
  });

  it('writes the bundle to the given project path', async () => {
    renderHarness({ projectPath: '/tmp/mine.slv' });

    await userEvent.click(screen.getByText('save'));

    await waitFor(() => expect(mockSaveProjectBundle).toHaveBeenCalledWith('/tmp/mine.slv'));
  });

  it('does not attempt a save when no project is open', async () => {
    renderHarness({ projectPath: '' });

    await userEvent.click(screen.getByText('save'));

    await new Promise(r => setTimeout(r, 10));
    expect(mockSaveProjectBundle).not.toHaveBeenCalled();
  });

  it('debounces bursts of edits into a single write', async () => {
    renderHarness({ delay: 20 });
    const btn = screen.getByText('save');

    await userEvent.click(btn);
    await userEvent.click(btn);
    await userEvent.click(btn);

    await waitFor(() => expect(mockSaveProjectBundle).toHaveBeenCalledTimes(1));
  });

  // The whole point of the hook: a failed write means the user's work exists
  // only in memory, so it must be visible rather than logged to the console.
  it('toasts when the bundle write fails instead of failing silently', async () => {
    mockSaveProjectBundle.mockRejectedValue(new Error('disk full'));
    renderHarness({ label: 'Lorebook' });

    await userEvent.click(screen.getByText('save'));

    expect(await screen.findByText('Project not saved')).toBeInTheDocument();
    expect(screen.getByText(/Lorebook was updated/)).toBeInTheDocument();
    expect(screen.getByText(/disk full/)).toBeInTheDocument();
  });

  it('names the screen that failed so the toast is actionable', async () => {
    mockSaveProjectBundle.mockRejectedValue(new Error('nope'));
    renderHarness({ label: 'Project image' });

    await userEvent.click(screen.getByText('save'));

    expect(await screen.findByText(/Project image was updated/)).toBeInTheDocument();
  });

  it('cancels a pending write when the screen unmounts', async () => {
    const { unmount } = renderHarness({ delay: 50 });

    await userEvent.click(screen.getByText('save'));
    unmount();

    await new Promise(r => setTimeout(r, 80));
    expect(mockSaveProjectBundle).not.toHaveBeenCalled();
  });
});
