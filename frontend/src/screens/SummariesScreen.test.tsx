import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../components/ToastProvider';
import { ConfirmProvider } from '../components/ConfirmDialog';
import SummariesScreen from './SummariesScreen';
import { pageSlug } from '../utils/pageSlug';

const mockGetCrawlState = vi.fn();
const mockSaveCrawlState = vi.fn();
const mockSendCrawlResult = vi.fn();
const mockGetCharacters = vi.fn();
const mockUpdateCrawlSummary = vi.fn();
const mockRemoveCrawlResult = vi.fn();
const mockRefetchCrawlResult = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCrawlState: () => mockGetCrawlState(),
  SaveCrawlState: (st: unknown) => mockSaveCrawlState(st),
  SendCrawlResult: (url: string, role: string, overwrite: boolean) =>
    mockSendCrawlResult(url, role, overwrite),
  GetCharacters: () => mockGetCharacters(),
  UpdateCrawlSummary: (url: string, text: string) => mockUpdateCrawlSummary(url, text),
  RemoveCrawlResult: (url: string) => mockRemoveCrawlResult(url),
  RefetchCrawlResult: (url: string) => mockRefetchCrawlResult(url),
}));

const result = (over: Partial<Record<string, unknown>> = {}) => ({
  title: 'Elara Wynd',
  url: 'https://bg.fandom.com/wiki/Elara_Wynd',
  domain: 'bg.fandom.com',
  rawHtml: '',
  sections: [
    { heading: '', body: 'A half-elf bard on the docks.', level: 1 },
    { heading: 'Personality', body: 'Cheerful in taverns.', level: 2 },
  ],
  infobox: [{ key: 'race', value: 'Half-elf' }],
  wordCount: 120,
  statusCode: 200,
  latencyMs: 80,
  depth: 0,
  isMediaWiki: true,
  ...over,
});

const crawlState = (over: Partial<Record<string, unknown>> = {}) => ({
  url: 'https://bg.fandom.com/wiki/Elara_Wynd',
  followLinks: 1,
  include: { infobox: true },
  selectors: '',
  roles: {
    'https://bg.fandom.com/wiki/Elara_Wynd': 'character',
    'https://bg.fandom.com/wiki/Harpers': 'lorebook',
  },
  sent: {},
  set: {
    rootUrl: 'https://bg.fandom.com/wiki/Elara_Wynd',
    results: [
      result(),
      result({ title: 'Harpers', url: 'https://bg.fandom.com/wiki/Harpers', wordCount: 60 }),
    ],
  },
  ...over,
});

const renderScreen = (onNav = vi.fn()) => {
  render(
    <ToastProvider>
      <ConfirmProvider>
        <SummariesScreen onNav={onNav} />
      </ConfirmProvider>
    </ToastProvider>,
  );
  return onNav;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCrawlState.mockResolvedValue(crawlState());
  mockSaveCrawlState.mockResolvedValue(undefined);
  mockSendCrawlResult.mockResolvedValue({ status: 'created', kind: 'character', name: 'Elara Wynd', result: 'ok' });
  mockGetCharacters.mockResolvedValue([]);
});

describe('pageSlug', () => {
  it('extracts the decoded last path segment, lowercased', () => {
    expect(pageSlug('https://x.fandom.com/wiki/Elara_Wynd')).toBe('elara_wynd');
    expect(pageSlug('https://x.fandom.com/wiki/Kaer%20Morhen')).toBe('kaer morhen');
    expect(pageSlug('')).toBe('');
  });
});

describe('SummariesScreen', () => {
  it('splits results into character and lorebook sub-tabs', async () => {
    renderScreen();
    expect(await screen.findByText('Elara Wynd')).toBeInTheDocument();
    expect(screen.queryByText('Harpers')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Lorebook summaries/ }));
    expect(screen.getByText('Harpers')).toBeInTheDocument();
    expect(screen.queryByText('Elara Wynd')).not.toBeInTheDocument();
  });

  it('buckets by the sent role, not the crawl-screen role plan', async () => {
    // "Mine" was planned as lorebook on the crawl screen but actually sent as
    // a character — it belongs under Character summaries.
    mockGetCrawlState.mockResolvedValue(crawlState({
      roles: { 'https://bg.fandom.com/wiki/Elara_Wynd': 'lorebook' },
      sent: { 'https://bg.fandom.com/wiki/Elara_Wynd': 'character' },
      set: { rootUrl: '', results: [result()] },
    }));
    renderScreen();
    expect(await screen.findByText('Elara Wynd')).toBeInTheDocument();
    expect(screen.getByText('character', { selector: '.sum-link' })).toBeInTheDocument();
  });

  it('links a page to the character it created via sourceUrl', async () => {
    mockGetCrawlState.mockResolvedValue(crawlState({
      roles: { 'https://bg.fandom.com/wiki/Elara_Wynd': 'lorebook' },
      sent: {},
      set: { rootUrl: '', results: [result()] },
    }));
    mockGetCharacters.mockResolvedValue([
      { id: 3, name: 'Elara', sourceUrl: 'https://bg.fandom.com/wiki/Elara_Wynd' },
    ]);
    renderScreen();
    // Bucketed as a character because a character carries this sourceUrl…
    expect(await screen.findByText('Elara Wynd')).toBeInTheDocument();
    // …and the pill names the linked character.
    expect(screen.getByText('→ Elara')).toBeInTheDocument();
    // The card offers the character jump even though the sent map is empty.
    await userEvent.click(screen.getByText('Elara Wynd'));
    expect(screen.getByRole('button', { name: /Open character/ })).toBeInTheDocument();
  });

  it('renders the infobox above the sections, like the crawl preview', async () => {
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    const body = document.querySelector('.sum-card .body')!;
    const infobox = body.querySelector('.infobox');
    const heading = screen.getByText('Personality');
    expect(infobox).toBeTruthy();
    // The infobox precedes the section content in document order.
    expect(infobox!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('edits a summary and saves it through the backend', async () => {
    mockUpdateCrawlSummary.mockResolvedValue(result({
      sections: [{ heading: '', body: 'Rewritten lede.', level: 1 }],
      wordCount: 2,
    }));
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Edit/ }));

    const box = screen.getByLabelText('Summary text');
    // The textarea holds the crawl-format serialisation of the sections.
    expect(box).toHaveValue('A half-elf bard on the docks.\n\n## Personality\nCheerful in taverns.');

    await userEvent.clear(box);
    await userEvent.type(box, 'Rewritten lede.');
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(mockUpdateCrawlSummary).toHaveBeenCalledWith('https://bg.fandom.com/wiki/Elara_Wynd', 'Rewritten lede.');
    });
    expect(await screen.findByText('Summary saved')).toBeInTheDocument();
    // The card re-renders the backend's parsed result.
    expect(screen.getByText(/Rewritten lede/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Summary text')).not.toBeInTheDocument();
  });

  it('cancels an edit without saving', async () => {
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Edit/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockUpdateCrawlSummary).not.toHaveBeenCalled();
    expect(screen.getByText(/A half-elf bard on the docks/)).toBeInTheDocument();
  });

  it('reports a failed summary save', async () => {
    mockUpdateCrawlSummary.mockRejectedValue(new Error('page is no longer in the crawl'));
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Edit/ }));
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    // The editor stays open so the draft is not lost.
    expect(screen.getByLabelText('Summary text')).toBeInTheDocument();
  });

  it('links a staged page to an editor-composed character by name', async () => {
    // The "Mine" scenario: the character was composed in the editor (no
    // sourceUrl stamped), and the page was staged to the lorebook — yet a
    // character named like the page exists, so it is a character summary.
    mockGetCrawlState.mockResolvedValue(crawlState({
      roles: { 'https://bg.fandom.com/wiki/Mine': 'lorebook' },
      sent: { 'https://bg.fandom.com/wiki/Mine': 'lorebook' },
      set: {
        rootUrl: '',
        results: [result({ title: 'Mine', url: 'https://bg.fandom.com/wiki/Mine' })],
      },
    }));
    mockGetCharacters.mockResolvedValue([
      { id: 4, name: ' mine ' }, // no sourceUrl; name matches trimmed, case-insensitively
    ]);
    renderScreen();
    // Appears under Character summaries (the default sub-tab)…
    expect(await screen.findByText('Mine')).toBeInTheDocument();
    // …with the linked-character pill.
    expect(screen.getByText('→ mine')).toBeInTheDocument();
  });

  it('expands a card into its summary body, one at a time', async () => {
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    expect(screen.getByText(/A half-elf bard on the docks/)).toBeInTheDocument();
    expect(screen.getByText('Personality')).toBeInTheDocument();
    expect(screen.getByText('Half-elf')).toBeInTheDocument();

    // Clicking the head again collapses it.
    await userEvent.click(screen.getByText('Elara Wynd'));
    expect(screen.queryByText(/A half-elf bard on the docks/)).not.toBeInTheDocument();
  });

  it('sends a character summary and persists the sent marker', async () => {
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Send to character/ }));

    await waitFor(() => {
      expect(mockSendCrawlResult).toHaveBeenCalledWith('https://bg.fandom.com/wiki/Elara_Wynd', 'character', false);
    });
    expect(await screen.findByText('Sent to character')).toBeInTheDocument();
    expect(mockSaveCrawlState).toHaveBeenCalled();
    expect(screen.getByText('character', { selector: '.sum-link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Re-send to character/ })).toBeInTheDocument();
  });

  it('stages a lorebook summary with the staging toast', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Lorebook summaries/ }));
    await userEvent.click(await screen.findByText('Harpers'));
    await userEvent.click(screen.getByRole('button', { name: /Send to lorebook/ }));

    await waitFor(() => {
      expect(mockSendCrawlResult).toHaveBeenCalledWith('https://bg.fandom.com/wiki/Harpers', 'lorebook', false);
    });
    expect(await screen.findByText('Staged for extraction')).toBeInTheDocument();
  });

  it('re-sends with overwrite after confirmation', async () => {
    mockSendCrawlResult
      .mockResolvedValueOnce({ status: 'needs_confirm', kind: 'character', name: 'Elara Wynd', result: '' })
      .mockResolvedValueOnce({ status: 'overwritten', kind: 'character', name: 'Elara Wynd', result: 'ok' });
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Send to character/ }));

    await userEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));
    await waitFor(() => {
      expect(mockSendCrawlResult).toHaveBeenCalledWith('https://bg.fandom.com/wiki/Elara_Wynd', 'character', true);
    });
    expect(await screen.findByText('Overwrote character')).toBeInTheDocument();
  });

  it('does nothing when the overwrite is cancelled', async () => {
    mockSendCrawlResult.mockResolvedValue({ status: 'needs_confirm', kind: 'character', name: 'Elara Wynd', result: '' });
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Send to character/ }));

    await userEvent.click(await screen.findByRole('button', { name: /^Cancel$/ }));
    expect(mockSendCrawlResult).toHaveBeenCalledTimes(1);
    expect(mockSaveCrawlState).not.toHaveBeenCalled();
  });

  it('reports a vanished page', async () => {
    mockSendCrawlResult.mockResolvedValue({ status: 'missing', kind: '', name: '', result: '' });
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Send to character/ }));
    expect(await screen.findByText('Send failed')).toBeInTheDocument();
  });

  it('reports a failed send', async () => {
    mockSendCrawlResult.mockRejectedValue(new Error('boom'));
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Send to character/ }));
    expect(await screen.findByText('Send failed')).toBeInTheDocument();
  });

  it('copies the summary text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByTitle('Copy summary'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'A half-elf bard on the docks.\n\n## Personality\nCheerful in taverns.',
      );
    });
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('navigates to the character tab from a sent card', async () => {
    mockGetCrawlState.mockResolvedValue(crawlState({
      sent: { 'https://bg.fandom.com/wiki/Elara_Wynd': 'character' },
    }));
    const onNav = renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Open character/ }));
    expect(onNav).toHaveBeenCalledWith('characters');
  });

  it('navigates to the crawler from the header action', async () => {
    const onNav = renderScreen();
    await screen.findByText('Elara Wynd');
    await userEvent.click(screen.getByRole('button', { name: /Crawl more/ }));
    expect(onNav).toHaveBeenCalledWith('crawler');
  });

  it('deletes a page after confirmation and persists the cleaned state', async () => {
    mockRemoveCrawlResult.mockResolvedValue({
      rootUrl: 'https://bg.fandom.com/wiki/Harpers',
      results: [result({ title: 'Harpers', url: 'https://bg.fandom.com/wiki/Harpers', wordCount: 60 })],
    });
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByTitle('Delete page'));

    // Nothing happens until the user confirms.
    expect(mockRemoveCrawlResult).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));

    await waitFor(() => {
      expect(mockRemoveCrawlResult).toHaveBeenCalledWith('https://bg.fandom.com/wiki/Elara_Wynd');
    });
    expect(screen.queryByText('Elara Wynd')).not.toBeInTheDocument();
    // The stale role/sent markers for the deleted page are persisted away.
    await waitFor(() => expect(mockSaveCrawlState).toHaveBeenCalled());
    const saved = mockSaveCrawlState.mock.calls.at(-1)![0];
    expect(saved.roles).not.toHaveProperty('https://bg.fandom.com/wiki/Elara_Wynd');
  });

  it('does not delete when the confirmation is cancelled', async () => {
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByTitle('Delete page'));
    await userEvent.click(await screen.findByRole('button', { name: /^Cancel$/ }));

    expect(mockRemoveCrawlResult).not.toHaveBeenCalled();
    expect(screen.getByText('Elara Wynd')).toBeInTheDocument();
  });

  it('reports a failed delete', async () => {
    mockRemoveCrawlResult.mockRejectedValue(new Error('boom'));
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByTitle('Delete page'));
    await userEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));

    expect(await screen.findByText('Delete failed')).toBeInTheDocument();
    expect(screen.getByText('Elara Wynd')).toBeInTheDocument();
  });

  it('refetches a page after confirmation and shows the fresh summary', async () => {
    mockRefetchCrawlResult.mockResolvedValue(result({
      sections: [{ heading: '', body: 'Fresh from the wiki.', level: 1 }],
      wordCount: 4,
    }));
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Refetch/ }));

    // Nothing happens until the user confirms.
    expect(mockRefetchCrawlResult).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));

    await waitFor(() => {
      expect(mockRefetchCrawlResult).toHaveBeenCalledWith('https://bg.fandom.com/wiki/Elara_Wynd');
    });
    expect(await screen.findByText('Page refetched')).toBeInTheDocument();
    expect(screen.getByText(/Fresh from the wiki/)).toBeInTheDocument();
    expect(screen.queryByText(/A half-elf bard on the docks/)).not.toBeInTheDocument();
  });

  it('does not refetch when the confirmation is cancelled', async () => {
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Refetch/ }));
    await userEvent.click(await screen.findByRole('button', { name: /^Cancel$/ }));

    expect(mockRefetchCrawlResult).not.toHaveBeenCalled();
    expect(screen.getByText(/A half-elf bard on the docks/)).toBeInTheDocument();
  });

  it('reports a failed refetch and keeps the stored summary', async () => {
    mockRefetchCrawlResult.mockRejectedValue(new Error('could not fetch'));
    renderScreen();
    await userEvent.click(await screen.findByText('Elara Wynd'));
    await userEvent.click(screen.getByRole('button', { name: /Refetch/ }));
    await userEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));

    expect(await screen.findByText('Refetch failed')).toBeInTheDocument();
    expect(screen.getByText(/A half-elf bard on the docks/)).toBeInTheDocument();
  });

  it('shows an empty state with a crawl CTA when nothing matches', async () => {
    mockGetCrawlState.mockResolvedValue(crawlState({ set: { rootUrl: '', results: [] } }));
    const onNav = renderScreen();
    expect(await screen.findByText(/Nothing crawled for this list yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Go to Crawl/ }));
    expect(onNav).toHaveBeenCalledWith('crawler');
  });
});
