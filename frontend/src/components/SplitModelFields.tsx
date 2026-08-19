import React from 'react';
import { Dropdown } from './Dropdown';

interface SplitModelFieldsProps {
  /** Prefix for the field ids, e.g. "portrait" → "portrait-model". */
  idPrefix: string;
  unets: string[];
  /** All-in-one checkpoints: community Krea 2 / Z-Image merges ship this way. */
  checkpoints: string[];
  clips: string[];
  vaes: string[];
  model: string;
  onModelChange: (v: string) => void;
  clip: string;
  onClipChange: (v: string) => void;
  vae: string;
  onVaeChange: (v: string) => void;
}

function fileOpts(list: string[]) {
  return list.map(n => ({ value: n, label: n.replace(/\.safetensors$/, '') }));
}

/**
 * Builds the options for a required model pick. While nothing is selected
 * (no server file matched the workflow's hint) a placeholder row shows the
 * gap instead of silently displaying the first file as if it were chosen —
 * generation stays blocked until the user picks a real file.
 */
function requiredOpts(list: string[], value: string) {
  const opts = fileOpts(list);
  return value === '' ? [{ value: '', label: '— select —' }, ...opts] : opts;
}

/**
 * Model dropdowns for the built-in split-model workflows (Krea 2 Turbo,
 * Z-Image Turbo). The Model dropdown lists the server's diffusion-model
 * (UNet) files and its checkpoints: the official releases ship as split
 * files, community merges as all-in-one checkpoints. A split-file selection
 * needs an explicit text encoder and VAE. A checkpoint usually carries both
 * baked in, so they default to the baked ones — but stay selectable, since
 * some merges ship without an encoder. Rendered inside an `.img-kv` grid in
 * place of the checkpoint fields.
 */
const SplitModelFields: React.FC<SplitModelFieldsProps> = ({
  idPrefix, unets, checkpoints, clips, vaes,
  model, onModelChange, clip, onClipChange, vae, onVaeChange,
}) => {
  const isUnet = unets.includes(model);
  return (
    <>
      <label htmlFor={`${idPrefix}-model`}>Model</label>
      <Dropdown
        id={`${idPrefix}-model`}
        aria-label="Diffusion model"
        value={model}
        onChange={onModelChange}
        options={requiredOpts([...unets, ...checkpoints], model)}
      />
      <label htmlFor={`${idPrefix}-clip`}>Text encoder</label>
      <Dropdown
        id={`${idPrefix}-clip`}
        aria-label="Text encoder"
        value={clip}
        onChange={onClipChange}
        options={isUnet
          ? requiredOpts(clips, clip)
          : [{ value: '', label: '— baked encoder —' }, ...fileOpts(clips)]}
      />
      <label htmlFor={`${idPrefix}-vae`}>VAE</label>
      <Dropdown
        id={`${idPrefix}-vae`}
        aria-label="VAE"
        value={vae}
        onChange={onVaeChange}
        options={isUnet
          ? requiredOpts(vaes, vae)
          : [{ value: '', label: '— baked VAE —' }, ...fileOpts(vaes)]}
      />
    </>
  );
};

export default SplitModelFields;
