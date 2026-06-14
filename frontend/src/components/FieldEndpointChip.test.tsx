import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldEndpointChip } from './FieldEndpointChip';
import type { settings } from '../../wailsjs/go/models';

const eps = [
  { id: 1, name: 'Default', isDefault: true },
  { id: 2, name: 'Big model' },
] as unknown as settings.LLMEndpoint[];

describe('FieldEndpointChip', () => {
  it('shows the project override as the selected value', () => {
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{}} projectMap={{ backstory: 2 }} onSelect={() => {}} />);
    expect(screen.getByLabelText('Endpoint for Backstory')).toHaveValue('2');
  });

  it('calls onSelect with the chosen id', () => {
    const onSelect = vi.fn();
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{}} projectMap={{}} onSelect={onSelect} />);
    fireEvent.change(screen.getByLabelText('Endpoint for Backstory'), { target: { value: '2' } });
    expect(onSelect).toHaveBeenCalledWith('backstory', 2);
  });

  it('calls onSelect with 0 to clear the override', () => {
    const onSelect = vi.fn();
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{}} projectMap={{ backstory: 2 }} onSelect={onSelect} />);
    fireEvent.change(screen.getByLabelText('Endpoint for Backstory'), { target: { value: '0' } });
    expect(onSelect).toHaveBeenCalledWith('backstory', 0);
  });

  it('reflects the effective source in data-source', () => {
    render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={eps} globalMap={{ backstory: 2 }} projectMap={{}} onSelect={() => {}} />);
    expect(screen.getByLabelText('Endpoint for Backstory')).toHaveAttribute('data-source', 'global');
  });

  it('renders nothing when there are no endpoints', () => {
    const { container } = render(<FieldEndpointChip slot="backstory" label="Backstory" endpoints={[]} globalMap={{}} projectMap={{}} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
