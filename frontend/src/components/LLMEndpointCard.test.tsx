import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LLMEndpointCard } from './LLMEndpointCard';
import { settings } from '../../wailsjs/go/models';

const makeEndpoint = (over: Partial<settings.LLMEndpoint> = {}) =>
  settings.LLMEndpoint.createFrom({
    id: 1, name: 'Local', url: 'http://localhost:5001/v1', model: 'mistral',
    key: undefined, isDefault: false, ok: false, ...over,
  });

const noop = () => {};

const renderCard = (props: Partial<React.ComponentProps<typeof LLMEndpointCard>> = {}) =>
  render(
    <LLMEndpointCard
      endpoint={makeEndpoint()}
      testing={false}
      menuOpen={false}
      menuRef={null}
      onToggleMenu={noop}
      onSetDefault={noop}
      onDuplicate={noop}
      onExportConfig={noop}
      onDelete={noop}
      onTest={noop}
      onEdit={noop}
      {...props}
    />
  );

describe('LLMEndpointCard', () => {
  it('renders name, model, url and the untested pill', () => {
    renderCard();
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('mistral')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:5001/v1')).toBeInTheDocument();
    expect(screen.getByText('… untested')).toBeInTheDocument();
    expect(screen.getByText('no auth')).toBeInTheDocument();
  });

  it('shows the default and connected pills, and masks the auth key', () => {
    renderCard({ endpoint: makeEndpoint({ isDefault: true, ok: true, key: 'sk-secret-token' }) });
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('✓ connected')).toBeInTheDocument();
    expect(screen.getByText(/auth · sk-sec/)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token/)).toBeNull();
  });

  it('reflects an in-flight test', () => {
    renderCard({ testing: true });
    expect(screen.getByText('Testing…')).toBeInTheDocument();
  });

  it('hides the overflow menu until open', () => {
    const { rerender } = renderCard();
    expect(screen.queryByText('Set as default')).toBeNull();
    rerender(
      <LLMEndpointCard
        endpoint={makeEndpoint()}
        testing={false} menuOpen menuRef={null}
        onToggleMenu={noop} onSetDefault={noop} onDuplicate={noop}
        onExportConfig={noop} onDelete={noop} onTest={noop} onEdit={noop}
      />
    );
    expect(screen.getByText('Set as default')).toBeInTheDocument();
    expect(screen.getByText('Delete endpoint')).toBeInTheDocument();
  });

  it('wires the action handlers', async () => {
    const user = userEvent.setup();
    const onTest = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onSetDefault = vi.fn();
    renderCard({ menuOpen: true, onTest, onEdit, onDelete, onSetDefault });
    await user.click(screen.getByText('Test'));
    await user.click(screen.getByText('Edit'));
    await user.click(screen.getByText('Delete endpoint'));
    await user.click(screen.getByText('Set as default'));
    expect(onTest).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onSetDefault).toHaveBeenCalledOnce();
  });

  it('disables "Set as default" for the current default', () => {
    renderCard({ endpoint: makeEndpoint({ isDefault: true }), menuOpen: true });
    expect(screen.getByText(/Set as default/).closest('button')).toBeDisabled();
  });
});
