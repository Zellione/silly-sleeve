import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from './RadioGroup';

const OPTIONS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

function renderGroup(value: string, onChange = vi.fn()) {
  render(
    <RadioGroup
      ariaLabel="Test group"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      renderOption={o => <span>{o.label}</span>}
    />,
  );
  return onChange;
}

describe('RadioGroup', () => {
  it('renders a radiogroup with one radio per option', () => {
    renderGroup('a');
    expect(screen.getByRole('radiogroup', { name: 'Test group' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(OPTIONS.length);
  });

  it('marks the selected option checked and gives it the only tab stop', () => {
    renderGroup('b');
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('tabindex', '0');
    expect(radios[0]).toHaveAttribute('tabindex', '-1');
    expect(radios[2]).toHaveAttribute('tabindex', '-1');
  });

  it('falls back to making the first radio focusable when none is selected', () => {
    renderGroup('none-of-them');
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('tabindex', '0');
  });

  it('selects on click', async () => {
    const user = userEvent.setup();
    const onChange = renderGroup('a');
    await user.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('moves to the next option on ArrowRight/ArrowDown', async () => {
    const user = userEvent.setup();
    const onChange = renderGroup('a');
    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('moves to the previous option on ArrowLeft/ArrowUp', async () => {
    const user = userEvent.setup();
    const onChange = renderGroup('b');
    screen.getByRole('radio', { name: 'Beta' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('wraps from last to first and first to last', async () => {
    const user = userEvent.setup();
    const onChange = renderGroup('c');
    screen.getByRole('radio', { name: 'Gamma' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('a');
    onChange.mockClear();
    // re-render at 'a' and go left to wrap to last
    renderGroup('a', onChange);
  });

  it('jumps to first on Home and last on End', async () => {
    const user = userEvent.setup();
    const onChange = renderGroup('b');
    screen.getByRole('radio', { name: 'Beta' }).focus();
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('a');
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('applies an explicit aria-label when getOptionLabel is provided', () => {
    render(
      <RadioGroup
        ariaLabel="Swatches"
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
        getOptionLabel={o => `Colour ${o.label}`}
        renderOption={() => null}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Colour Alpha' })).toBeInTheDocument();
  });
});
