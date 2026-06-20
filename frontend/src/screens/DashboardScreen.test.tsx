import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardScreen from './DashboardScreen';
import { ToastProvider } from '../components/ToastProvider';
import { ConfirmProvider } from '../components/ConfirmDialog';

const mockList = vi.fn();
const mockSetStatus = vi.fn();
const mockRemove = vi.fn();
const mockThumb = vi.fn();
const mockOpen = vi.fn();
const mockPickOpen = vi.fn();

vi.mock('../../wailsjs/go/app/App', () => ({
  ListProjects: () => mockList(),
  NewProject: vi.fn(),
  SetProjectStatus: (p: string, s: string) => mockSetStatus(p, s),
  RemoveProject: (p: string, d: boolean) => mockRemove(p, d),
  GetProjectThumbnail: (p: string) => mockThumb(p),
  OpenProjectBundle: (p: string) => mockOpen(p),
  PickOpenBundle: () => mockPickOpen(),
}));

const entry = (over: Partial<Record<string, unknown>> = {}) => ({
  path: '/lib/Ciri.slv', name: 'Ciri', status: 'draft', updatedAt: '2026-06-13T11:00:00Z',
  sourceShort: 'witcher · wiki', tags: ['witcher', 'elder blood'], tokens: 1620,
  hasThumbnail: false, thumbRef: '', missing: false, ...over,
});

const renderDash = (props?: Partial<React.ComponentProps<typeof DashboardScreen>>) =>
  render(
    <ToastProvider>
      <ConfirmProvider>
        <DashboardScreen onOpenProject={vi.fn()} onNewProject={vi.fn()} {...props} />
      </ConfirmProvider>
    </ToastProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockThumb.mockResolvedValue([]);
});

describe('DashboardScreen', () => {
  it('renders project cards from ListProjects', async () => {
    mockList.mockResolvedValue([entry(), entry({ path: '/lib/Yen.slv', name: 'Yennefer', status: 'ready' })]);
    renderDash();
    expect(await screen.findByText('Ciri')).toBeInTheDocument();
    expect(screen.getByText('Yennefer')).toBeInTheDocument();
  });

  it('shows empty state when no projects', async () => {
    mockList.mockResolvedValue([]);
    renderDash();
    expect(await screen.findByText(/No characters yet/i)).toBeInTheDocument();
  });

  it('filters by status chip', async () => {
    mockList.mockResolvedValue([entry(), entry({ path: '/lib/Yen.slv', name: 'Yennefer', status: 'ready' })]);
    renderDash();
    await screen.findByText('Ciri');
    await userEvent.click(screen.getByRole('button', { name: /Ready/ }));
    expect(screen.queryByText('Ciri')).not.toBeInTheDocument();
    expect(screen.getByText('Yennefer')).toBeInTheDocument();
  });

  it('filters by search box', async () => {
    mockList.mockResolvedValue([entry(), entry({ path: '/lib/Yen.slv', name: 'Yennefer' })]);
    renderDash();
    await screen.findByText('Ciri');
    await userEvent.type(screen.getByPlaceholderText('Filter by name…'), 'yen');
    expect(screen.queryByText('Ciri')).not.toBeInTheDocument();
    expect(screen.getByText('Yennefer')).toBeInTheDocument();
  });

  it('opens a project when a card is clicked', async () => {
    const onOpenProject = vi.fn();
    mockList.mockResolvedValue([entry()]);
    mockOpen.mockResolvedValue({});
    renderDash({ onOpenProject });
    await userEvent.click(await screen.findByText('Ciri'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledWith('/lib/Ciri.slv'));
    expect(onOpenProject).toHaveBeenCalledWith('/lib/Ciri.slv');
  });

  it('cycles status without opening the project', async () => {
    const onOpenProject = vi.fn();
    mockList.mockResolvedValue([entry()]);
    mockSetStatus.mockResolvedValue(undefined);
    renderDash({ onOpenProject });
    await screen.findByText('Ciri');
    await userEvent.click(screen.getByTitle('Click to change status'));
    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('/lib/Ciri.slv', 'ready'));
    expect(onOpenProject).not.toHaveBeenCalled();
  });

  it('removes a project after confirm', async () => {
    mockList.mockResolvedValue([entry()]);
    mockRemove.mockResolvedValue(undefined);
    renderDash();
    await screen.findByText('Ciri');
    await userEvent.click(screen.getByLabelText('Remove project'));
    await userEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('/lib/Ciri.slv', false));
  });

  it('calls onNewProject from the New project button', async () => {
    const onNewProject = vi.fn();
    mockList.mockResolvedValue([entry()]);
    renderDash({ onNewProject });
    await screen.findByText('Ciri');
    await userEvent.click(screen.getByRole('button', { name: /New project/i }));
    expect(onNewProject).toHaveBeenCalled();
  });
});
