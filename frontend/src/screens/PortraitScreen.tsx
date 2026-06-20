import React, { useState, useEffect } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, ImageIcon,
} from '../icons';
import {
  GetCharacters, SetActiveCharacter, GetActiveCharacter,
  GeneratePortrait, GenerateImagePrompt,
  GetComfyVAEs, GetComfyLoRAs,
  GetPortrait, SavePortrait,
} from '../../wailsjs/go/app/App';
import { compose } from '../../wailsjs/go/models';
import ImageUploadPanel from '../components/ImageUploadPanel';
import GenerationParamsPanel from '../components/GenerationParamsPanel';
import { Dropdown } from '../components/Dropdown';
import ImageCanvasPanel from '../components/ImageCanvasPanel';
import ImageGalleryPanel from '../components/ImageGalleryPanel';
import { useImageGeneration } from '../components/useImageGeneration';
import { DEFAULT_NEGATIVE_PROMPT, arrayBufferToDataURL, dataURLToBytes } from '../utils/image';

const PORTRAIT_WORKFLOWS = [
  { id: 'portrait_sdxl', name: 'portrait_sdxl_v3', model: 'sd_xl_base_1.0', size: '832×1216', steps: 28, sampler: 'dpmpp_2m', scheduler: 'karras' },
  { id: 'illustrious', name: 'illustrious_anime', model: 'noobaiXL_v07', size: '896×1152', steps: 30, sampler: 'euler_ancestral', scheduler: 'normal' },
  { id: 'flux', name: 'flux_dev_portrait', model: 'flux1-dev-fp8', size: '1024×1024', steps: 20, sampler: 'euler', scheduler: 'normal' },
];

async function autoFillImagePrompt(
  activeChar: compose.Character | null,
  activeCharId: number,
  promptStyle: string,
  negPrompt: string,
  setPrompt: (v: string) => void,
  setNegPrompt: (v: string) => void,
): Promise<void> {
  if (!activeChar) return;
  // Auto-fill regenerates the positive prompt from the card, but never clobbers
  // a negative prompt the user has already customized.
  const keepNeg = negPrompt.trim().length > 0;
  try {
    const [positive, negative] = await GenerateImagePrompt(activeCharId, promptStyle);
    setPrompt(positive);
    if (!keepNeg) setNegPrompt(negative);
  } catch {
    const appearance = activeChar.appearance;
    if (appearance.trim()) {
      setPrompt(`(masterpiece, best quality, ultra detailed), ${appearance.trim()}, ${activeChar.name}, oil painting style, cinematic lighting`);
    }
    if (!keepNeg) setNegPrompt(DEFAULT_NEGATIVE_PROMPT);
  }
}

function getInitial(name: string): string {
  return name[0] || "?";
}

function activeState(current: unknown, target: unknown): string {
  return current === target ? '1' : '0';
}

function checkpointOpts(list: string[]): string[] {
  return list.length > 0 ? list : ['sd_xl_base_1.0', 'juggernautXL_v9', 'ponyDiffusion_v6'];
}

function modelOpts(list: string[], fallback: string[]): string[] {
  return (['— none —'] as string[]).concat(list.length > 0 ? list : fallback);
}

function variantUrl(images: string[], index: number): string | null {
  if (images.length > 0 && images[index]) return images[index];
  return null;
}

const PortraitScreen: React.FC = () => {
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [activeCharId, setActiveCharId] = useState(0);
  const [activeChar, setActiveChar] = useState<compose.Character | null>(null);
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const [workflow, setWorkflow] = useState(PORTRAIT_WORKFLOWS[0]);
  const [steps, setSteps] = useState(28);
  const [cfg, setCfg] = useState(7);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 4e9));
  const [denoise, setDenoise] = useState(1);
  const [sampler, setSampler] = useState('dpmpp_2m');
  const [scheduler, setScheduler] = useState('karras');
  const [promptStyle, setPromptStyle] = useState<'natural' | 'danbooru'>('natural');
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const [vaes, setVaes] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [savedPortrait, setSavedPortrait] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    samplers, schedulers, checkpoints, checkpoint, setCheckpoint, allWorkflows,
    generating, progress, variantImages, selectedVariant, setSelectedVariant,
    clearVariants, stop, runGeneration,
  } = useImageGeneration({
    workflowId: workflow.id,
    workflowDefaults: PORTRAIT_WORKFLOWS,
    generate: GeneratePortrait,
    completionBody: n => `${n} portrait variants ready.`,
    initialCheckpoint: 'sd_xl_base_1.0',
  });

  useEffect(() => {
    GetCharacters().then(chars => {
      setCharacters(chars);
      if (chars.length > 0) {
        setActiveCharId(chars[0].id);
        setActiveChar(chars[0]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyVAEs().then(setVaes).catch(() => {});
    GetComfyLoRAs().then(setLoras).catch(() => {});
  }, []);

  // Restore the character's saved portrait so it survives leaving and
  // returning to this screen (each screen fully unmounts on tab switch).
  // Switching characters re-fetches; a character with no portrait decodes to
  // null, which also clears any previously shown portrait.
  useEffect(() => {
    if (!activeCharId) return;
    GetPortrait(activeCharId)
      .then(bytes => setSavedPortrait(arrayBufferToDataURL(bytes) || null))
      .catch(() => {});
  }, [activeCharId]);

  const persistPortrait = async (dataUrl: string) => {
    if (!dataUrl || !activeCharId) return;
    try {
      await SavePortrait(activeCharId, dataURLToBytes(dataUrl));
      setSavedPortrait(dataUrl);
      toast({ kind: 'ok', title: 'Portrait saved', body: 'Portrait attached to character.' });
    } catch (e) {
      toast({ kind: 'bad', title: 'Save failed', body: String(e) });
    }
  };

  const canvasTitle = 'Preview';
  const previewImage = variantUrl(variantImages, selectedVariant) ?? savedPortrait;
  const showDonePlaceholder = previewImage !== null;

  return (
    <>
      <PageHead step={5} subtitle="Make or import a face"
        title={<>Conjure a <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>portrait</em></>}
        actions={
            <div style={{ width: 240 }} className="img-tabs">
              <button data-on={activeState(mode, 'generate')} onClick={() => setMode('generate')}>
                <SparksIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Generate
              </button>
              <button data-on={activeState(mode, 'upload')} onClick={() => setMode('upload')}>
                <UploadIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Upload
              </button>
            </div>
        } />

      <div className="character-strip">
        {characters.map(c => (
          <button key={c.id} className="cs-pill" data-on={activeState(activeCharId, c.id)}
            onClick={async () => { setActiveCharId(c.id); await SetActiveCharacter(c.id); const ch = await GetActiveCharacter(); setActiveChar(ch); }}>
            <span className="cs-av">{getInitial(c.name)}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      <div className="ss-page-body scroll">
        {mode === 'generate' ? (
          <div className="img-grid">
            <GenerationParamsPanel
              aria-label="Portrait generation parameters"
              workflows={allWorkflows}
              selectedWorkflow={workflow}
              onWorkflowChange={w => { setWorkflow(w); setSteps(w.steps); setSampler(w.sampler); setScheduler(w.scheduler); }}
              steps={steps} onStepsChange={setSteps}
              cfg={cfg} onCfgChange={setCfg}
              denoise={denoise} onDenoiseChange={setDenoise}
              sampler={sampler} onSamplerChange={setSampler}
              scheduler={scheduler} onSchedulerChange={setScheduler}
              seed={seed} onSeedChange={setSeed}
              samplerList={samplers}
              schedulerList={schedulers}
            >
              <span className="uplabel">Models</span>
              <div className="img-kv">
                <label htmlFor="portrait-checkpoint">Checkpoint</label>
                <Dropdown
                  id="portrait-checkpoint"
                  aria-label="Checkpoint"
                  value={checkpoint}
                  onChange={setCheckpoint}
                  options={checkpointOpts(checkpoints).map(c => ({ value: c, label: c.replace(/\.safetensors$/, '') }))}
                />
                <label htmlFor="portrait-vae">VAE</label>
                <Dropdown
                  id="portrait-vae"
                  aria-label="VAE"
                  defaultValue={modelOpts(vaes, ['sdxl_vae_fp16_fix', 'baked'])[0]}
                  options={modelOpts(vaes, ['sdxl_vae_fp16_fix', 'baked']).map(v => ({ value: v, label: v.replace(/\.safetensors$/, '') }))}
                />
                <label htmlFor="portrait-lora">LoRA</label>
                <Dropdown
                  id="portrait-lora"
                  aria-label="LoRA"
                  defaultValue={modelOpts(loras, ['oil_painting_v3'])[0]}
                  options={modelOpts(loras, ['oil_painting_v3']).map(l => ({ value: l, label: l.replace(/\.safetensors$/, '') }))}
                />
              </div>
            </GenerationParamsPanel>

            <ImageCanvasPanel
              canvasTitle={canvasTitle}
              workflowSize={workflow.size}
              seed={seed}
              generating={generating}
              progress={progress}
              steps={steps}
              showDonePlaceholder={showDonePlaceholder}
              idlePlaceholder={
                <div className="img-placeholder">
                  <ImageIcon size={28} style={{ opacity: 0.4 }} />
                  <div style={{ marginTop: 8 }}>portrait · {workflow.size}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.6, marginTop: 2 }}>press generate</div>
                </div>
              }
              donePlaceholder={
                previewImage ? (
                  <div className="img-placeholder" style={{ background: 'var(--panel-2)', overflow: 'hidden' }}>
                    <img src={previewImage} alt={`variant ${selectedVariant + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div className="img-placeholder" style={{ background: 'var(--panel-2)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <ImageIcon size={28} style={{ opacity: 0.4 }} />
                      <div style={{ marginTop: 8, fontSize: 12 }}>variant #{selectedVariant + 1}</div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 4, color: 'var(--ink-3)' }}>
                        seed {seed + selectedVariant} · {workflow.size}
                      </div>
                    </div>
                  </div>
                )
              }
              autoFillButton={
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="img-auto-fill" onClick={() => autoFillImagePrompt(activeChar, activeCharId, promptStyle, negPrompt, setPrompt, setNegPrompt)}>
                    <SparksIcon size={10} style={{ verticalAlign: -1 }} /> auto-fill from card
                  </button>
                  <Dropdown
                    className="as-mono"
                    aria-label="Prompt style"
                    value={promptStyle}
                    onChange={raw => setPromptStyle(raw as 'natural' | 'danbooru')}
                    options={[
                      { value: 'natural', label: 'Natural' },
                      { value: 'danbooru', label: 'Danbooru' },
                    ]}
                  />
                </div>
              }
              prompt={prompt}
              onPromptChange={setPrompt}
              negPrompt={negPrompt}
              onNegPromptChange={setNegPrompt}
              onToggleGenerate={generating ? stop : () => runGeneration({ size: workflow.size, seed, steps, cfg, sampler, scheduler, denoise, prompt, negPrompt, checkpoint })}
              onSavePreset={() => {}}
            />

            <ImageGalleryPanel
              headLabel="Generated"
              variantCount={variantImages.length}
              onClear={clearVariants}
              galleryContent={
                <div className="img-gallery">
                  {variantImages.map((imgUrl, i) => (
                    <button key={`${seed}-${i}`} type="button"
                      className="img-thumb" data-on={activeState(selectedVariant, i)}
                      onClick={() => setSelectedVariant(i)}>
                      <img src={imgUrl} alt={`variant ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              }
              showMetadata={variantImages.length > 0}
              selectedLabel={`Selected · #${selectedVariant + 1}`}
              metadataItems={[
                { label: 'Seed', value: String(seed + selectedVariant) },
                { label: 'Steps', value: String(steps) },
                { label: 'CFG', value: String(cfg) },
                { label: 'Size', value: workflow.size },
              ]}
              rerollLabel="Re-roll with these params"
              downloadLabel="Save PNG only"
              useImageLabel="Use as portrait"
              onUseImage={() => persistPortrait(variantImages[selectedVariant])}
              useImageDisabled={variantImages.length === 0}
            />
          </div>
        ) : (
          <ImageUploadPanel
            aspectRatio="4/5"
            dropText="Drop a portrait here"
            recommendedSize="PNG, JPG, WEBP · up to 8 MB"
            maxSize="Recommended 832 × 1216 for SillyTavern v2 cards"
            defaultCrop="Center 3:4"
            defaultResize="Fit to 832×1216"
            onUseImage={persistPortrait}
          />
        )}
      </div>
    </>
  );
};

export default PortraitScreen;
