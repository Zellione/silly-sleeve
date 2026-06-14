import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('emits the updated map when a slot changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PerFieldDefaults endpoints={eps} value={{}} onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Endpoint for Bulk generation' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Fast local' }));
    expect(onChange).toHaveBeenCalledWith({ bulk: 2 });
  });

  it('clears a slot when Use default is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PerFieldDefaults endpoints={eps} value={{ bulk: 2 }} onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Endpoint for Bulk generation' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Use default endpoint' }));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('shows a hint when there are no endpoints', () => {
    render(<PerFieldDefaults endpoints={[]} value={{}} onChange={() => {}} />);
    expect(screen.getByText(/add an llm endpoint/i)).toBeInTheDocument();
  });
});
