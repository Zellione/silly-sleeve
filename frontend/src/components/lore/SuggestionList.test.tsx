import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExtractPanel } from './ExtractPanel';
import { useLoreConnections } from './useLoreConnections';
import { ToastProvider } from '../ToastProvider';
import { compose, lorebook, loreextract } from '../../../wailsjs/go/models';

const mockGetLorebookSuggestions = vi.fn();
const mockSuggestLorebookConnections = vi.fn();
const mockApplyLorebookSuggestions = vi.fn();

vi.mock('../../../wailsjs/go/app/App', () => ({
  GetStagedSources: () => Promise.resolve([]),
  GetLorebookCandidates: () => Promise.resolve([]),
  SetStagedSourceMode: () => Promise.resolve([]),
  RemoveStagedSource: () => Promise.resolve([]),
  ExtractLorebookCandidates: () => Promise.resolve([]),
  DiscardLorebookCandidates: () => Promise.resolve([]),
  ApproveLorebookCandidates: () => Promise.resolve([]),
  GetLorebookSuggestions: () => mockGetLorebookSuggestions(),
  SuggestLorebookConnections: () => mockSuggestLorebookConnections(),
  ApplyLorebookSuggestions: (...a: any[]) => mockApplyLorebookSuggestions(...a),
}));

const characters = [
  compose.Character.createFrom({ id: 1, name: 'Alistair', relationships: 'Wary of Loghain.' }),
  compose.Character.createFrom({ id: 2, name: 'Duncan' }),
];

const entries = [
  lorebook.Entry.createFrom({ uid: 1, comment: 'Denerim', key: ['Denerim'] }),
  lorebook.Entry.createFrom({ uid: 2, comment: 'Grey Wardens', key: ['Grey Warden'] }),
];

const suggestion = (over: Partial<any> = {}) =>
  loreextract.Suggestion.createFrom({ selected: true, rationale: 'because', ...over });

/** Renders the panel wired to the real connections hook, as the screen does. */
const Harness: React.FC<{ onApplied?: (e: any, c: any) => void }> = ({ onApplied = vi.fn() }) => {
  const connections = useLoreConnections(onApplied);
  return (
    <>
      <button onClick={connections.suggest}>Suggest connections</button>
      <ExtractPanel
        characters={characters}
        onEntriesChanged={vi.fn()}
        connections={{
          suggestions: connections.suggestions,
          entries,
          onChange: connections.updateSuggestion,
          onApply: connections.apply,
          onDismiss: connections.dismiss,
        }}
      />
    </>
  );
};

const renderHarness = (onApplied?: (e: any, c: any) => void) =>
  render(<ToastProvider><Harness onApplied={onApplied} /></ToastProvider>);

describe('connection review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLorebookSuggestions.mockResolvedValue([]);
    mockSuggestLorebookConnections.mockResolvedValue([]);
    mockApplyLorebookSuggestions.mockResolvedValue({ lorebook: [], characters: [], staged: [], activeCharId: 0 });
  });

  it('groups suggestions by kind and names the things they touch', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'triggerKeys', entryUid: 1, addKeys: ['the capital'] }),
      suggestion({ kind: 'entryCharacter', entryUid: 1, addCharacters: ['1'] }),
      suggestion({ kind: 'entryEntry', entryUid: 1, targetUid: 2, addSecondary: ['Grey Warden'] }),
    ]);
    renderHarness();

    expect(await screen.findByText('Add trigger keys')).toBeInTheDocument();
    expect(screen.getByText('Scope to characters')).toBeInTheDocument();
    expect(screen.getByText('Link entries')).toBeInTheDocument();

    // Entries and characters are named, not shown as raw ids.
    expect(screen.getAllByText('Denerim').length).toBeGreaterThan(0);
    expect(screen.getByText('Grey Wardens')).toBeInTheDocument();
    expect(screen.getByText(/Alistair/)).toBeInTheDocument();
  });

  it('resolves a character id string to its name', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'entryCharacter', entryUid: 1, addCharacters: ['2'] }),
    ]);
    renderHarness();

    expect(await screen.findByText(/Duncan/)).toBeInTheDocument();
    expect(screen.queryByText(/character 2/)).not.toBeInTheDocument();
  });

  it('shows the current relationship text beside the proposal', async () => {
    // The proposal replaces prose that may be hand-written, so the user has to
    // see what would be lost.
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({
        kind: 'characterCharacter', charId: 1, targetCharId: 2,
        currentRelationships: 'Wary of Loghain.',
        proposedRelationships: 'Wary of Loghain. Mentored by Duncan.',
      }),
    ]);
    renderHarness();

    expect(await screen.findByText('Wary of Loghain.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Proposed relationships for Alistair/i))
      .toHaveValue('Wary of Loghain. Mentored by Duncan.');
  });

  it('lets the proposed relationship text be edited before applying', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({
        kind: 'characterCharacter', charId: 1, targetCharId: 2,
        currentRelationships: '', proposedRelationships: 'Mentored by Duncan.',
      }),
    ]);
    const user = userEvent.setup();
    renderHarness();

    const box = await screen.findByLabelText(/Proposed relationships for Alistair/i);
    await user.clear(box);
    await user.type(box, 'Recruited by Duncan.');
    await user.click(screen.getByRole('button', { name: /Apply 1/i }));

    await waitFor(() => expect(mockApplyLorebookSuggestions).toHaveBeenCalled());
    expect(mockApplyLorebookSuggestions.mock.calls[0][0][0].proposedRelationships)
      .toBe('Recruited by Duncan.');
  });

  it('applies only the suggestions left ticked', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'triggerKeys', entryUid: 1, addKeys: ['the capital'] }),
      suggestion({ kind: 'triggerKeys', entryUid: 2, addKeys: ['the order'] }),
    ]);
    const user = userEvent.setup();
    renderHarness();
    await screen.findByText('Add trigger keys');

    await user.click(screen.getAllByRole('checkbox')[1]);
    expect(screen.getByRole('button', { name: /Apply 1/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Apply 1/i }));
    await waitFor(() => expect(mockApplyLorebookSuggestions).toHaveBeenCalled());

    const sent = mockApplyLorebookSuggestions.mock.calls[0][0];
    expect(sent.filter((s: any) => s.selected)).toHaveLength(1);
  });

  it('cannot apply when everything is unticked', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'triggerKeys', entryUid: 1, addKeys: ['x'], selected: false }),
    ]);
    renderHarness();

    expect(await screen.findByRole('button', { name: /Nothing selected/i })).toBeDisabled();
  });

  it('hands the updated entries and characters back', async () => {
    const onApplied = vi.fn();
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'triggerKeys', entryUid: 1, addKeys: ['the capital'] }),
    ]);
    mockApplyLorebookSuggestions.mockResolvedValue({
      lorebook: [{ uid: 1, comment: 'Denerim' }],
      characters: [{ id: 1, name: 'Alistair' }],
      staged: [], activeCharId: 1,
    });
    const user = userEvent.setup();
    renderHarness(onApplied);
    await screen.findByText('Add trigger keys');

    await user.click(screen.getByRole('button', { name: /Apply 1/i }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(
      [{ uid: 1, comment: 'Denerim' }],
      [{ id: 1, name: 'Alistair' }],
    ));
  });

  it('dismisses without applying anything', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'triggerKeys', entryUid: 1, addKeys: ['x'] }),
    ]);
    const user = userEvent.setup();
    renderHarness();
    await screen.findByText('Add trigger keys');

    await user.click(screen.getByRole('button', { name: /Dismiss all/i }));

    expect(mockApplyLorebookSuggestions).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Add trigger keys')).not.toBeInTheDocument());
  });

  it('says so when the pass finds nothing', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'Suggest connections' }));

    expect(await screen.findByText('No new connections')).toBeInTheDocument();
  });

  it('surfaces a failed pass', async () => {
    mockSuggestLorebookConnections.mockRejectedValue(new Error('context too small'));
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'Suggest connections' }));

    expect(await screen.findByText('Could not suggest connections')).toBeInTheDocument();
    expect(screen.getByText('context too small')).toBeInTheDocument();
  });

  it('replaces the candidate pane while suggestions are pending', async () => {
    mockGetLorebookSuggestions.mockResolvedValue([
      suggestion({ kind: 'triggerKeys', entryUid: 1, addKeys: ['x'] }),
    ]);
    renderHarness();

    expect(await screen.findByText('Suggested connections')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to review yet.')).not.toBeInTheDocument();
  });
});
