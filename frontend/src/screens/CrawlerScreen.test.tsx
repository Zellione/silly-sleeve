import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CrawlerScreen from './CrawlerScreen';
import { ToastProvider } from '../components/ToastProvider';
import { ConfirmProvider } from '../components/ConfirmDialog';
import { crawler } from '../../wailsjs/go/models';

const mockCrawlPage = vi.fn();
const mockGetCrawlState = vi.fn();
const mockSaveCrawlState = vi.fn();
const mockClearCrawl = vi.fn();
const mockSendCrawlResult = vi.fn();
const mockRemoveCrawlResult = vi.fn();
const mockSaveProjectBundle = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  CrawlPage: (...args: any[]) => mockCrawlPage(...args),
  GetCrawlState: () => mockGetCrawlState(),
  SaveCrawlState: (...args: any[]) => mockSaveCrawlState(...args),
  ClearCrawl: () => mockClearCrawl(),
  SendCrawlResult: (...args: any[]) => mockSendCrawlResult(...args),
  RemoveCrawlResult: (...args: any[]) => mockRemoveCrawlResult(...args),
  SaveProjectBundle: (...args: any[]) => mockSaveProjectBundle(...args),
}));

const sampleResult: crawler.CrawlResult = new crawler.CrawlResult({
  title: 'elara_wynd',
  url: 'https://baldursgate.fandom.com/wiki/Elara_Wynd',
  domain: 'baldursgate.fandom.com',
  rawHtml: '',
  sections: [
    new crawler.Section({ heading: 'Elara Wynd', body: 'A half-elf bard.', level: 1 }),
    new crawler.Section({ heading: 'Appearance', body: 'Wears a leather doublet.', level: 2 }),
  ],
  infobox: [
    new crawler.InfoboxEntry({ key: 'race', value: 'Half-elf' }),
    new crawler.InfoboxEntry({ key: 'class', value: 'Bard' }),
  ],
  wordCount: 1842,
  statusCode: 200,
  latencyMs: 412,
  depth: 0,
  isMediaWiki: true,
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider>);

describe('CrawlerScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCrawlState.mockResolvedValue({ url: '', followLinks: 0, include: {}, selectors: '', roles: {}, sent: {}, set: null });
    mockSaveCrawlState.mockResolvedValue(undefined);
    mockClearCrawl.mockResolvedValue(undefined);
    mockSaveProjectBundle.mockResolvedValue(undefined);
    mockSendCrawlResult.mockResolvedValue({ status: 'created', kind: 'character', name: 'A', result: { characters: [], lorebook: [], activeCharId: 1 } });
  });

  it('renders URL input with default value', () => {
    renderWithProviders(<CrawlerScreen />);
    const input = screen.getByPlaceholderText('https://wiki.fandom.com/wiki/Page_name') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toContain('baldursgate.fandom.com');
  });

  it('renders recent wiki chips', () => {
    renderWithProviders(<CrawlerScreen />);
    expect(screen.getByText('baldursgate.fandom.com')).toBeInTheDocument();
    expect(screen.getByText('witcher.fandom.com')).toBeInTheDocument();
    expect(screen.getByText('finalfantasy.fandom.com')).toBeInTheDocument();
  });

  it('renders crawl options', () => {
    renderWithProviders(<CrawlerScreen />);
    expect(screen.getByText('Follow links')).toBeInTheDocument();
    expect(screen.getByText('Include')).toBeInTheDocument();
    expect(screen.getByText('infobox')).toBeInTheDocument();
    expect(screen.getByText('quotes')).toBeInTheDocument();
    expect(screen.getByText('trivia')).toBeInTheDocument();
    expect(screen.getByText('gallery')).toBeInTheDocument();
  });

  it('renders "Crawl page" button', () => {
    renderWithProviders(<CrawlerScreen />);
    expect(screen.getByText('Crawl page')).toBeInTheDocument();
  });

  it('disables "Save crawl" when there are no results', () => {
    renderWithProviders(<CrawlerScreen />);
    const saveBtn = screen.getByText('Save crawl').closest('button')!;
    expect(saveBtn).toBeDisabled();
    // The bulk "Send to project" button has been removed in favour of per-row sends.
    expect(screen.queryByText(/Send to project/i)).not.toBeInTheDocument();
  });

  it('shows idle preview state', () => {
    renderWithProviders(<CrawlerScreen />);
    expect(screen.getByText('No page crawled')).toBeInTheDocument();
  });

  it('calls CrawlPage binding on "Crawl page" click', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(mockCrawlPage).toHaveBeenCalledTimes(1);
    });
    expect(mockCrawlPage).toHaveBeenCalledWith(
      expect.stringContaining('baldursgate.fandom.com'),
      expect.objectContaining({ followLinks: 0 }),
    );
  });

  it('shows fetching state during crawl', async () => {
    let resolvePromise: (v: any) => void;
    const promise = new Promise<any>(r => { resolvePromise = r; });
    mockCrawlPage.mockReturnValue(promise);

    renderWithProviders(<CrawlerScreen />);
    screen.getByText('Crawl page').click();

    await waitFor(() => {
      const fetchingElements = screen.getAllByText('Fetching…');
      expect(fetchingElements.length).toBeGreaterThanOrEqual(2);
    });

    resolvePromise!(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
  });

  it('displays crawl result in preview after successful crawl', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Half-elf')).toBeInTheDocument();
    });
    expect(screen.getByText('A half-elf bard.')).toBeInTheDocument();
    expect(screen.getByText('1,842 words · 2 sections')).toBeInTheDocument();
  });

  it('shows "Re-crawl" button after successful crawl', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Re-crawl')).toBeInTheDocument();
    });
  });

  it('shows toast on crawl failure', async () => {
    mockCrawlPage.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Crawl failed')).toBeInTheDocument();
    });
  });

  it('updates URL on input change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    const input = screen.getByPlaceholderText('https://wiki.fandom.com/wiki/Page_name') as HTMLInputElement;

    await user.clear(input);
    await user.type(input, 'https://new.wiki.com/wiki/Test');

    expect(input.value).toBe('https://new.wiki.com/wiki/Test');
  });

  it('sets URL when clicking a recent wiki chip', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('witcher.fandom.com'));

    const input = screen.getByPlaceholderText('https://wiki.fandom.com/wiki/Page_name') as HTMLInputElement;
    expect(input.value).toBe('https://witcher.fandom.com/wiki/');
  });

  it('toggles include checkboxes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    const triviaCheckbox = screen.getByText('trivia').closest('label')!.querySelector('input')!;
    expect(triviaCheckbox).not.toBeChecked();

    await user.click(triviaCheckbox);
    expect(triviaCheckbox).toBeChecked();
  });

  it('renders infobox entries in preview', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Half-elf')).toBeInTheDocument();
      expect(screen.getByText('Bard')).toBeInTheDocument();
    });
  });

  it('renders section tags in preview', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('lede')).toBeInTheDocument();
    });
  });

  it('displays footer metadata after crawl', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText(/412 ms/)).toBeInTheDocument();
      expect(screen.getByText(/~3,131 tokens/)).toBeInTheDocument();
    });
  });

  it('shows footer with cold cache when no result', () => {
    renderWithProviders(<CrawlerScreen />);
    expect(screen.getByText(/cold/)).toBeInTheDocument();
  });

  it('handles result with no sections gracefully', async () => {
    const emptyResult = new crawler.CrawlResult({
      title: 'empty', url: '', domain: '', rawHtml: '',
      sections: [], infobox: [], wordCount: 0, statusCode: 200, latencyMs: 0,
      isMediaWiki: true,
    });
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: emptyResult.url,
      results: [emptyResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText(/0 words/)).toBeInTheDocument();
    });
  });

  it('shows 0 token estimate for empty result', async () => {
    const emptyResult = new crawler.CrawlResult({
      title: 'empty', url: '', domain: '', rawHtml: '',
      sections: [], infobox: [], wordCount: 0, statusCode: 200, latencyMs: 0,
      isMediaWiki: true,
    });
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: emptyResult.url,
      results: [emptyResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText(/~0 tokens/)).toBeInTheDocument();
    });
  });

  it('does not show infobox when empty', async () => {
    const noInfoResult = new crawler.CrawlResult({
      title: 'simple', url: '', domain: '', rawHtml: '',
      sections: [new crawler.Section({ heading: 'Main', body: 'Body text', level: 2 })],
      infobox: [],
      wordCount: 5, statusCode: 200, latencyMs: 100,
      isMediaWiki: true,
    });
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: noInfoResult.url,
      results: [noInfoResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Main')).toBeInTheDocument();
      expect(screen.getByText('Body text')).toBeInTheDocument();
    });
  });

  it('renders body paragraphs separated by double newline', async () => {
    const multiPara = new crawler.CrawlResult({
      title: 'multi', url: '', domain: '', rawHtml: '',
      sections: [
        new crawler.Section({ heading: 'Appearance', body: 'First paragraph.\n\nSecond paragraph.', level: 2 }),
      ],
      infobox: [],
      wordCount: 5, statusCode: 200, latencyMs: 100,
      isMediaWiki: true,
    });
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: multiPara.url,
      results: [multiPara],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('First paragraph.')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    });
  });

  it('renders infobox section headers when section changes', async () => {
    const sectionResult = new crawler.CrawlResult({
      title: 'sectioned', url: '', domain: '', rawHtml: '',
      sections: [],
      infobox: [
        new crawler.InfoboxEntry({ key: 'race', value: 'Elf', section: 'Info' }),
        new crawler.InfoboxEntry({ key: 'class', value: 'Mage', section: 'Info' }),
        new crawler.InfoboxEntry({ key: 'hp', value: '100', section: 'Combat' }),
      ],
      wordCount: 5, statusCode: 200, latencyMs: 100,
      isMediaWiki: true,
    });
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sectionResult.url,
      results: [sectionResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Info')).toBeInTheDocument();
      expect(screen.getByText('Combat')).toBeInTheDocument();
      expect(screen.getByText('Elf')).toBeInTheDocument();
      expect(screen.getByText('Mage')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
    const sectionHeaders = screen.getAllByText(/^(Info|Combat)$/);
    expect(sectionHeaders).toHaveLength(2);
  });

  it('renders one result row per crawled page and assigns roles', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: 'https://w/wiki/A',
      results: [
        new crawler.CrawlResult({
          url: 'https://w/wiki/A', title: 'A', domain: 'w', depth: 0, wordCount: 100,
          rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
          isMediaWiki: true,
        }),
        new crawler.CrawlResult({
          url: 'https://w/wiki/B', title: 'B', domain: 'w', depth: 1, wordCount: 50,
          rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
          isMediaWiki: true,
        }),
      ],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    // Find the results section which contains the result rows
    const resultsSection = await screen.findByText('Results');
    const resultsContainer = resultsSection.closest('div')?.nextElementSibling;
    expect(resultsContainer?.textContent).toContain('A');
    expect(resultsContainer?.textContent).toContain('B');
  });

  const singleResultSet = () => new crawler.CrawlSet({
    rootUrl: 'https://w/wiki/A',
    results: [
      new crawler.CrawlResult({
        url: 'https://w/wiki/A', title: 'A', domain: 'w', depth: 0, wordCount: 100,
        rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
        isMediaWiki: true,
      }),
    ],
  });

  it('sends a single row to the backend per its dropdown role and marks it sent', async () => {
    mockCrawlPage.mockResolvedValue(singleResultSet());
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    await screen.findByText('Results');

    // Row 0 defaults to the character role.
    await user.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => expect(mockSendCrawlResult).toHaveBeenCalledWith('https://w/wiki/A', 'character', false));
    // The row is marked sent: the button flips to "Re-send".
    await waitFor(() => expect(screen.getByRole('button', { name: /^Re-send$/i })).toBeInTheDocument());
  });

  it('prompts to overwrite a duplicate and re-sends with overwrite=true on confirm', async () => {
    mockCrawlPage.mockResolvedValue(singleResultSet());
    mockSendCrawlResult
      .mockResolvedValueOnce({ status: 'needs_confirm', kind: 'character', name: 'A', result: { characters: [], lorebook: [], activeCharId: 0 } })
      .mockResolvedValueOnce({ status: 'overwritten', kind: 'character', name: 'A', result: { characters: [], lorebook: [], activeCharId: 1 } });
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    await screen.findByText('Results');

    await user.click(screen.getByRole('button', { name: /^Send$/i }));

    // Confirmation dialog appears.
    const confirmBtn = await screen.findByRole('button', { name: /^Confirm$/i });
    await user.click(confirmBtn);

    await waitFor(() => expect(mockSendCrawlResult).toHaveBeenNthCalledWith(2, 'https://w/wiki/A', 'character', true));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Re-send$/i })).toBeInTheDocument());
  });

  it('does not overwrite when the user cancels the duplicate prompt', async () => {
    mockCrawlPage.mockResolvedValue(singleResultSet());
    mockSendCrawlResult.mockResolvedValueOnce({ status: 'needs_confirm', kind: 'character', name: 'A', result: { characters: [], lorebook: [], activeCharId: 0 } });
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    await screen.findByText('Results');

    await user.click(screen.getByRole('button', { name: /^Send$/i }));
    const cancelBtn = await screen.findByRole('button', { name: /^Cancel$/i });
    await user.click(cancelBtn);

    // Only the first (probe) call happened; no overwrite, row not marked sent.
    expect(mockSendCrawlResult).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Re-send$/i })).not.toBeInTheDocument();
  });

  it('removes a page from the crawled list via RemoveCrawlResult', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: 'https://w/wiki/A',
      results: [
        new crawler.CrawlResult({
          url: 'https://w/wiki/A', title: 'Alpha', domain: 'w', depth: 0, wordCount: 100,
          rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
          isMediaWiki: true,
        }),
        new crawler.CrawlResult({
          url: 'https://w/wiki/B', title: 'Beta', domain: 'w', depth: 1, wordCount: 50,
          rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
          isMediaWiki: true,
        }),
      ],
    }));
    // Backend returns the set with Beta removed.
    mockRemoveCrawlResult.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: 'https://w/wiki/A',
      results: [
        new crawler.CrawlResult({
          url: 'https://w/wiki/A', title: 'Alpha', domain: 'w', depth: 0, wordCount: 100,
          rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
          isMediaWiki: true,
        }),
      ],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    await screen.findByText('Beta');

    await user.click(screen.getByRole('button', { name: /remove beta/i }));

    await waitFor(() => expect(mockRemoveCrawlResult).toHaveBeenCalledWith('https://w/wiki/B'));
    await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument());
    // Alpha remains (shown in both the result row and the preview header).
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  });

  it('removing the only crawled page resets to the empty state without crashing', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: 'https://w/wiki/Only',
      results: [
        new crawler.CrawlResult({
          url: 'https://w/wiki/Only', title: 'OnlyPage', domain: 'w', depth: 0, wordCount: 10,
          rawHtml: '', sections: [], infobox: [], statusCode: 200, latencyMs: 0,
          isMediaWiki: true,
        }),
      ],
    }));
    // Backend returns an empty set (nil Results serialises to null over the bridge).
    mockRemoveCrawlResult.mockResolvedValue({ rootUrl: 'https://w/wiki/Only', results: null });
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    const removeBtn = await screen.findByRole('button', { name: /remove onlypage/i });

    await user.click(removeBtn);

    // No crash: the empty state and the idle "Crawl page" button are shown again.
    await waitFor(() => expect(screen.queryByText('Results')).not.toBeInTheDocument());
    expect(screen.getByText('Crawl page')).toBeInTheDocument();
    expect(screen.getByText(/Enter a wiki URL/i)).toBeInTheDocument();
  });

  it('restores the crawl list and params from backend state on mount', async () => {
    mockGetCrawlState.mockResolvedValue({
      url: 'https://w/wiki/Saved',
      followLinks: 2,
      include: { infobox: true, quotes: false, trivia: false, gallery: false },
      selectors: '.foo',
      roles: { 'https://w/wiki/Saved': 'character', 'https://w/wiki/Hop': 'lorebook' },
      sent: { 'https://w/wiki/Saved': 'character' },
      set: {
        rootUrl: 'https://w/wiki/Saved',
        results: [
          { url: 'https://w/wiki/Saved', title: 'Saved', domain: 'w', depth: 0, wordCount: 10, sections: [], infobox: [], statusCode: 200, latencyMs: 0, isMediaWiki: true },
          { url: 'https://w/wiki/Hop', title: 'Hop', domain: 'w', depth: 1, wordCount: 5, sections: [], infobox: [], statusCode: 200, latencyMs: 0, isMediaWiki: true },
        ],
      },
    });
    renderWithProviders(<CrawlerScreen />);
    // Crawl was not triggered, yet the restored results are present.
    expect(await screen.findByRole('button', { name: /remove saved/i })).toBeInTheDocument();
    expect(screen.getByText('Hop')).toBeInTheDocument();
    expect(mockCrawlPage).not.toHaveBeenCalled();
    // The restored "sent" marker flips that row's button to "Re-send".
    expect(screen.getByRole('button', { name: /^Re-send$/i })).toBeInTheDocument();
    const urlInput = screen.getByPlaceholderText('https://wiki.fandom.com/wiki/Page_name') as HTMLInputElement;
    expect(urlInput.value).toBe('https://w/wiki/Saved');
  });

  it('Delete all clears the list via ClearCrawl', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);
    await user.click(screen.getByText('Crawl page'));
    await screen.findByText('Results');

    await user.click(screen.getByRole('button', { name: /delete all/i }));

    await waitFor(() => expect(mockClearCrawl).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Results')).not.toBeInTheDocument());
  });

  it('Save crawl writes the project bundle when a project path is set', async () => {
    mockCrawlPage.mockResolvedValue(new crawler.CrawlSet({
      rootUrl: sampleResult.url,
      results: [sampleResult],
    }));
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen projectPath="project.slv" />);
    await user.click(screen.getByText('Crawl page'));
    await screen.findByText('Results');

    await user.click(screen.getByRole('button', { name: /save crawl/i }));

    await waitFor(() => expect(mockSaveProjectBundle).toHaveBeenCalledWith('project.slv'));
  });
});
