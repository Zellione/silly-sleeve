import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndpointFlyout } from './EndpointFlyout';
import { ToastProvider } from '../ToastProvider';
import { settings } from '../../../wailsjs/go/models';

vi.mock('../../../wailsjs/go/app/App', () => ({
  TestLLMEndpoint: vi.fn(),
}));

const endpoint = (over: Partial<settings.LLMEndpoint> = {}) =>
  settings.LLMEndpoint.createFrom({
    id: 1, name: 'Local', url: 'http://localhost:8080/v1', model: 'gemma',
    isDefault: true, contextSize: 8192, temperature: 0.8, systemPrompt: '', ok: false,
    ...over,
  });

const renderFlyout = (ep = endpoint(), onSave = vi.fn()) => {
  render(
    <ToastProvider>
      <EndpointFlyout endpoint={ep} isNew={false} onSave={onSave} onClose={vi.fn()} />
    </ToastProvider>,
  );
  return onSave;
};

describe('EndpointFlyout request timeout', () => {
  it('saves a configured request timeout in seconds', async () => {
    const user = userEvent.setup();
    const onSave = renderFlyout();

    const field = screen.getByLabelText(/request timeout/i);
    await user.clear(field);
    await user.type(field, '240');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ timeoutSeconds: 240 }));
  });

  it('shows an existing timeout when editing', () => {
    renderFlyout(endpoint({ timeoutSeconds: 90 }));
    expect(screen.getByLabelText(/request timeout/i)).toHaveValue(90);
  });

  it('leaves the timeout unset when untouched so the backend default applies', async () => {
    const user = userEvent.setup();
    const onSave = renderFlyout();

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].timeoutSeconds ?? 0).toBe(0);
  });
});
