import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterStrip } from './CharacterStrip';
import { compose } from '../../wailsjs/go/models';

const chars = [
  compose.Character.createFrom({ id: 1, name: 'Elara', epithet: 'The Lark' }),
  compose.Character.createFrom({ id: 2, name: 'Tatsumi', epithet: '' }),
];

describe('CharacterStrip', () => {
  it('renders a tab per character with initial avatar and name', () => {
    render(<CharacterStrip characters={chars} activeId={1} onSelect={vi.fn()} />);
    expect(screen.getByText('Characters · 2')).toBeInTheDocument();
    expect(screen.getByText('Elara')).toBeInTheDocument();
    expect(screen.getByText('The Lark')).toBeInTheDocument();
    expect(screen.getByText('Tatsumi')).toBeInTheDocument();
  });

  it('marks the active character tab', () => {
    render(<CharacterStrip characters={chars} activeId={2} onSelect={vi.fn()} />);
    const tabs = screen.getAllByRole('button', { name: /Elara|Tatsumi/ });
    expect(tabs[0]).toHaveAttribute('data-on', '0');
    expect(tabs[1]).toHaveAttribute('data-on', '1');
  });

  it('calls onSelect with the clicked character id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CharacterStrip characters={chars} activeId={1} onSelect={onSelect} />);
    await user.click(screen.getByText('Tatsumi'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('omits Add character and Import card buttons when their handlers are not passed', () => {
    render(<CharacterStrip characters={chars} activeId={1} onSelect={vi.fn()} />);
    expect(screen.queryByText('Add character')).not.toBeInTheDocument();
    expect(screen.queryByText('Import card')).not.toBeInTheDocument();
  });

  it('renders Add character and Import card buttons when handlers are passed', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onImport = vi.fn();
    render(<CharacterStrip characters={chars} activeId={1} onSelect={vi.fn()} onAdd={onAdd} onImport={onImport} />);

    await user.click(screen.getByText('Add character'));
    expect(onAdd).toHaveBeenCalled();

    await user.click(screen.getByText('Import card'));
    expect(onImport).toHaveBeenCalled();
  });
});
