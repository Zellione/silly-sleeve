import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GenerationParamsPanel, { WorkflowOption } from './GenerationParamsPanel';

const WORKFLOWS: WorkflowOption[] = [
  {
    id: 'sd15',
    name: 'StableDiffusion-1.5',
    model: 'runwayml/stable-diffusion-v1-5',
    size: '512x512',
    steps: 20,
    sampler: 'euler',
    scheduler: 'karras',
  },
  {
    id: 'sdxl',
    name: 'SDXL',
    model: 'stabilityai/stable-diffusion-xl-base-1.0',
    size: '1024x1024',
    steps: 30,
    sampler: 'dpmpp_2m',
    scheduler: 'karras',
  },
];

describe('GenerationParamsPanel', () => {
  it('renders workflow selector with current workflow displayed', () => {
    const onChange = vi.fn();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={onChange}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    expect(screen.getByText('StableDiffusion-1.5.json')).toBeInTheDocument();
    expect(screen.getByText(/runwayml\/stable-diffusion-v1-5 · 512x512/)).toBeInTheDocument();
  });

  it('emits onWorkflowChange when a different workflow is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={onChange}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    const combobox = screen.getByRole('combobox', { name: 'Workflow' });
    await user.click(combobox);
    await user.click(screen.getByRole('option', { name: /SDXL/ }));
    expect(onChange).toHaveBeenCalledWith(WORKFLOWS[1]);
  });

  it('displays steps with proper bounds', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    const stepsInput = screen.getByDisplayValue('20') as HTMLInputElement;
    expect(stepsInput).toHaveAttribute('min', '1');
    expect(stepsInput).toHaveAttribute('max', '150');
  });

  it('displays CFG scale with decimal step and bounds', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7.5}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    const cfgInput = screen.getByDisplayValue('7.5') as HTMLInputElement;
    expect(cfgInput).toHaveAttribute('step', '0.1');
    expect(cfgInput).toHaveAttribute('min', '0');
    expect(cfgInput).toHaveAttribute('max', '30');
  });

  it('shows denoise input when showDenoise is true', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={0.75}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
        showDenoise={true}
      />,
    );

    const denoiseInput = screen.getByDisplayValue('0.75') as HTMLInputElement;
    expect(denoiseInput).toHaveAttribute('step', '0.05');
    expect(denoiseInput).toHaveAttribute('min', '0');
    expect(denoiseInput).toHaveAttribute('max', '1');
  });

  it('hides denoise when showDenoise is false', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
        showDenoise={false}
      />,
    );

    expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument();
  });

  it('changes sampler via dropdown', async () => {
    const user = userEvent.setup();
    const onSamplerChange = vi.fn();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={onSamplerChange}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    const samplerDropdown = screen.getByRole('combobox', { name: 'Sampler' });
    await user.click(samplerDropdown);
    await user.click(screen.getByRole('option', { name: 'dpmpp_2m' }));
    expect(onSamplerChange).toHaveBeenCalledWith('dpmpp_2m');
  });

  it('uses custom sampler list when provided', async () => {
    const user = userEvent.setup();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="custom1"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
        samplerList={['custom1', 'custom2']}
      />,
    );

    const samplerDropdown = screen.getByRole('combobox', { name: 'Sampler' });
    await user.click(samplerDropdown);
    expect(screen.getByRole('option', { name: 'custom1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'custom2' })).toBeInTheDocument();
  });

  it('changes scheduler via dropdown', async () => {
    const user = userEvent.setup();
    const onSchedulerChange = vi.fn();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={onSchedulerChange}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    const schedulerDropdown = screen.getByRole('combobox', { name: 'Scheduler' });
    await user.click(schedulerDropdown);
    await user.click(screen.getByRole('option', { name: 'exponential' }));
    expect(onSchedulerChange).toHaveBeenCalledWith('exponential');
  });

  it('uses custom scheduler list when provided', async () => {
    const user = userEvent.setup();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="custom1"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
        schedulerList={['custom1', 'custom2', 'custom3']}
      />,
    );

    const schedulerDropdown = screen.getByRole('combobox', { name: 'Scheduler' });
    await user.click(schedulerDropdown);
    expect(screen.getByRole('option', { name: 'custom1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'custom3' })).toBeInTheDocument();
  });

  it('displays seed value from props', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={12345}
        onSeedChange={vi.fn()}
      />,
    );

    const seedInput = screen.getByDisplayValue('12345');
    expect(seedInput).toBeInTheDocument();
  });

  it('randomizes seed on dice button click', async () => {
    const user = userEvent.setup();
    const onSeedChange = vi.fn();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={onSeedChange}
      />,
    );

    const diceButton = screen.getByTitle('Randomize');
    await user.click(diceButton);
    expect(onSeedChange).toHaveBeenCalled();
    const callArg = onSeedChange.mock.calls[0][0];
    expect(typeof callArg).toBe('number');
    expect(callArg).toBeGreaterThanOrEqual(0);
    expect(callArg).toBeLessThanOrEqual(4e9);
  });

  it('seed input updates when props change', () => {
    const { rerender } = render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('42')).toBeInTheDocument();

    rerender(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={99999}
        onSeedChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('99999')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      >
        <div>Custom Child Element</div>
      </GenerationParamsPanel>,
    );

    expect(screen.getByText('Custom Child Element')).toBeInTheDocument();
  });

  it('does not render divline or children when children is not provided', () => {
    const { container } = render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
      />,
    );

    // Should render divlines for the standard sections, but not an extra one for children
    const divlines = container.querySelectorAll('.img-divline');
    // Two divlines: one before "Sampler params", one before "Seed"
    expect(divlines.length).toBe(2);
  });

  it('optionally shows aspect selector', async () => {
    const user = userEvent.setup();
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
        showAspectSelector={true}
      />,
    );

    const aspectDropdown = screen.getByRole('combobox', { name: 'Aspect' });
    expect(aspectDropdown).toBeInTheDocument();
    await user.click(aspectDropdown);
    expect(screen.getByRole('option', { name: /Banner/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cover/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Square/ })).toBeInTheDocument();
  });

  it('hides aspect selector by default', () => {
    render(
      <GenerationParamsPanel
        workflows={WORKFLOWS}
        selectedWorkflow={WORKFLOWS[0]}
        onWorkflowChange={vi.fn()}
        steps={20}
        onStepsChange={vi.fn()}
        cfg={7}
        onCfgChange={vi.fn()}
        denoise={1}
        onDenoiseChange={vi.fn()}
        sampler="euler"
        onSamplerChange={vi.fn()}
        scheduler="karras"
        onSchedulerChange={vi.fn()}
        seed={42}
        onSeedChange={vi.fn()}
        showAspectSelector={false}
      />,
    );

    expect(screen.queryByRole('combobox', { name: 'Aspect' })).not.toBeInTheDocument();
  });
});
