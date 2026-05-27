import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { settings } from '../wailsjs/go/models';

const mockGetSettings = vi.fn();

vi.mock('../wailsjs/go/main/App', () => ({
  GetSettings: () => mockGetSettings(),
  SaveSettings: vi.fn(),
  TestLLMEndpoint: vi.fn(),
}));

vi.mock('./style.css', () => ({}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.ss-app')).toBeTruthy();
    });
  });

  it('calls GetSettings on mount', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to empty settings on GetSettings error', async () => {
    mockGetSettings.mockRejectedValue(new Error('fail'));
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.ss-app')).toBeTruthy();
    });
  });

  it('selects default endpoint by isDefault flag', async () => {
    const ep = new settings.LLMEndpoint({
      id: 1, name: 'Default', isDefault: true, ok: true,
    });
    const ep2 = new settings.LLMEndpoint({
      id: 2, name: 'Secondary', isDefault: false, ok: false,
    });
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [ep, ep2],
    }));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
  });

  it('falls back to first endpoint when no default', async () => {
    const ep = new settings.LLMEndpoint({
      id: 1, name: 'First', isDefault: false, ok: false,
    });
    const ep2 = new settings.LLMEndpoint({
      id: 2, name: 'Second', isDefault: false, ok: false,
    });
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [ep, ep2],
    }));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument();
    });
  });

  it('renders Sidebar with nav items', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeTruthy();
    });
    expect(screen.getByText('Crawl')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders default DashboardScreen', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Your projects')).toBeInTheDocument();
    });
  });

  it('navigates to other screens on sidebar click', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Your projects')).toBeInTheDocument();
    });

    // Click "Crawl" which renders a placeholder (simple, no complex deps)
    await user.click(screen.getByText('Crawl'));
    await waitFor(() => {
      expect(screen.getByText('Crawl a wiki page')).toBeInTheDocument();
    });
  });

  it('renders StatusBar', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PROJECTS')).toBeInTheDocument();
    });
  });

  it('renders ThemeToggle', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const toggle = buttons.find(b => b.getAttribute('title'));
      expect(toggle).toBeTruthy();
    });
  });

  it('shows LLM name in status bar when endpoint exists', async () => {
    const ep = new settings.LLMEndpoint({
      id: 1, name: 'MyLLM', isDefault: true, ok: true,
    });
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [ep],
    }));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('MyLLM')).toBeInTheDocument();
    });
  });
});
