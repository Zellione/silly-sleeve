import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldEndpointChip } from './FieldEndpointChip';
import type { settings } from '../../wailsjs/go/models';

const eps = [
  { id: 1, name: 'Default', isDefault: true },
  { id: 2, name: 'Big model' },
] as unknown as settings.LLMEndpoint[];

describe('FieldEndpointChip', () => {
  it('shows the project override as the selected value', () => {
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{}} projectMap={{ backstory: 2 }} onSelect={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Endpoint for Backstory' })).toHaveTextContent('Big model');
  });

  it('calls onSelect with the chosen id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{}} projectMap={{}} onSelect={onSelect} />);
    await user.click(screen.getByRole('combobox', { name: 'Endpoint for Backstory' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Big model' }));
    expect(onSelect).toHaveBeenCalledWith('backstory', 2);
  });

  it('calls onSelect with 0 to clear the override', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{}} projectMap={{ backstory: 2 }} onSelect={onSelect} />);
    await user.click(screen.getByRole('combobox', { name: 'Endpoint for Backstory' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Use default' }));
    expect(onSelect).toHaveBeenCalledWith('backstory', 0);
  });

  it('reflects the effective source in data-source', () => {
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{ backstory: 2 }} projectMap={{}} onSelect={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Endpoint for Backstory' })).toHaveAttribute('data-source', 'global');
  });

  it('renders nothing when there are no endpoints', () => {
    const { container } = render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={[]} globalMap={{}} projectMap={{}} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
