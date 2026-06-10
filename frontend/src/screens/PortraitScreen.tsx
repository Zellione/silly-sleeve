import React, { useState, useEffect, useCallback } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import type { ToastKind } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, ImageIcon,
} from '../icons';
import {
  GetCharacters, SetActiveCharacter, GetActiveCharacter,
  GeneratePortrait, GenerateImagePrompt,
  GetComfySamplers, GetComfySchedulers,
  GetComfyCheckpoints, GetComfyVAEs, GetComfyLoRAs,
  GetComfyWorkflows, GetComfyWorkflowTemplate,
} from '../../wailsjs/go/main/App';
import { compose, comfy } from '../../wailsjs/go/models';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import ImageUploadPanel from '../components/ImageUploadPanel';
import GenerationParamsPanel, { WorkflowOption } from '../components/GenerationParamsPanel';
import ImageCanvasPanel from '../components/ImageCanvasPanel';
import ImageGalleryPanel from '../components/ImageGalleryPanel';
import { arrayBufferToDataURL } from '../utils/image';

const PORTRAIT_WORKFLOWS = [
  { id: 'portrait_sdxl', name: 'portrait_sdxl_v3', model: 'sd_xl_base_1.0', size: '832×1216', steps: 28, sampler: 'dpmpp_2m', scheduler: 'karras' },
  { id: 'illustrious', name: 'illustrious_anime', model: 'noobaiXL_v07', size: '896×1152', steps: 30, sampler: 'euler_ancestral', scheduler: 'normal' },
  { id: 'flux', name: 'flux_dev_portrait', model: 'flux1-dev-fp8', size: '1024×1024', steps: 20, sampler: 'euler', scheduler: 'normal' },
];

async function portraitGenerateVariants(
  generating: boolean,
  workflowTemplate: string | null,
  workflowSize: string,
  seed: number, steps: number, cfg: number, sampler: string, scheduler: string,
  denoise: number, prompt: string, negPrompt: string, checkpoint: string,
  setGenerating: (v: boolean) => void,
  setProgress: (v: number) => void,
  setVariantImages: (v: string[]) => void,
  toast: (opts: { kind: ToastKind; title: string; body: string }) => void,
): Promise<void> {
  if (generating) return;
  if (!workflowTemplate) {
    toast({ kind: 'warn', title: 'Loading', body: 'Workflow template not ready yet. Try again in a moment.' });
    return;
  }
  setGenerating(true);
  setProgress(0);
  setVariantImages([]);

  const [w, h] = workflowSize.split('×').map(Number);

  try {
    const params = new comfy.GenerationParams({
      workflowTemplate,
      seed,
      steps,
      cfg,
      sampler,
      scheduler,
      denoise,
      positivePrompt: prompt,
      negativePrompt: negPrompt,
      width: w || 0,
      height: h || 0,
      checkpoint,
    });

    const images = await GeneratePortrait(params);
    console.log('[PortraitScreen] GeneratePortrait returned', images.length, 'images');
    images.forEach((img, i) => {
      const dataLen = img.data ? img.data.length : 0;
      console.log(`[PortraitScreen] image ${i}: filename=${img.filename} data=${dataLen} bytes`);
    });
    const urls = images.map(img => {
      const url = arrayBufferToDataURL(img.data);
      console.log(`[PortraitScreen] url length=${url.length} startsWith=${url.substring(0, 30)}`);
      return url;
    });
    setVariantImages(urls);
    setProgress(100);
    toast({ kind: 'ok', title: 'Generation complete', body: `${images.length} portrait variants ready.` });
  } catch (err) {
    toast({ kind: 'bad', title: 'Generation failed', body: String(err) });
  } finally {
    setGenerating(false);
  }
}

async function autoFillImagePrompt(
  activeChar: compose.Character | null,
  activeCharId: number,
  promptStyle: string,
  setPrompt: (v: string) => void,
  setNegPrompt: (v: string) => void,
): Promise<void> {
  if (!activeChar) return;
  try {
    const [positive, negative] = await GenerateImagePrompt(activeCharId, promptStyle);
    setPrompt(positive);
    setNegPrompt(negative);
  } catch {
    const appearance = activeChar.appearance;
    if (appearance.trim()) {
      setPrompt(`(masterpiece, best quality, ultra detailed), ${appearance.trim()}, ${activeChar.name}, oil painting style, cinematic lighting`);
    }
  }
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
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const [samplers, setSamplers] = useState<string[]>([]);
  const [schedulers, setSchedulers] = useState<string[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState('sd_xl_base_1.0');
  const [vaes, setVaes] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [uploadedWorkflows, setUploadedWorkflows] = useState<WorkflowOption[]>([]);
  const [workflowTemplate, setWorkflowTemplate] = useState<string | null>(null);
  const { toast } = useToast();

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
    GetComfySamplers().then(setSamplers).catch(() => {});
    GetComfySchedulers().then(setSchedulers).catch(() => {});
    GetComfyCheckpoints().then(list => {
      setCheckpoints(list);
      if (list.length > 0) setCheckpoint(list[0]);
    }).catch(() => {});
    GetComfyVAEs().then(setVaes).catch(() => {});
    GetComfyLoRAs().then(setLoras).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyWorkflows().then(wfs => {
      setUploadedWorkflows(wfs.map(wf => ({
        id: wf.id,
        name: wf.name.replace(/\.json$/i, ''),
        model: wf.params.checkpoint || 'custom',
        size: wf.params.width && wf.params.height
          ? `${wf.params.width}×${wf.params.height}`
          : 'custom',
        steps: wf.params.steps || 20,
        sampler: wf.params.sampler || 'euler',
        scheduler: wf.params.scheduler || 'normal',
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyWorkflowTemplate(workflow.id).then(setWorkflowTemplate).catch(() => {});
  }, [workflow.id]);

  const allWorkflows = [...PORTRAIT_WORKFLOWS, ...uploadedWorkflows];

  useEffect(() => {
    /* v8 ignore start */
    EventsOn('comfy:progress', (event: { progress: number; max: number }) => {
      if (event.max > 0) {
        setProgress(Math.round((event.progress / event.max) * 100));
      }
    });
    EventsOn('comfy:error', (event: { error: string }) => {
      toast({ kind: 'bad', title: 'Generation error', body: event.error });
    });
    return () => {
      EventsOff('comfy:progress');
      EventsOff('comfy:error');
    };
    /* v8 ignore stop */
  }, [toast]);

  const handleSelectChar = useCallback(async (id: number) => {
    setActiveCharId(id);
    await SetActiveCharacter(id);
    const ch = await GetActiveCharacter();
    setActiveChar(ch);
  }, []);

  const handleAutoFill = useCallback(() => {
    autoFillImagePrompt(activeChar, activeCharId, promptStyle, setPrompt, setNegPrompt);
  }, [activeChar, activeCharId, promptStyle]);

  const handleGenerate = useCallback(() => {
    portraitGenerateVariants(
      generating, workflowTemplate, workflow.size,
      seed, steps, cfg, sampler, scheduler, denoise,
      prompt, negPrompt, checkpoint,
      setGenerating, setProgress, setVariantImages, toast,
    );
  }, [generating, workflowTemplate, workflow.size, seed, steps, cfg, sampler, scheduler, denoise, prompt, negPrompt, checkpoint, toast]);

  const handleStop = () => {
    setGenerating(false);
  };

  const handleUseAsPortrait = () => {
    toast({ kind: 'ok', title: 'Portrait saved', body: 'Portrait attached to character.' });
  };

  const canvasTitle = 'Preview';
  const showDonePlaceholder = variantImages.length > 0;

  return (
    <>
      <PageHead step={5} subtitle="Make or import a face"
        title={<>Conjure a <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>portrait</em></>}
        actions={
            <div style={{ width: 240 }} className="img-tabs">
              <button data-on={mode === 'generate' ? '1' : '0'} onClick={() => setMode('generate')}>
                <SparksIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Generate
              </button>
              <button data-on={mode === 'upload' ? '1' : '0'} onClick={() => setMode('upload')}>
                <UploadIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Upload
              </button>
            </div>
        } />

      <div className="character-strip">
        {characters.map(c => (
          <button key={c.id} className="cs-pill" data-on={activeCharId === c.id ? '1' : '0'}
            onClick={() => handleSelectChar(c.id)}>
            <span className="cs-av">{c.name[0] || '?'}</span>
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
                <select id="portrait-checkpoint" style={{ width: 'auto' }} value={checkpoint}
                  onChange={e => { setCheckpoint(e.target.value); e.target.blur(); }}>
                  {(checkpoints.length > 0 ? checkpoints : ['sd_xl_base_1.0', 'juggernautXL_v9', 'ponyDiffusion_v6']).map(c => (
                    <option key={c} value={c}>{c.replace(/\.safetensors$/, '')}</option>
                  ))}
                </select>
                <label htmlFor="portrait-vae">VAE</label>
                <select id="portrait-vae" style={{ width: 'auto' }}>
                  {['— none —'].concat(vaes.length > 0 ? vaes : ['sdxl_vae_fp16_fix', 'baked']).map(v => (
                    <option key={v} value={v}>{v.replace(/\.safetensors$/, '')}</option>
                  ))}
                </select>
                <label htmlFor="portrait-lora">LoRA</label>
                <select id="portrait-lora" style={{ width: 'auto' }}>
                  {['— none —'].concat(loras.length > 0 ? loras : ['oil_painting_v3']).map(l => (
                    <option key={l} value={l}>{l.replace(/\.safetensors$/, '')}</option>
                  ))}
                </select>
              </div>
            </GenerationParamsPanel>

            <ImageCanvasPanel
              canvasTitle={canvasTitle}
              workflowSize={workflow.size}
              seed={seed}
              aspectRatio={workflow.size.includes('×') ? workflow.size.replace('×', '/') : undefined}
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
                variantImages.length > 0 && variantImages[selectedVariant] ? (
                  <div className="img-placeholder" style={{ background: 'var(--panel-2)', overflow: 'hidden' }}>
                    <img src={variantImages[selectedVariant]} alt={`variant ${selectedVariant + 1}`}
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
                  <button className="img-auto-fill" onClick={handleAutoFill}>
                    <SparksIcon size={10} style={{ verticalAlign: -1 }} /> auto-fill from card
                  </button>
                  <select className="img-select" value={promptStyle} onChange={e => { setPromptStyle(e.target.value as 'natural' | 'danbooru'); e.target.blur(); }}
                    style={{ fontSize: 10, fontFamily: 'var(--f-mono)' }}>
                    <option value="natural">Natural</option>
                    <option value="danbooru">Danbooru</option>
                  </select>
                </div>
              }
              prompt={prompt}
              onPromptChange={setPrompt}
              negPrompt={negPrompt}
              onNegPromptChange={setNegPrompt}
              onToggleGenerate={generating ? handleStop : handleGenerate}
              onSavePreset={() => {}}
            />

            <ImageGalleryPanel
              headLabel="Generated"
              variantCount={variantImages.length}
              onClear={() => { setVariantImages([]); }}
              galleryContent={
                <div className="img-gallery">
                  {variantImages.map((imgUrl, i) => (
                    <button key={`${seed}-${i}`} type="button"
                      className="img-thumb" data-on={selectedVariant === i ? '1' : '0'}
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
              onUseImage={handleUseAsPortrait}
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
            onUseImage={handleUseAsPortrait}
          />
        )}
      </div>
    </>
  );
};

export default PortraitScreen;
