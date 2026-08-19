import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SplitModelFields from './SplitModelFields';

const Harness: React.FC<{ initialModel?: string }> = ({ initialModel = '' }) => {
  const [model, setModel] = useState(initialModel);
  const [clip, setClip] = useState('');
  const [vae, setVae] = useState('');
  return (
    <div>
      <SplitModelFields
        idPrefix="test"
        unets={['z_image_turbo_bf16.safetensors', 'other_unet.safetensors']}
        checkpoints={['ZImageTurbo/beretMixZIT_v50.safetensors']}
        clips={['qwen_3_4b.safetensors']}
        vaes={['ae.safetensors']}
        model={model} onModelChange={setModel}
        clip={clip} onClipChange={setClip}
        vae={vae} onVaeChange={setVae}
      />
      <span data-testid="model">{model}</span>
      <span data-testid="vae">{vae}</span>
    </div>
  );
};

describe('SplitModelFields', () => {
  it('lists UNet files and checkpoints together in the model dropdown', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Diffusion model'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('z_image_turbo_bf16')).toBeInTheDocument();
    expect(within(listbox).getByText('ZImageTurbo/beretMixZIT_v50')).toBeInTheDocument();
  });

  it('shows a placeholder while nothing is selected and drops it after a pick', async () => {
    render(<Harness />);
    const modelControl = screen.getByLabelText('Diffusion model');
    expect(modelControl).toHaveTextContent('— select —');

    await userEvent.click(modelControl);
    await userEvent.click(await screen.findByText('z_image_turbo_bf16'));

    expect(screen.getByTestId('model').textContent).toBe('z_image_turbo_bf16.safetensors');
    expect(modelControl).not.toHaveTextContent('— select —');
  });

  it('shows the text encoder and a required VAE for a split-file selection', () => {
    render(<Harness initialModel="z_image_turbo_bf16.safetensors" />);
    expect(screen.getByLabelText('Text encoder')).toBeInTheDocument();
    expect(screen.getByLabelText('VAE')).toHaveTextContent('— select —');
  });

  it('defaults to the baked encoder and VAE for a checkpoint selection', () => {
    // The encoder stays selectable: some community merges ship without one.
    render(<Harness initialModel="ZImageTurbo/beretMixZIT_v50.safetensors" />);
    expect(screen.getByLabelText('Text encoder')).toHaveTextContent('— baked encoder —');
    expect(screen.getByLabelText('VAE')).toHaveTextContent('— baked VAE —');
  });

  it('lets a checkpoint selection override the baked encoder', async () => {
    render(<Harness initialModel="ZImageTurbo/beretMixZIT_v50.safetensors" />);
    await userEvent.click(screen.getByLabelText('Text encoder'));
    await userEvent.click(await screen.findByText('qwen_3_4b'));
    expect(screen.getByLabelText('Text encoder')).toHaveTextContent('qwen_3_4b');
  });

  it('shows the preselected file without a placeholder option', async () => {
    render(<Harness initialModel="other_unet.safetensors" />);
    const modelControl = screen.getByLabelText('Diffusion model');
    expect(modelControl).toHaveTextContent('other_unet');

    await userEvent.click(modelControl);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByText('— select —')).not.toBeInTheDocument();
  });
});
