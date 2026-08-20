import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import App from './App';
import { settings } from '../wailsjs/go/models';

const mockGetSettings = vi.fn();
const mockNewProject = vi.fn();
const mockSaveProjectBundle = vi.fn();
const mockPickSaveBundle = vi.fn();

vi.mock('../wailsjs/go/app/App', () => ({
  GetSettings: () => mockGetSettings(),
  SaveProjectBundle: (p: string) => mockSaveProjectBundle(p),
  PickSaveBundle: () => mockPickSaveBundle(),
  SaveSettings: vi.fn(),
  TestLLMEndpoint: vi.fn(),
  GetCachedCrawl: vi.fn().mockResolvedValue(null),
  GetCrawlState: vi.fn().mockResolvedValue({ url: '', followLinks: 0, include: {}, selectors: '', roles: {}, set: null }),
  SaveCrawlState: vi.fn().mockResolvedValue(undefined),
  ClearCrawl: vi.fn().mockResolvedValue(undefined),
  GetCharacters: vi.fn().mockResolvedValue([]),
  GetLorebook: vi.fn().mockResolvedValue([]),
  GetActiveCharacter: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
  AddCharacter: vi.fn(),
  DeleteCharacter: vi.fn(),
  SetActiveCharacter: vi.fn(),
  UpdateCharacter: vi.fn(),
  ListProjects: vi.fn().mockResolvedValue([]),
  NewProject: (name: string) => mockNewProject(name),
  GetComfySamplers: vi.fn().mockResolvedValue([]),
  GetComfySchedulers: vi.fn().mockResolvedValue([]),
  GetComfyCheckpoints: vi.fn().mockResolvedValue([]),
  GetComfyUNets: vi.fn().mockResolvedValue([]),
  GetComfyCLIPs: vi.fn().mockResolvedValue([]),
  GetComfyVAEs: vi.fn().mockResolvedValue([]),
  GetComfyLoRAs: vi.fn().mockResolvedValue([]),
  GetComfyWorkflowTemplate: vi.fn().mockResolvedValue(''),
  GenerateImagePrompt: vi.fn().mockResolvedValue(''),
  GeneratePortrait: vi.fn().mockResolvedValue([]),
  GenerateProjectImage: vi.fn().mockResolvedValue([]),
  GetPortrait: vi.fn().mockResolvedValue([]),
  SavePortrait: vi.fn().mockResolvedValue(undefined),
  GetProjectImage: vi.fn().mockResolvedValue([]),
  SaveProjectImage: vi.fn().mockResolvedValue(undefined),
  GetComfyWorkflows: vi.fn().mockResolvedValue([]),
  GetProjectFieldEndpoints: vi.fn().mockResolvedValue({}),
  SetProjectFieldEndpoint: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./style.css', () => ({}));

/**
 * The projects picker is a full-screen pre-screen; the tabbed shell only
 * appears once a project is created or opened. With no library entries the
 * picker shows the empty state, whose CTA creates an unnamed project and
 * lands on the crawl tab.
 */
const enterApp = async (user: UserEvent) => {
  await screen.findByText(/Start with a wiki page you love/);
  await user.click(screen.getByRole('button', { name: /Crawl a wiki page/ }));
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Crawl' })).toBeInTheDocument();
  });
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNewProject.mockResolvedValue('/lib/Untitled.slv');
    mockSaveProjectBundle.mockResolvedValue(undefined);
    mockPickSaveBundle.mockResolvedValue('/picked/path.slv');
  });

  it('renders the projects picker on start', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.v2-pre')).toBeTruthy();
    });
    expect(screen.getByText('Pick a project to continue, or start a new one from a wiki crawl.')).toBeInTheDocument();
  });

  it('calls GetSettings on mount', async () => {
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalled();
    });
  });

  it('still renders the picker on GetSettings error', async () => {
    mockGetSettings.mockRejectedValue(new Error('fail'));
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.v2-pre')).toBeTruthy();
    });
  });

  it('enters the tabbed shell after creating a project', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    const { container } = render(<App />);
    await enterApp(user);
    expect(container.querySelector('.ss-app-v2')).toBeTruthy();
    expect(screen.getByTitle('All projects')).toBeTruthy();
    expect(screen.getByTitle('Settings')).toBeTruthy();
    expect(screen.getByText('Source URL')).toBeInTheDocument();
  });

  it('selects default endpoint by isDefault flag', async () => {
    const user = userEvent.setup();
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
    await enterApp(user);
    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
  });

  it('falls back to first endpoint when no default', async () => {
    const user = userEvent.setup();
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
    await enterApp(user);
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument();
    });
  });

  it('returns to the picker via the brand button', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    const { container } = render(<App />);
    await enterApp(user);

    await user.click(screen.getByTitle('All projects'));
    await waitFor(() => {
      expect(container.querySelector('.v2-pre')).toBeTruthy();
    });
  });

  it('navigates to the images tab and its project-cover sub-tab', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('tab', { name: 'Images' }));
    await user.click(screen.getByRole('button', { name: 'Project cover' }));
    await waitFor(() => {
      expect(screen.getByText('Cover art for the whole project')).toBeInTheDocument();
    });
  });

  it('navigates to Settings via the top bar cog', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByTitle('Settings'));
    await waitFor(() => {
      expect(screen.getByText('Add endpoint')).toBeInTheDocument();
    });
  });

  it('navigates to preview', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    await waitFor(() => {
      expect(screen.getByText('No characters yet')).toBeInTheDocument();
    });
  });

  it('navigates to the images tab showing portraits by default', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('tab', { name: 'Images' }));
    await waitFor(() => {
      expect(screen.getByText('Make or import a face')).toBeInTheDocument();
    });
  });

  it('navigates to export', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('tab', { name: 'Export' }));
    await waitFor(() => {
      expect(screen.getByText('Ship the project')).toBeInTheDocument();
    });
  });

  it('navigates to the characters tab', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('tab', { name: 'Characters' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add character/ })).toBeInTheDocument();
    });
  });

  it('saves the instantly-created bundle via the top-bar Save button', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockSaveProjectBundle).toHaveBeenCalledWith('/lib/Untitled.slv');
    });
    expect(mockPickSaveBundle).not.toHaveBeenCalled();
    expect(screen.getByText('Project saved')).toBeInTheDocument();
  });

  it('falls back to the save dialog when the project has no bundle path', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    mockNewProject.mockResolvedValue('');
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockSaveProjectBundle).toHaveBeenCalledWith('/picked/path.slv');
    });
    expect(mockPickSaveBundle).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when saving fails', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    mockSaveProjectBundle.mockRejectedValueOnce(new Error('disk full'));
    render(<App />);
    await enterApp(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Project not saved')).toBeInTheDocument();
  });

  it('renders StatusBar inside the shell', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({ endpoints: [] }));
    render(<App />);
    await enterApp(user);
    await waitFor(() => {
      expect(screen.getByText('CRAWL')).toBeInTheDocument();
    });
  });

  it('shows LLM name in status bar when endpoint exists', async () => {
    const user = userEvent.setup();
    const ep = new settings.LLMEndpoint({
      id: 1, name: 'MyLLM', isDefault: true, ok: true,
    });
    mockGetSettings.mockResolvedValue(settings.Settings.createFrom({
      endpoints: [ep],
    }));

    render(<App />);
    await enterApp(user);
    await waitFor(() => {
      expect(screen.getByText('MyLLM')).toBeInTheDocument();
    });
  });
});
