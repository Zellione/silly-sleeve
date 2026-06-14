import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerFieldDefaults } from './PerFieldDefaults';
import type { settings } from '../../wailsjs/go/models';

const eps = [
  { id: 1, name: 'Default', isDefault: true },
  { id: 2, name: 'Fast local' },
] as unknown as settings.LLMEndpoint[];

describe('PerFieldDefaults', () => {
  it('renders a row per slot with a Use-default option', () => {
    render(<PerFieldDefaults endpoints={eps} value={{}} onChange={() => {}} />);
    expect(screen.getByText('Bulk generation')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(11);
    expect(screen.getAllByText('Use default endpoint').length).toBeGreaterThan(0);
  });

  it('emits the updated map when a slot changes', () => {
    const onChange = vi.fn();
    render(<PerFieldDefaults endpoints={eps} value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Endpoint for Bulk generation'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ bulk: 2 });
  });

  it('clears a slot when Use default is chosen', () => {
    const onChange = vi.fn();
    render(<PerFieldDefaults endpoints={eps} value={{ bulk: 2 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Endpoint for Bulk generation'), { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('shows a hint when there are no endpoints', () => {
    render(<PerFieldDefaults endpoints={[]} value={{}} onChange={() => {}} />);
    expect(screen.getByText(/add an llm endpoint/i)).toBeInTheDocument();
  });
});
