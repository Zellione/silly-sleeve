import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRowIds } from './useRowIds';

/**
 * Mirrors how the editor drives the hook: a parent owns the list, the row
 * component pairs it with ids and calls removeRow/addRow alongside the parent's
 * onChange.
 */
const Rows: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const { rows, removeRow, addRow } = useRowIds(value);
  return (
    <div>
      {rows.map(({ item, key, index }) => (
        <div key={key} data-testid="row" data-key={key}>
          <input
            aria-label={`row ${index}`}
            value={item}
            onChange={e => onChange(value.map((x, j) => (j === index ? e.target.value : x)))}
          />
          <button
            type="button"
            aria-label={`remove ${item}`}
            onClick={() => {
              removeRow(index);
              onChange(value.filter((_, j) => j !== index));
            }}
          >
            x
          </button>
        </div>
      ))}
      <button
        type="button"
        aria-label="add"
        onClick={() => {
          addRow();
          onChange([...value, 'new']);
        }}
      >
        add
      </button>
    </div>
  );
};

const Harness: React.FC<{ initial: string[] }> = ({ initial }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Rows value={value} onChange={setValue} />
      <button type="button" aria-label="replace" onClick={() => setValue(['x', 'y'])}>replace</button>
    </>
  );
};

const keys = () => screen.getAllByTestId('row').map(el => el.getAttribute('data-key'));

describe('useRowIds', () => {
  it('gives every row a distinct key', () => {
    render(<Harness initial={['a', 'b', 'c']} />);

    const seen = keys();
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });

  it('keeps identical rows apart', () => {
    render(<Harness initial={['same', 'same']} />);

    const [first, second] = keys();
    expect(first).not.toBe(second);
  });

  it('keeps a row s key when its text is edited', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b']} />);
    const before = keys();

    await user.type(screen.getByLabelText('row 0'), '!');

    expect(keys()).toEqual(before);
  });

  it('takes the removed row s key with it and leaves the survivors alone', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b', 'c']} />);
    const [keyA, keyB, keyC] = keys();

    await user.click(screen.getByLabelText('remove b'));

    // This is the whole point of the hook: with index keys the surviving rows
    // would shift up onto 'b' and 'c' keys and React would reuse the wrong
    // DOM nodes.
    expect(keys()).toEqual([keyA, keyC]);
    expect(keys()).not.toContain(keyB);
  });

  it('does not reuse a removed row s key for a later addition', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b']} />);
    const [, keyB] = keys();

    await user.click(screen.getByLabelText('remove b'));
    await user.click(screen.getByLabelText('add'));

    expect(keys()).not.toContain(keyB);
    expect(new Set(keys()).size).toBe(2);
  });

  it('keeps the surviving DOM node when a row above it is removed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b']} />);
    const nodeB = screen.getByLabelText('row 1');

    await user.click(screen.getByLabelText('remove a'));

    // Same element instance, now at position 0 — React moved it rather than
    // re-rendering 'a' into it.
    expect(screen.getByLabelText('row 0')).toBe(nodeB);
  });

  it('mints ids for rows appended from outside the component', () => {
    const { rerender } = render(<Rows value={['a']} onChange={vi.fn()} />);
    const [first] = keys();

    rerender(<Rows value={['a', 'b']} onChange={vi.fn()} />);

    const after = keys();
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(first);
    expect(new Set(after).size).toBe(2);
  });

  it('rebuilds ids when the list is replaced wholesale', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b', 'c']} />);

    await user.click(screen.getByLabelText('replace'));

    const after = keys();
    expect(after).toHaveLength(2);
    expect(new Set(after).size).toBe(2);
  });

  it('handles an empty list', () => {
    render(<Harness initial={[]} />);

    expect(screen.queryAllByTestId('row')).toHaveLength(0);
  });
});
