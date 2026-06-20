import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFieldEditor } from './useFieldEditor';
import { compose } from '../../wailsjs/go/models';

const mockCountTokens = vi.fn();
vi.mock('../../wailsjs/go/app/App', () => ({
  CountTokens: (t: string) => mockCountTokens(t),
}));

const makeChar = (over: Partial<compose.Character> = {}) =>
  compose.Character.createFrom({
    id: 1, name: 'Elara', epithet: 'Lark', tags: ['rogue', 'elf'],
    appearance: 'auburn hair', personality: 'cheerful', backstory: '',
    abilities: '', relationships: '', quotes: ['hi'], stats: [], ...over,
  });

const onValueChange = vi.fn();

const Harness: React.FC<{ ch: compose.Character | null }> = ({ ch }) => {
  const fe = useFieldEditor(ch, { onValueChange });
  return (
    <div>
      <span data-testid="ready">{String(fe.ready)}</span>
      <span data-testid="name">{String(fe.fields.name?.value)}</span>
      <span data-testid="dirty">{fe.dirtyCount}</span>
      <span data-testid="locked">{fe.lockedCount}</span>
      <span data-testid="composing">{String(fe.isComposing)}</span>
      <span data-testid="total">{fe.totalTokens}</span>
      <span data-testid="name-history">{fe.fields.name?.history}</span>
      <span data-testid="lockedIds">{fe.lockedIds().join(',')}</span>
      <span data-testid="built">{ch ? fe.buildCharacter(ch).name : ''}</span>
      <button onClick={() => fe.setFieldValue('name', 'Renamed')}>edit</button>
      <button onClick={() => fe.patchField('name', { locked: true })}>lock</button>
      <button onClick={() => fe.patchAll({ rolling: true }, st => !st.locked)}>roll-unlocked</button>
      <button onClick={() => fe.applyGenerated('name', makeChar({ name: 'Gen' }))}>apply</button>
      <button onClick={() => fe.patchField('name', { dirty: true })}>dirty</button>
      <button onClick={fe.markAllSaved}>save</button>
    </div>
  );
};

describe('useFieldEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountTokens.mockResolvedValue(5);
  });

  it('syncs fields from the active character', () => {
    render(<Harness ch={makeChar()} />);
    expect(screen.getByTestId('ready').textContent).toBe('true');
    expect(screen.getByTestId('name').textContent).toBe('Elara');
  });

  it('stays empty with no active character', () => {
    render(<Harness ch={null} />);
    expect(screen.getByTestId('ready').textContent).toBe('false');
  });

  it('edits a value and notifies onValueChange', async () => {
    const user = userEvent.setup();
    render(<Harness ch={makeChar()} />);
    await user.click(screen.getByText('edit'));
    expect(screen.getByTestId('name').textContent).toBe('Renamed');
    expect(onValueChange).toHaveBeenCalled();
  });

  it('tracks locked count and lockedIds', async () => {
    const user = userEvent.setup();
    render(<Harness ch={makeChar()} />);
    await user.click(screen.getByText('lock'));
    expect(screen.getByTestId('locked').textContent).toBe('1');
    expect(screen.getByTestId('lockedIds').textContent).toBe('name');
  });

  it('patchAll respects the filter (locked field stays un-rolled)', async () => {
    const user = userEvent.setup();
    render(<Harness ch={makeChar()} />);
    await user.click(screen.getByText('lock'));
    await user.click(screen.getByText('roll-unlocked'));
    // name is locked → not rolling, but other fields are → composing true
    expect(screen.getByTestId('composing').textContent).toBe('true');
  });

  it('applyGenerated replaces the value and bumps history', async () => {
    const user = userEvent.setup();
    render(<Harness ch={makeChar()} />);
    expect(screen.getByTestId('name-history').textContent).toBe('1');
    await user.click(screen.getByText('apply'));
    expect(screen.getByTestId('name').textContent).toBe('Gen');
    expect(screen.getByTestId('name-history').textContent).toBe('2');
  });

  it('buildCharacter reflects edits; markAllSaved clears dirty', async () => {
    const user = userEvent.setup();
    render(<Harness ch={makeChar()} />);
    await user.click(screen.getByText('edit'));
    expect(screen.getByTestId('built').textContent).toBe('Renamed');
    await user.click(screen.getByText('dirty'));
    expect(screen.getByTestId('dirty').textContent).toBe('1');
    await user.click(screen.getByText('save'));
    expect(screen.getByTestId('dirty').textContent).toBe('0');
  });

  it('counts tokens (debounced) into the total', async () => {
    render(<Harness ch={makeChar()} />);
    await waitFor(() => expect(mockCountTokens).toHaveBeenCalled());
    await waitFor(() => expect(Number(screen.getByTestId('total').textContent)).toBeGreaterThan(0));
  });

  it('falls back to a length estimate when CountTokens throws', async () => {
    mockCountTokens.mockRejectedValue(new Error('no backend'));
    render(<Harness ch={makeChar({ name: 'A'.repeat(40) })} />);
    await waitFor(() => expect(Number(screen.getByTestId('total').textContent)).toBeGreaterThan(0));
  });

  it('debounces: rapid edits collapse token counting', async () => {
    const user = userEvent.setup();
    render(<Harness ch={makeChar()} />);
    await waitFor(() => expect(mockCountTokens).toHaveBeenCalled());
    mockCountTokens.mockClear();
    await act(async () => {
      await user.click(screen.getByText('edit'));
      await user.click(screen.getByText('dirty'));
    });
    // a single debounced flush, not one per state change
    await waitFor(() => expect(mockCountTokens).toHaveBeenCalled());
  });
});
