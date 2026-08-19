import React from 'react';
import { Dropdown } from './Dropdown';

interface SplitModelFieldsProps {
  /** Prefix for the field ids, e.g. "portrait" → "portrait-model". */
  idPrefix: string;
  unets: string[];
  clips: string[];
  vaes: string[];
  model: string;
  onModelChange: (v: string) => void;
  clip: string;
  onClipChange: (v: string) => void;
  vae: string;
  onVaeChange: (v: string) => void;
}

/**
 * Builds the options for a required model pick. While nothing is selected
 * (no server file matched the workflow's hint) a placeholder row shows the
 * gap instead of silently displaying the first file as if it were chosen —
 * generation stays blocked until the user picks a real file.
 */
function requiredOpts(list: string[], value: string) {
  const opts = list.map(n => ({ value: n, label: n.replace(/\.safetensors$/, '') }));
  return value === '' ? [{ value: '', label: '— select —' }, ...opts] : opts;
}

/**
 * Model dropdowns for the built-in split-file workflows (Krea 2 Turbo,
 * Z-Image Turbo): diffusion model (UNet), standalone text encoder and VAE,
 * each listing what the connected ComfyUI server actually has. Rendered
 * inside an `.img-kv` grid in place of the checkpoint fields.
 */
const SplitModelFields: React.FC<SplitModelFieldsProps> = ({
  idPrefix, unets, clips, vaes,
  model, onModelChange, clip, onClipChange, vae, onVaeChange,
}) => (
  <>
    <label htmlFor={`${idPrefix}-model`}>Model</label>
    <Dropdown
      id={`${idPrefix}-model`}
      aria-label="Diffusion model"
      value={model}
      onChange={onModelChange}
      options={requiredOpts(unets, model)}
    />
    <label htmlFor={`${idPrefix}-clip`}>Text encoder</label>
    <Dropdown
      id={`${idPrefix}-clip`}
      aria-label="Text encoder"
      value={clip}
      onChange={onClipChange}
      options={requiredOpts(clips, clip)}
    />
    <label htmlFor={`${idPrefix}-vae`}>VAE</label>
    <Dropdown
      id={`${idPrefix}-vae`}
      aria-label="VAE"
      value={vae}
      onChange={onVaeChange}
      options={requiredOpts(vaes, vae)}
    />
  </>
);

export default SplitModelFields;
