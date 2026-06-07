import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, CheckIcon, XIcon, ArrowIcon,
  SaveIcon, TrashIcon, DownloadIcon, RerollIcon,
  ImageIcon,
} from '../icons';
import {
  GetCharacters, SetActiveCharacter, GetActiveCharacter,
} from '../../wailsjs/go/main/App';
import { compose } from '../../wailsjs/go/models';
import ImageUploadPanel from '../components/ImageUploadPanel';
import GenerationParamsPanel from '../components/GenerationParamsPanel';

const PORTRAIT_WORKFLOWS = [
  { id: 'portrait_sdxl', name: 'portrait_sdxl_v3', model: 'sd_xl_base_1.0', size: '832×1216', steps: 28, sampler: 'dpmpp_2m_karras' },
  { id: 'illustrious', name: 'illustrious_anime', model: 'noobaiXL_v07', size: '896×1152', steps: 30, sampler: 'euler_a' },
  { id: 'flux', name: 'flux_dev_portrait', model: 'flux1-dev-fp8', size: '1024×1024', steps: 20, sampler: 'euler' },
];

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
  const [sampler, setSampler] = useState('dpmpp_2m_karras');
  const [scheduler, setScheduler] = useState('karras');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [variants, setVariants] = useState<number[]>([]);
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const generationRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const handleSelectChar = useCallback(async (id: number) => {
    setActiveCharId(id);
    await SetActiveCharacter(id);
    const ch = await GetActiveCharacter();
    setActiveChar(ch);
  }, []);

  const handleAutoFill = () => {
    if (!activeChar) return;
    const appearance = activeChar.appearance;
    if (appearance.trim()) {
      setPrompt(`(masterpiece, best quality, ultra detailed), ${appearance.trim()}, ${activeChar.name}, oil painting style, cinematic lighting`);
    }
  };

  const generateVariants = () => {
    if (generating) return;
    /* v8 ignore start */
    setGenerating(true);
    setProgress(0);
    const variants: number[] = [];
    const seeds = [seed, seed + 1, seed + 2, seed + 3];

    let currentVariant = 0;
    generationRef.current = setInterval(() => {
      if (currentVariant >= 4) {
        const ref = generationRef.current;
        if (ref !== null) clearInterval(ref);
        generationRef.current = null;
        setGenerating(false);
        setProgress(100);
        toast({ kind: 'ok', title: 'Generation complete', body: '4 portrait variants ready.' });
        return;
      }

      const variantProgress = Math.min(100, Math.max(0,
        ((currentVariant / 4) * 100) + (Math.random() * 25)
      ));

      if (variantProgress >= (currentVariant + 1) / 4 * 100) {
        variants.push(seeds[currentVariant]);
        setVariants([...variants]);
        currentVariant++;
      }

      setProgress(variantProgress);
    }, 180);
    /* v8 ignore stop */
  };

  const handleStop = () => {
    /* v8 ignore start */
    if (generationRef.current) {
      clearInterval(generationRef.current);
      generationRef.current = null;
    }
    setGenerating(false);
    /* v8 ignore stop */
  };

  const handleUseAsPortrait = () => {
    toast({ kind: 'ok', title: 'Portrait saved', body: 'Portrait attached to character.' });
  };

  const stepLabel = `step ${Math.round(progress / 100 * steps)} / ${steps}`;

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
          <div className="img-grid" data-screen="portrait" title="Character portrait generation layout">
            <GenerationParamsPanel
              workflows={PORTRAIT_WORKFLOWS}
              selectedWorkflow={workflow}
              onWorkflowChange={w => { setWorkflow(w); setSteps(w.steps); setSampler(w.sampler); }}
              steps={steps} onStepsChange={setSteps}
              cfg={cfg} onCfgChange={setCfg}
              denoise={denoise} onDenoiseChange={setDenoise}
              sampler={sampler} onSamplerChange={setSampler}
              scheduler={scheduler} onSchedulerChange={setScheduler}
              seed={seed} onSeedChange={setSeed}
            >
              <span className="uplabel">Models</span>
              <div className="img-kv">
                <label>Checkpoint</label>
                <select style={{ width: 'auto' }} defaultValue="sdxl">
                  <option value="sdxl">sd_xl_base_1.0</option>
                  <option>juggernautXL_v9</option>
                  <option>ponyDiffusion_v6</option>
                </select>
                <label>VAE</label>
                <select style={{ width: 'auto' }}>
                  <option>sdxl_vae_fp16_fix</option>
                  <option>baked</option>
                </select>
                <label>LoRA</label>
                <select style={{ width: 'auto' }}>
                  <option>— none —</option>
                  <option>oil_painting_v3 · 0.8</option>
                </select>
              </div>
            </GenerationParamsPanel>

            <div className="img-col">
              <div className="img-col-head">
                <b>{generating ? 'Sampling…' : 'Preview'}</b>
                <span className="img-col-sub">{workflow.size} · seed {seed}</span>
              </div>
              <div className="img-canvas">
                {!generating && variants.length === 0 && (
                  <div className="img-placeholder">
                    <ImageIcon size={28} style={{ opacity: 0.4 }} />
                    <div style={{ marginTop: 8 }}>portrait · {workflow.size}</div>
                    <div style={{ fontSize: 9.5, opacity: 0.6, marginTop: 2 }}>press generate</div>
                  </div>
                )}
                {!generating && variants.length > 0 && (
                  <div className="img-placeholder" style={{ background: 'var(--panel-2)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <ImageIcon size={28} style={{ opacity: 0.4 }} />
                      <div style={{ marginTop: 8, fontSize: 12 }}>variant #{selectedVariant + 1}</div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 4, color: 'var(--ink-3)' }}>
                        seed {seed + selectedVariant} · {workflow.size}
                      </div>
                    </div>
                  </div>
                )}
                {generating && (
                  <div className="img-generating">
                    <div className="img-progress-disc" />
                    <div style={{ marginTop: 14, font: '500 11px/1 var(--f-mono)', color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      {stepLabel}
                    </div>
                    <div style={{ marginTop: 6, width: 160 }} className="bar"><i style={{ width: progress + '%' }} /></div>
                  </div>
                )}
              </div>
              <div className="img-col-foot">
                <span className="uplabel">
                  Positive prompt
                  <button className="img-auto-fill" onClick={handleAutoFill}>
                    <SparksIcon size={10} style={{ verticalAlign: -1 }} /> auto-fill from card
                  </button>
                </span>
                <textarea className="field" value={prompt} onChange={e => setPrompt(e.target.value)}
                  style={{ minHeight: 78, fontFamily: 'var(--f-mono)', fontSize: 11.5 }} />
                <span className="uplabel">Negative prompt</span>
                <textarea className="field" value={negPrompt} onChange={e => setNegPrompt(e.target.value)}
                  style={{ minHeight: 48, fontFamily: 'var(--f-mono)', fontSize: 11.5 }} />
                <div className="row" style={{ gap: 8, marginTop: 4 }}>
                  <button className="btn primary" onClick={generating ? handleStop : generateVariants} style={{ flex: 1, justifyContent: 'center' }}>
                    {generating ? (
                      <><XIcon size={12} /> Stop ({Math.round(progress)}%)</>
                    ) : (
                      <><ArrowIcon size={12} /> Queue generation</>
                    )}
                  </button>
                  <button className="btn ghost icon" title="Save preset"><SaveIcon size={14} /></button>
                </div>
              </div>
            </div>

            <div className="img-col">
              <div className="img-col-head">
                <b>Generated · {variants.length}</b>
                <button className="btn ghost sm" onClick={() => setVariants([])}><TrashIcon size={11} /></button>
              </div>
              <div className="img-col-body scroll">
                <div className="img-gallery">
                  {variants.map((variantSeed, i) => (
                    <div key={variantSeed} role="button" tabIndex={0}
                      className="img-thumb" data-on={selectedVariant === i ? '1' : '0'}
                      onClick={() => setSelectedVariant(i)}
                      /* v8 ignore next */
                      onKeyDown={e => { if (e.key === 'Enter') setSelectedVariant(i); }}>
                      <span className="img-thumb-label">{(variantSeed).toString().slice(-6)}</span>
                    </div>
                  ))}
                </div>
                {variants.length > 0 && (
                  <>
                    <div className="img-divline" />
                    <span className="uplabel">Selected · #{selectedVariant + 1}</span>
                    <div className="img-kv">
                      <label>Seed</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{seed + selectedVariant}</span>
                      <label>Steps</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{steps}</span>
                      <label>CFG</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{cfg}</span>
                      <label>Size</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{workflow.size}</span>
                    </div>
                    <div className="img-divline" />
                    <button className="btn ghost sm" style={{ justifyContent: 'center', width: '100%' }}>
                      <RerollIcon size={11} /> Re-roll with these params
                    </button>
                    <button className="btn ghost sm" style={{ justifyContent: 'center', width: '100%' }}>
                      <DownloadIcon size={11} /> Save PNG only
                    </button>
                  </>
                )}
              </div>
              <div className="img-col-foot">
                <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleUseAsPortrait} disabled={variants.length === 0}>
                  <CheckIcon size={13} /> Use as portrait
                </button>
              </div>
            </div>
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
