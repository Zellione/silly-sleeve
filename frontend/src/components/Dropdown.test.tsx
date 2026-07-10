import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from './Dropdown';

const opts = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
];

describe('Dropdown', () => {
  it('renders a combobox showing the selected option label', () => {
    render(<Dropdown options={opts} value="b" onChange={() => {}} aria-label="Fruit" />);
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    expect(trigger).toHaveTextContent('Banana');
  });

  it('falls back to the placeholder when no value matches', () => {
    render(<Dropdown options={opts} value="" onChange={() => {}} placeholder="Pick one" aria-label="Fruit" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick one');
  });

  it('is collapsed until opened', () => {
    render(<Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the listbox on click and lists every option', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');
  });

  it('emits the value and closes when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={opts} value="a" onChange={onChange} aria-label="Fruit" />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Cherry' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects with the keyboard via ArrowDown then Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={opts} value="a" onChange={onChange} aria-label="Fruit" />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}'); // open
    await user.keyboard('{ArrowDown}'); // move to Banana
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes on Escape without emitting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={opts} value="a" onChange={onChange} aria-label="Fruit" />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />
        <button type="button">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('works uncontrolled from defaultValue', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={opts} defaultValue="a" onChange={onChange} aria-label="Fruit" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Apple');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('combobox')).toHaveTextContent('Banana');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={opts} value="a" onChange={() => {}} disabled aria-label="Fruit" />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates upward and wraps with ArrowUp', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={opts} value="a" onChange={onChange} aria-label="Fruit" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowUp}'); // open, active = Apple
    await user.keyboard('{ArrowUp}'); // wrap up to Cherry
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('jumps to the first and last option with Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={opts} value="b" onChange={onChange} aria-label="Fruit" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}'); // open, active = Banana
    await user.keyboard('{End}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    await user.keyboard('{ArrowDown}'); // reopen
    await user.keyboard('{Home}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  const withDisabled = [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana', disabled: true },
    { value: 'c', label: 'Cherry' },
  ];

  it('skips disabled options when navigating with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={withDisabled} value="a" onChange={onChange} aria-label="Fruit" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}'); // open, active = Apple
    await user.keyboard('{ArrowDown}'); // skip disabled Banana -> Cherry
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('does not emit when a disabled option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={withDisabled} value="a" onChange={onChange} aria-label="Fruit" />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the active option when every option is disabled', async () => {
    const user = userEvent.setup();
    const allDisabled = opts.map(o => ({ ...o, disabled: true }));
    render(<Dropdown options={allDisabled} value="a" onChange={() => {}} aria-label="Fruit" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}'); // open
    await user.keyboard('{ArrowDown}'); // no enabled target -> stays
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('opens with Enter when closed', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('ignores unrelated keys', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('x');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('positions the listbox as position:fixed anchored to the trigger, escaping ancestor overflow clipping', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />);
    const trigger = screen.getByRole('combobox');
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 130, left: 50, right: 250, width: 200, height: 30,
      x: 50, y: 100, toJSON: () => ({}),
    } as DOMRect);

    await user.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveStyle({ position: 'fixed', top: '134px', left: '50px' });
  });

  it('compensates the fixed position for the app-wide UI zoom (font-scale) factor', async () => {
    const user = userEvent.setup();
    document.documentElement.style.zoom = '1.25';
    try {
      render(<Dropdown options={opts} value="a" onChange={() => {}} aria-label="Fruit" />);
      const trigger = screen.getByRole('combobox');
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100, bottom: 130, left: 50, right: 250, width: 200, height: 30,
        x: 50, y: 100, toJSON: () => ({}),
      } as DOMRect);

      await user.click(trigger);

      // getBoundingClientRect reports true screen pixels, but WebKit/Blink
      // make the zoomed <html> the containing block for position:fixed
      // descendants, so raw values must be divided by the zoom factor to
      // land in the right visual spot (see utils/fontScale.getCurrentZoom).
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveStyle({ position: 'fixed', top: '107.2px', left: '40px' });
    } finally {
      document.documentElement.style.zoom = '';
    }
  });

  it('passes through id, className, title and data-source', () => {
    render(
      <Dropdown
        options={opts}
        value="a"
        onChange={() => {}}
        id="fruit-select"
        className="field"
        title="Choose a fruit"
        data-source="project"
        aria-label="Fruit"
      />,
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('id', 'fruit-select');
    expect(trigger).toHaveClass('field');
    expect(trigger).toHaveAttribute('title', 'Choose a fruit');
    expect(trigger).toHaveAttribute('data-source', 'project');
  });
});
