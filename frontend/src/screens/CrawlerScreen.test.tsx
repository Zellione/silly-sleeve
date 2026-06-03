import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CrawlerScreen from './CrawlerScreen';
import { ToastProvider } from '../components/ToastProvider';
import { crawler } from '../../wailsjs/go/models';

const mockCrawlPage = vi.fn();
const mockGetCachedCrawl = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  CrawlPage: (...args: any[]) => mockCrawlPage(...args),
  GetCachedCrawl: () => mockGetCachedCrawl(),
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
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('CrawlerScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedCrawl.mockResolvedValue(null);
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

  it('disables "Save crawl" and "Send to Compose" buttons', () => {
    renderWithProviders(<CrawlerScreen />);
    const saveBtn = screen.getByText('Save crawl').closest('button')!;
    expect(saveBtn).toBeDisabled();
    const sendBtn = screen.getByText('Send to Compose').closest('button')!;
    expect(sendBtn).toBeDisabled();
  });

  it('shows idle preview state', () => {
    renderWithProviders(<CrawlerScreen />);
    expect(screen.getByText('No page crawled')).toBeInTheDocument();
  });

  it('calls CrawlPage binding on "Crawl page" click', async () => {
    mockCrawlPage.mockResolvedValue(sampleResult);
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

    resolvePromise!(sampleResult);
  });

  it('displays crawl result in preview after successful crawl', async () => {
    mockCrawlPage.mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('elara_wynd')).toBeInTheDocument();
    });
    expect(screen.getByText('baldursgate.fandom.com')).toBeInTheDocument();
    expect(screen.getByText('Half-elf')).toBeInTheDocument();
    expect(screen.getByText('A half-elf bard.')).toBeInTheDocument();
    expect(screen.getByText('1,842 words · 2 sections')).toBeInTheDocument();
  });

  it('shows "Re-crawl" button after successful crawl', async () => {
    mockCrawlPage.mockResolvedValue(sampleResult);
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
    mockCrawlPage.mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('Half-elf')).toBeInTheDocument();
      expect(screen.getByText('Bard')).toBeInTheDocument();
    });
  });

  it('renders section tags in preview', async () => {
    mockCrawlPage.mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderWithProviders(<CrawlerScreen />);

    await user.click(screen.getByText('Crawl page'));

    await waitFor(() => {
      expect(screen.getByText('lede')).toBeInTheDocument();
    });
  });

  it('displays footer metadata after crawl', async () => {
    mockCrawlPage.mockResolvedValue(sampleResult);
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
    });
    mockCrawlPage.mockResolvedValue(emptyResult);
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
    });
    mockCrawlPage.mockResolvedValue(emptyResult);
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
    });
    mockCrawlPage.mockResolvedValue(noInfoResult);
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
    });
    mockCrawlPage.mockResolvedValue(multiPara);
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
    });
    mockCrawlPage.mockResolvedValue(sectionResult);
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
});
