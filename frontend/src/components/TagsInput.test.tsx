import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagsInput } from './TagsInput';

describe('TagsInput', () => {
  it('adds a tag on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput value={[]} onChange={onChange} placeholder="Add…" />);
    await user.type(screen.getByPlaceholderText('Add…'), 'rogue{Enter}');
    expect(onChange).toHaveBeenCalledWith(['rogue']);
  });

  it('adds a tag on comma', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput value={[]} onChange={onChange} placeholder="Add…" />);
    await user.type(screen.getByPlaceholderText('Add…'), 'bard,');
    expect(onChange).toHaveBeenCalledWith(['bard']);
  });

  it('ignores duplicates and blank drafts', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput value={['mage']} onChange={onChange} placeholder="Add…" />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'mage{Enter}');
    await user.type(input, '   {Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the normalize transform before adding', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagsInput value={[]} onChange={onChange} placeholder="Add…" normalize={s => s.toLowerCase()} />
    );
    await user.type(screen.getByPlaceholderText('Add…'), 'Knight{Enter}');
    expect(onChange).toHaveBeenCalledWith(['knight']);
  });

  it('removes the last tag on Backspace with an empty draft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput value={['a', 'b']} onChange={onChange} placeholder="Add…" />);
    await user.type(screen.getByRole('textbox'), '{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('removes a specific tag via its remove button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagsInput value={['a', 'b']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('accents the first N tags and switches placeholder when filled', () => {
    render(
      <TagsInput
        value={['x', 'y', 'z']}
        onChange={vi.fn()}
        accentCount={2}
        accentClassName="acc"
        placeholder="empty"
        placeholderWhenFilled="filled"
      />
    );
    const tags = document.querySelectorAll('.tag');
    expect(tags[0].className).toContain('acc');
    expect(tags[1].className).toContain('acc');
    expect(tags[2].className).not.toContain('acc');
    expect(screen.getByPlaceholderText('filled')).toBeInTheDocument();
  });

  it('toggles the empty class when there are no tags', () => {
    const { container } = render(
      <TagsInput value={[]} onChange={vi.fn()} className="lb-keys" emptyClassName="empty" />
    );
    expect(container.querySelector('.lb-keys')?.className).toContain('empty');
  });

  it('hides the input and remove buttons when disabled', () => {
    render(<TagsInput value={['a']} onChange={vi.fn()} disabled placeholder="Add…" />);
    expect(screen.queryByPlaceholderText('Add…')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('a')).toBeInTheDocument();
  });
});
