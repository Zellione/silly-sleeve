import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleBar, Sidebar, PageHead, StatusBar, ThemeToggle } from './Layout';

describe('TitleBar', () => {
  it('renders app name', () => {
    render(<TitleBar />);
    expect(screen.getByText('Silly Sleeve')).toBeInTheDocument();
  });

  it('renders project name when provided', () => {
    render(<TitleBar projectName="My Project" />);
    expect(screen.getByText(/My Project/)).toBeInTheDocument();
  });

  it('renders without project name', () => {
    const { container } = render(<TitleBar />);
    expect(container.textContent).not.toContain('·');
  });
});

describe('Sidebar', () => {
  const onNav = vi.fn();

  beforeEach(() => {
    onNav.mockClear();
  });

  it('renders all nav sections', () => {
    render(<Sidebar current="dashboard" onNav={onNav} />);
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('Setup')).toBeInTheDocument();
  });

  it('renders brand name', () => {
    render(<Sidebar current="dashboard" onNav={onNav} />);
    expect(screen.getAllByText('Silly Sleeve').length).toBeGreaterThanOrEqual(1);
  });

  it('highlights active route', () => {
    render(<Sidebar current="crawler" onNav={onNav} />);
    const button = screen.getByText('Crawl').closest('button');
    expect(button!.getAttribute('data-active')).toBe('1');
  });

  it('does not highlight inactive routes', () => {
    render(<Sidebar current="dashboard" onNav={onNav} />);
    const button = screen.getByText('Crawl').closest('button');
    expect(button!.getAttribute('data-active')).toBe('0');
  });

  it('calls onNav when clicking a nav item', async () => {
    const user = userEvent.setup();
    render(<Sidebar current="dashboard" onNav={onNav} />);
    await user.click(screen.getByText('Crawl'));
    expect(onNav).toHaveBeenCalledWith('crawler');
  });

  it('renders step numbers when showSteps is true', () => {
    render(<Sidebar current="dashboard" onNav={onNav} showSteps={true} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
  });

  it('does not render step numbers when showSteps is false', () => {
    render(<Sidebar current="dashboard" onNav={onNav} showSteps={false} />);
    expect(screen.queryByText('01')).not.toBeInTheDocument();
  });

  it('renders settings nav', () => {
    render(<Sidebar current="dashboard" onNav={onNav} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

describe('PageHead', () => {
  it('renders title', () => {
    render(<PageHead title="Test Page" />);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders step pill when step is provided', () => {
    render(<PageHead step={3} subtitle="Subtitle" title="Test" />);
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('does not render step pill when step is not provided', () => {
    const { container } = render(<PageHead title="No Step" />);
    expect(container.querySelector('.step-pill')).toBeNull();
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
    localStorage.setItem('ss-theme', 'dark');
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to light mode when no saved theme', () => {
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles theme on click', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('ss-theme')).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('ss-theme')).toBe('light');
  });

  it('persists theme to localStorage on change', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('ss-theme')).toBe('dark');
  });
});
