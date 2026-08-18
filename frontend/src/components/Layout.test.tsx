import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar, PageHead, StatusBar, ThemeToggle } from './Layout';
import { TABS } from './tabs';

describe('TopBar', () => {
  const onNav = vi.fn();

  beforeEach(() => {
    onNav.mockClear();
  });

  it('renders every workflow tab', () => {
    render(<TopBar current="crawler" onNav={onNav} />);
    for (const t of TABS) {
      expect(screen.getByRole('tab', { name: t.label })).toBeInTheDocument();
    }
  });

  it('marks the active tab', () => {
    render(<TopBar current="lorebook" onNav={onNav} />);
    expect(screen.getByRole('tab', { name: 'Lorebook' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Crawl' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onNav when a tab is clicked', async () => {
    const user = userEvent.setup();
    render(<TopBar current="crawler" onNav={onNav} />);
    await user.click(screen.getByRole('tab', { name: 'Characters' }));
    expect(onNav).toHaveBeenCalledWith('characters');
  });

  it('shows the project name in the brand pill', () => {
    render(<TopBar current="crawler" onNav={onNav} projectName="Harper cell" />);
    expect(screen.getByText('Harper cell')).toBeInTheDocument();
  });

  it('falls back to a placeholder when no project is open', () => {
    render(<TopBar current="crawler" onNav={onNav} />);
    expect(screen.getByText('No project open')).toBeInTheDocument();
  });

  it('navigates to the projects screen when the brand is clicked', async () => {
    const user = userEvent.setup();
    render(<TopBar current="crawler" onNav={onNav} />);
    await user.click(screen.getByTitle('All projects'));
    expect(onNav).toHaveBeenCalledWith('dashboard');
  });

  it('navigates to settings via the cog button and marks it active', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TopBar current="crawler" onNav={onNav} />);
    const cog = screen.getByTitle('Settings');
    expect(cog.dataset.on).toBe('0');
    await user.click(cog);
    expect(onNav).toHaveBeenCalledWith('settings');
    rerender(<TopBar current="settings" onNav={onNav} />);
    expect(screen.getByTitle('Settings').dataset.on).toBe('1');
  });

  it('renders no window-control buttons (the OS frame owns them)', () => {
    render(<TopBar current="crawler" onNav={onNav} />);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Minimise')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Maximise')).not.toBeInTheDocument();
  });

  it('renders the Save button directly left of the theme toggle', () => {
    const { container } = render(<TopBar current="crawler" onNav={onNav} onSave={vi.fn()} />);
    const right = container.querySelector('.v2-right');
    const children = Array.from(right?.children ?? []);
    const save = screen.getByRole('button', { name: 'Save' });
    const theme = screen.getByTitle(/Switch to (light|dark) mode/);
    expect(children.indexOf(save)).toBeGreaterThanOrEqual(0);
    expect(children.indexOf(theme)).toBe(children.indexOf(save) + 1);
  });

  it('calls onSave when the Save button is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TopBar current="crawler" onNav={onNav} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('omits the Save button when no save handler is given', () => {
    render(<TopBar current="crawler" onNav={onNav} />);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('PageHead', () => {
  it('renders title', () => {
    render(<PageHead title="Test Page" />);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders the subtitle under the title', () => {
    const { container } = render(<PageHead subtitle="Subtitle" title="Test" />);
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
    expect(container.querySelector('.v2-sub')).toBeTruthy();
  });

  it('omits the subtitle line when no subtitle is given', () => {
    const { container } = render(<PageHead title="No sub" />);
    expect(container.querySelector('.v2-sub')).toBeNull();
  });

  it('renders actions', () => {
    render(<PageHead title="With Actions" actions={<button>Action</button>} />);
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});

describe('StatusBar', () => {
  it('renders routeLabel', () => {
    render(<StatusBar routeLabel="DASHBOARD" />);
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('renders LLM name', () => {
    render(<StatusBar routeLabel="TEST" llmName="my-model" />);
    expect(screen.getByText('my-model')).toBeInTheDocument();
  });

  it('renders default LLM name when not provided', () => {
    render(<StatusBar routeLabel="TEST" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders ok dot class when llmStatus is ok', () => {
    const { container } = render(<StatusBar routeLabel="TEST" llmStatus="ok" />);
    expect(container.querySelector('.dot.ok')).toBeTruthy();
  });

  it('renders idle dot class when llmStatus is idle', () => {
    const { container } = render(<StatusBar routeLabel="TEST" llmStatus="idle" />);
    expect(container.querySelector('.dot.idle')).toBeTruthy();
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reads saved theme from localStorage', () => {
    localStorage.setItem('ss-theme', 'light');
    render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('defaults to dark mode when no saved theme', () => {
    render(<ThemeToggle />);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('toggles theme on click', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('ss-theme')).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ss-theme')).toBe('dark');
  });

  it('persists theme to localStorage on change', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('ss-theme')).toBe('light');
  });
});
