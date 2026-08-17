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

vi.mock('../../wailsjs/go/app/App', () => ({
  GetCrawlState: () => mockGetCrawlState(),
  SaveCrawlState: (st: unknown) => mockSaveCrawlState(st),
  SendCrawlResult: (url: string, role: string, overwrite: boolean) =>
    mockSendCrawlResult(url, role, overwrite),
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

  it('shows an empty state with a crawl CTA when nothing matches', async () => {
    mockGetCrawlState.mockResolvedValue(crawlState({ set: { rootUrl: '', results: [] } }));
    const onNav = renderScreen();
    expect(await screen.findByText(/Nothing crawled for this list yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Go to Crawl/ }));
    expect(onNav).toHaveBeenCalledWith('crawler');
  });
});
