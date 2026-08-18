import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExtractPanel } from './ExtractPanel';
import { ToastProvider } from '../ToastProvider';
import { compose } from '../../../wailsjs/go/models';

const mockGetStagedSources = vi.fn();
const mockGetLorebookCandidates = vi.fn();
const mockSetStagedSourceMode = vi.fn();
const mockSetStagedSourceStyle = vi.fn();
const mockRemoveStagedSource = vi.fn();
const mockExtractLorebookCandidates = vi.fn();
const mockDiscardLorebookCandidates = vi.fn();
const mockApproveLorebookCandidates = vi.fn();

vi.mock('../../../wailsjs/go/app/App', () => ({
  GetStagedSources: () => mockGetStagedSources(),
  GetLorebookCandidates: () => mockGetLorebookCandidates(),
  SetStagedSourceMode: (...a: any[]) => mockSetStagedSourceMode(...a),
  SetStagedSourceStyle: (...a: any[]) => mockSetStagedSourceStyle(...a),
  RemoveStagedSource: (...a: any[]) => mockRemoveStagedSource(...a),
  ExtractLorebookCandidates: (...a: any[]) => mockExtractLorebookCandidates(...a),
  DiscardLorebookCandidates: (...a: any[]) => mockDiscardLorebookCandidates(...a),
  ApproveLorebookCandidates: (...a: any[]) => mockApproveLorebookCandidates(...a),
}));

const LORE_URL = 'https://w/wiki/Ferelden';

const source = (over: Partial<any> = {}) => ({
  url: LORE_URL, title: 'Ferelden', mode: 'split', style: 'prose', extracted: false, ...over,
});

const candidate = (over: Partial<any> = {}) => ({
  sourceUrl: LORE_URL,
  selected: true,
  adjustments: [],
  entry: {
    uid: 0, comment: 'Denerim', category: 'location',
    key: ['Denerim', 'the capital'], keysecondary: [],
    content: 'The capital sprawls along the coast.', order: 320,
    characters: [], constant: false, selective: false,
  },
  ...over,
});

const characters = [
  compose.Character.createFrom({ id: 1, name: 'Alistair' }),
  compose.Character.createFrom({ id: 2, name: 'Duncan' }),
];

const renderPanel = (onChanged = vi.fn(), onPersist?: () => void) =>
  render(
    <ToastProvider>
      <ExtractPanel characters={characters} onEntriesChanged={onChanged} onPersist={onPersist} />
    </ToastProvider>,
  );

describe('ExtractPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStagedSources.mockResolvedValue([source()]);
    mockGetLorebookCandidates.mockResolvedValue([]);
    mockSetStagedSourceMode.mockResolvedValue([source({ mode: 'summary' })]);
    mockSetStagedSourceStyle.mockResolvedValue([source({ style: 'factual' })]);
    mockRemoveStagedSource.mockResolvedValue([]);
    mockExtractLorebookCandidates.mockResolvedValue([candidate()]);
    mockDiscardLorebookCandidates.mockResolvedValue([]);
    mockApproveLorebookCandidates.mockResolvedValue([]);
  });

  it('lists staged sources and selects the first', async () => {
    renderPanel();
    expect(await screen.findByText('Ferelden')).toBeInTheDocument();
    expect(screen.getByText('Not yet extracted')).toBeInTheDocument();
  });

  it('explains the empty state instead of showing a bare list', async () => {
    mockGetStagedSources.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('No pages staged.')).toBeInTheDocument();
  });

  it('extracts on demand and renders the candidates', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));

    await waitFor(() => expect(mockExtractLorebookCandidates).toHaveBeenCalledWith(LORE_URL));
    expect(await screen.findByRole('checkbox', { name: /Keep Denerim/i })).toBeInTheDocument();
    expect(screen.getByText('the capital')).toBeInTheDocument();
  });

  it('surfaces an extraction failure instead of failing silently', async () => {
    mockExtractLorebookCandidates.mockRejectedValue(new Error('connection refused'));
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));

    // The failure shows twice by design: transient toast + persistent pane.
    expect((await screen.findAllByText(/Extraction failed/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('connection refused').length).toBeGreaterThanOrEqual(1);
  });

  it('surfaces the Go error text when the backend rejects with a plain string', async () => {
    // Wails rejects promises with the Go error as a bare string, not an Error.
    mockExtractLorebookCandidates.mockRejectedValue('llm complete: http request: context deadline exceeded');
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));

    expect((await screen.findAllByText(/Extraction failed/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('llm complete: http request: context deadline exceeded').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the adjustments the normaliser made', async () => {
    mockGetLorebookCandidates.mockResolvedValue([
      candidate({ adjustments: ['Dropped generic keywords: sword.'] }),
    ]);
    renderPanel();

    expect(await screen.findByText('Dropped generic keywords: sword.')).toBeInTheDocument();
  });

  it('flags a candidate that could never trigger', async () => {
    mockGetLorebookCandidates.mockResolvedValue([
      candidate({ entry: { ...candidate().entry, key: [] } }),
    ]);
    renderPanel();

    expect(await screen.findByText(/no keys — cannot trigger/i)).toBeInTheDocument();
  });

  it('sends only the ticked candidates for approval', async () => {
    mockGetLorebookCandidates.mockResolvedValue([
      candidate(),
      candidate({ entry: { ...candidate().entry, comment: 'The Blight' } }),
    ]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getByRole('checkbox', { name: /Keep The Blight/i }));
    await user.click(screen.getByRole('button', { name: /Add 1 to lorebook/i }));

    await waitFor(() => expect(mockApproveLorebookCandidates).toHaveBeenCalled());
    const sent = mockApproveLorebookCandidates.mock.calls[0][0];
    expect(sent).toHaveLength(2);
    expect(sent.filter((c: any) => c.selected)).toHaveLength(1);
    expect(sent.find((c: any) => c.selected).entry.comment).toBe('Denerim');
  });

  it('says how many candidates approving will discard', async () => {
    mockGetLorebookCandidates.mockResolvedValue([candidate(), candidate()]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getAllByRole('checkbox', { name: /Keep Denerim/i })[1]);

    expect(screen.getByRole('button', { name: /Add 1 to lorebook · discard 1/i })).toBeInTheDocument();
  });

  it('cannot approve when nothing is selected', async () => {
    mockGetLorebookCandidates.mockResolvedValue([candidate({ selected: false })]);
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    expect(screen.getByRole('button', { name: /Nothing selected/i })).toBeDisabled();
  });

  it('keeps candidate edits local until approval', async () => {
    mockGetLorebookCandidates.mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getByRole('button', { expanded: false }));
    const title = await screen.findByLabelText('Title for candidate 1');
    await user.clear(title);
    await user.type(title, 'Denerim, the capital');

    // Nothing is pushed to the backend while editing.
    expect(mockApproveLorebookCandidates).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Add 1 to lorebook/i }));
    await waitFor(() => expect(mockApproveLorebookCandidates).toHaveBeenCalled());
    expect(mockApproveLorebookCandidates.mock.calls[0][0][0].entry.comment).toBe('Denerim, the capital');
  });

  it('scopes a candidate to a character by id, not name', async () => {
    mockGetLorebookCandidates.mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(await screen.findByRole('button', { name: 'Alistair' }));
    await user.click(screen.getByRole('button', { name: /Add 1 to lorebook/i }));

    await waitFor(() => expect(mockApproveLorebookCandidates).toHaveBeenCalled());
    expect(mockApproveLorebookCandidates.mock.calls[0][0][0].entry.characters).toEqual(['1']);
  });

  it('hands approved entries back to the screen', async () => {
    const onChanged = vi.fn();
    mockGetLorebookCandidates.mockResolvedValue([candidate()]);
    mockApproveLorebookCandidates.mockResolvedValue([{ uid: 0, comment: 'Denerim' }]);
    const user = userEvent.setup();
    renderPanel(onChanged);
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getByRole('button', { name: /Add 1 to lorebook/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith([{ uid: 0, comment: 'Denerim' }]));
  });

  it('removes the staged page once its candidates are approved', async () => {
    mockGetLorebookCandidates.mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getByRole('button', { name: /Add 1 to lorebook/i }));

    expect(await screen.findByText('No pages staged.')).toBeInTheDocument();
  });

  it('changes the extraction mode', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('combobox', { name: /Extraction mode/i }));
    await user.click(await screen.findByRole('option', { name: 'Single summary' }));

    await waitFor(() => expect(mockSetStagedSourceMode).toHaveBeenCalledWith(LORE_URL, 'summary'));
  });

  it('changes the content style', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('combobox', { name: /Content style/i }));
    await user.click(await screen.findByRole('option', { name: 'Dense & factual' }));

    await waitFor(() => expect(mockSetStagedSourceStyle).toHaveBeenCalledWith(LORE_URL, 'factual'));
  });

  it('notifies onPersist after a style change', async () => {
    const onPersist = vi.fn();
    const user = userEvent.setup();
    renderPanel(vi.fn(), onPersist);
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('combobox', { name: /Content style/i }));
    await user.click(await screen.findByRole('option', { name: 'Dense & factual' }));

    await waitFor(() => expect(onPersist).toHaveBeenCalled());
  });

  it('keeps the failure reason visible in the review pane after a failed extraction', async () => {
    mockExtractLorebookCandidates.mockRejectedValue(new Error('connection refused'));
    const user = userEvent.setup();
    const { container } = renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));

    // The reason stays in the candidate pane (unlike the transient toast), so
    // the user can still read it after the toast is gone.
    const pane = () => container.querySelector('.lore-cands');
    await waitFor(() => expect(pane()?.textContent).toContain('connection refused'));
    expect(pane()?.textContent).toContain('Extraction failed');
  });

  it('clears the failure reason when a retry starts', async () => {
    mockExtractLorebookCandidates
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce([candidate()]);
    const user = userEvent.setup();
    const { container } = renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));
    await waitFor(() => expect(container.querySelector('.lore-cands')?.textContent).toContain('connection refused'));

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });
    expect(container.querySelector('.lore-cands')?.textContent).not.toContain('connection refused');
  });

  it('notifies onPersist after a successful extraction', async () => {
    const onPersist = vi.fn();
    const user = userEvent.setup();
    renderPanel(vi.fn(), onPersist);
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));

    await waitFor(() => expect(onPersist).toHaveBeenCalled());
  });

  it('does not notify onPersist when extraction fails', async () => {
    mockExtractLorebookCandidates.mockRejectedValue(new Error('boom'));
    const onPersist = vi.fn();
    const user = userEvent.setup();
    renderPanel(vi.fn(), onPersist);
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Extract facts/i }));

    await screen.findByText('Extraction failed');
    expect(onPersist).not.toHaveBeenCalled();
  });

  it('notifies onPersist after a mode change', async () => {
    const onPersist = vi.fn();
    const user = userEvent.setup();
    renderPanel(vi.fn(), onPersist);
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('combobox', { name: /Extraction mode/i }));
    await user.click(await screen.findByRole('option', { name: 'Single summary' }));

    await waitFor(() => expect(onPersist).toHaveBeenCalled());
  });

  it('notifies onPersist after removing a staged source', async () => {
    const onPersist = vi.fn();
    const user = userEvent.setup();
    renderPanel(vi.fn(), onPersist);
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Remove Ferelden/i }));

    await waitFor(() => expect(onPersist).toHaveBeenCalled());
  });

  it('discards a page\'s candidates but keeps it staged', async () => {
    mockGetLorebookCandidates.mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByRole('checkbox', { name: /Keep Denerim/i });

    await user.click(screen.getByRole('button', { name: /Discard all/i }));

    await waitFor(() => expect(mockDiscardLorebookCandidates).toHaveBeenCalledWith(LORE_URL));
    expect(await screen.findByText('Ferelden')).toBeInTheDocument();
  });

  it('removes a staged source', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ferelden');

    await user.click(screen.getByRole('button', { name: /Remove Ferelden/i }));

    await waitFor(() => expect(mockRemoveStagedSource).toHaveBeenCalledWith(LORE_URL));
    expect(await screen.findByText('No pages staged.')).toBeInTheDocument();
  });

  it('marks a source that already has candidates awaiting review', async () => {
    mockGetStagedSources.mockResolvedValue([source({ extracted: true })]);
    mockGetLorebookCandidates.mockResolvedValue([candidate(), candidate()]);
    renderPanel();

    const list = await screen.findByText('Ferelden');
    expect(within(list.closest('button')!).getByText('2 awaiting review')).toBeInTheDocument();
  });

  it('offers to extract again once a page is done', async () => {
    mockGetStagedSources.mockResolvedValue([source({ extracted: true })]);
    renderPanel();

    expect(await screen.findByRole('button', { name: /Extract again/i })).toBeInTheDocument();
  });
});
