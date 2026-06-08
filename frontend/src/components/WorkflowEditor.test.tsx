import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    // Detect placeholders from template JSON
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

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={onClose} />);
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      await user.click(backdrop);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on X button click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowEditor workflow={workflow} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: '' });
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
});
