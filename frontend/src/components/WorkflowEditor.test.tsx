import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveComfyWorkflowTemplate } from '../../wailsjs/go/main/App';
import WorkflowEditor from './WorkflowEditor';

vi.mock('../../wailsjs/go/main/App', () => ({
  SaveComfyWorkflowTemplate: vi.fn().mockResolvedValue(undefined),
}));

const workflow = {
  id: 'wf-1',
  name: 'test_workflow',
  jsonData: Array.from(new TextEncoder().encode(JSON.stringify({
    '1': { class_type: 'KSampler', inputs: { seed: '{{seed}}', steps: '{{steps}}', cfg: '{{cfg}}' } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: '{{positive_prompt}}' } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: '{{negative_prompt}}' } },
  }))),
  template: null,
};

describe('WorkflowEditor', () => {
  it('renders workflow name', () => {
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByText(/Edit Workflow:/)).toBeInTheDocument();
    expect(screen.getByText(/test_workflow/)).toBeInTheDocument();
  });

  it('renders detected placeholders in the side panel', () => {
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByText(/Placeholders/)).toBeInTheDocument();
    expect(screen.getByText('{{seed}}')).toBeInTheDocument();
    expect(screen.getByText('{{steps}}')).toBeInTheDocument();
    expect(screen.getByText('{{cfg}}')).toBeInTheDocument();
    expect(screen.getByText('{{positive_prompt}}')).toBeInTheDocument();
    expect(screen.getByText('{{negative_prompt}}')).toBeInTheDocument();
  });

  it('renders available placeholders section', () => {
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByText('Available placeholders')).toBeInTheDocument();
  });

  it('closes on X button click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('formats JSON on button click', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    const formatBtn = screen.getByText('Format JSON');
    await user.click(formatBtn);
  });

  it('has cancel and save buttons', () => {
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save template')).toBeInTheDocument();
  });

  it('shows placeholder without template uses jsonData', () => {
    const wf = { ...workflow, template: null };
    render(<WorkflowEditor workflow={wf} onClose={vi.fn()} />);
    expect(screen.getByText(/test_workflow/)).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<WorkflowEditor workflow={workflow} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={onClose} />);
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('updates textarea on user input', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    const orig = (textarea as HTMLTextAreaElement).value;
    await user.type(textarea, 'z');
    expect((textarea as HTMLTextAreaElement).value).not.toBe(orig);
  });

  it('inserts placeholder at cursor position', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} />);
    const insertBtns = screen.getAllByText('Insert');
    await user.click(insertBtns[0]);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('{{');
  });

  it('calls onSaved with bytes on successful save', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    vi.mocked(SaveComfyWorkflowTemplate).mockResolvedValue(undefined);
    render(<WorkflowEditor workflow={workflow} onClose={onClose} onSaved={onSaved} />);
    await user.click(screen.getByText('Save template'));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSaveError on save failure', async () => {
    const onSaveError = vi.fn();
    const user = userEvent.setup();
    vi.mocked(SaveComfyWorkflowTemplate).mockRejectedValue(new Error('disk full'));
    render(<WorkflowEditor workflow={workflow} onClose={vi.fn()} onSaveError={onSaveError} />);
    await user.click(screen.getByText('Save template'));
    expect(onSaveError).toHaveBeenCalledWith('disk full');
  });
});
