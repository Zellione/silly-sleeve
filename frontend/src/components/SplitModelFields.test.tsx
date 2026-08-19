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
        clips={['qwen_3_4b.safetensors']}
        vaes={['ae.safetensors']}
        model={model} onModelChange={setModel}
        clip={clip} onClipChange={setClip}
        vae={vae} onVaeChange={setVae}
      />
      <span data-testid="model">{model}</span>
    </div>
  );
};

describe('SplitModelFields', () => {
  it('renders the three split-model dropdowns', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Diffusion model')).toBeInTheDocument();
    expect(screen.getByLabelText('Text encoder')).toBeInTheDocument();
    expect(screen.getByLabelText('VAE')).toBeInTheDocument();
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

  it('shows the preselected file without a placeholder option', async () => {
    render(<Harness initialModel="other_unet.safetensors" />);
    const modelControl = screen.getByLabelText('Diffusion model');
    expect(modelControl).toHaveTextContent('other_unet');

    await userEvent.click(modelControl);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByText('— select —')).not.toBeInTheDocument();
  });
});
