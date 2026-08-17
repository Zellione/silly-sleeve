import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ImagesScreen from './ImagesScreen';

vi.mock('./PortraitScreen', () => ({
  default: ({ projectPath }: { projectPath: string }) => (
    <div data-testid="portrait-screen">{projectPath}</div>
  ),
}));
vi.mock('./ProjectImageScreen', () => ({
  default: () => <div data-testid="project-image-screen">cover</div>,
}));

describe('ImagesScreen', () => {
  it('shows the portraits sub-screen by default', () => {
    render(<ImagesScreen projectPath="/tmp/p.slv" />);
    expect(screen.getByTestId('portrait-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('project-image-screen')).not.toBeInTheDocument();
    expect(screen.getByText('per-character · comfyui or upload')).toBeInTheDocument();
  });

  it('passes the project path through to the portrait screen', () => {
    render(<ImagesScreen projectPath="/tmp/p.slv" />);
    expect(screen.getByTestId('portrait-screen')).toHaveTextContent('/tmp/p.slv');
  });

  it('switches to the project cover sub-screen', async () => {
    const user = userEvent.setup();
    render(<ImagesScreen projectPath="" />);

    await user.click(screen.getByRole('button', { name: 'Project cover' }));
    expect(screen.getByTestId('project-image-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('portrait-screen')).not.toBeInTheDocument();
    expect(screen.getByText('one per project · shown on export')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Character portraits' }));
    expect(screen.getByTestId('portrait-screen')).toBeInTheDocument();
  });

  it('marks the active sub-tab', async () => {
    const user = userEvent.setup();
    render(<ImagesScreen projectPath="" />);
    expect(screen.getByRole('button', { name: 'Character portraits' }).dataset.on).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Project cover' }));
    expect(screen.getByRole('button', { name: 'Project cover' }).dataset.on).toBe('1');
    expect(screen.getByRole('button', { name: 'Character portraits' }).dataset.on).toBe('0');
  });
});
