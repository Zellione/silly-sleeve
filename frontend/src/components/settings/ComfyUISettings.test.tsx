import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComfyUISettings } from './ComfyUISettings';
import { ToastProvider } from '../ToastProvider';
import { settings } from '../../../wailsjs/go/models';

const mockTestComfyUIEndpoint = vi.fn();
const mockParseComfyWorkflowParams = vi.fn();

vi.mock('../../../wailsjs/go/app/App', () => ({
  TestComfyUIEndpoint: (url: string, token: string) => mockTestComfyUIEndpoint(url, token),
  ParseComfyWorkflowParams: (json: string) => mockParseComfyWorkflowParams(json),
}));

const settingsState = settings.Settings.createFrom({
  comfy: { url: 'http://127.0.0.1:8188', outputFolder: '', defaultWorkflow: '', workflows: [] },
});

const renderSettings = () =>
  render(
    <ToastProvider>
      <ComfyUISettings settingsState={settingsState} persist={vi.fn()} />
    </ToastProvider>,
  );

describe('ComfyUISettings test connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tests the connection through the Go backend, not a WebView fetch', async () => {
    // A fetch from the WebView is subject to CORS, which ComfyUI does not
    // allow by default — a healthy server failed the old in-page check.
    mockTestComfyUIEndpoint.mockResolvedValue({ ok: true, latency_ms: 5 });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Test'));

    expect(await screen.findByText('ComfyUI reachable')).toBeInTheDocument();
    expect(mockTestComfyUIEndpoint).toHaveBeenCalledWith('http://127.0.0.1:8188', '');
  });

  it('strips a trailing slash from the URL before testing', async () => {
    mockTestComfyUIEndpoint.mockResolvedValue({ ok: true, latency_ms: 5 });
    const user = userEvent.setup();
    renderSettings();

    const input = screen.getByLabelText(/Server URL/);
    await user.clear(input);
    await user.type(input, 'http://127.0.0.1:8188/');
    await user.click(screen.getByText('Test'));

    expect(await screen.findByText('ComfyUI reachable')).toBeInTheDocument();
    expect(mockTestComfyUIEndpoint).toHaveBeenCalledWith('http://127.0.0.1:8188', '');
  });

  it('shows the backend error when the server is unreachable', async () => {
    mockTestComfyUIEndpoint.mockResolvedValue({ ok: false, latency_ms: 0, error: 'connection refused' });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Test'));

    expect(await screen.findByText('ComfyUI unreachable')).toBeInTheDocument();
    expect(screen.getByText('connection refused')).toBeInTheDocument();
  });

  it('surfaces a rejected bridge call as unreachable', async () => {
    mockTestComfyUIEndpoint.mockRejectedValue(new Error('bridge down'));
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Test'));

    expect(await screen.findByText('ComfyUI unreachable')).toBeInTheDocument();
    expect(screen.getByText(/bridge down/)).toBeInTheDocument();
  });

  it('warns when no URL is set', async () => {
    mockTestComfyUIEndpoint.mockResolvedValue({ ok: true, latency_ms: 5 });
    const user = userEvent.setup();
    renderSettings();

    const input = screen.getByLabelText(/Server URL/);
    await user.clear(input);
    await user.click(screen.getByText('Test'));

    expect(await screen.findByText('No URL set')).toBeInTheDocument();
    expect(mockTestComfyUIEndpoint).not.toHaveBeenCalled();
  });
});
