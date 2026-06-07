import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, CheckIcon, XIcon, ArrowIcon,
  DiceIcon, SaveIcon, TrashIcon, DownloadIcon, RerollIcon,
  FolderIcon, ImageIcon,
} from '../icons';
import {
  GetCharacters, SetActiveCharacter, GetActiveCharacter,
} from '../../wailsjs/go/main/App';
import { compose } from '../../wailsjs/go/models';

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
  const [cfg, setCfg] = useState(7.0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 4e9));
  const [denoise, setDenoise] = useState(1.0);
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

    setGenerating(true);
    setProgress(0);
    const variants: number[] = [];
    const seeds = [seed, seed + 1, seed + 2, seed + 3];

    let currentVariant = 0;
    generationRef.current = setInterval(() => {
      if (currentVariant >= 4) {
        clearInterval(generationRef.current!);
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
  };

  const handleStop = () => {
    if (generationRef.current) {
      clearInterval(generationRef.current);
      generationRef.current = null;
    }
    setGenerating(false);
  };

  // Upload mode state
  const [dragging, setDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<{ name: string; size: string; dims: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDropClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setUploadFile({ name: file.name, size: `${sizeMB} MB`, dims: '? × ?' });
    if (fileInputRef.current) fileInputRef.current.value = '';
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
          <>
            <div style={{ width: 240 }} className="img-tabs">
              <button data-on={mode === 'generate' ? '1' : '0'} onClick={() => setMode('generate')}>
                <SparksIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Generate
              </button>
              <button data-on={mode === 'upload' ? '1' : '0'} onClick={() => setMode('upload')}>
                <UploadIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Upload
              </button>
            </div>
          </>
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
            <div className="img-col">
              <div className="img-col-head"><b>Workflow</b></div>
              <div className="img-col-body scroll">
                <div className="workflow-pill">
                  <div className="ic" style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>.json</div>
                  <div>
                    <b>{workflow.name}.json</b>
                    <span>{workflow.model} · {workflow.size}</span>
                  </div>
                </div>
                <select className="field" value={workflow.id} onChange={e => {
                  const w = PORTRAIT_WORKFLOWS.find(x => x.id === e.target.value);
                  if (w) { setWorkflow(w); setSteps(w.steps); setSampler(w.sampler); }
                }} style={{ fontSize: 12, fontFamily: 'var(--f-mono)' }}>
                  {PORTRAIT_WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.name} — {w.size}</option>)}
                </select>

                <div className="img-divline" />
                <span className="uplabel">Sampler params</span>
                <div className="img-kv">
                  <label>Steps</label>
                  <input type="number" min={1} max={150} value={steps} onChange={e => setSteps(+e.target.value)} />
                  <label>CFG scale</label>
                  <input type="number" step={0.1} min={0} max={30} value={cfg} onChange={e => setCfg(+e.target.value)} />
                  <label>Denoise</label>
                  <input type="number" step={0.05} min={0} max={1} value={denoise} onChange={e => setDenoise(+e.target.value)} />
                  <label>Sampler</label>
                  <select value={sampler} onChange={e => setSampler(e.target.value)} style={{ width: 'auto' }}>
                    <option>dpmpp_2m_karras</option><option>euler_a</option><option>euler</option><option>dpmpp_3m_sde</option>
                  </select>
                  <label>Scheduler</label>
                  <select value={scheduler} onChange={e => setScheduler(e.target.value)} style={{ width: 'auto' }}>
                    <option>karras</option><option>normal</option><option>exponential</option><option>simple</option>
                  </select>
                </div>

                <div className="img-divline" />
                <span className="uplabel">Seed</span>
                <div className="row" style={{ gap: 6 }}>
                  <input className="field" value={seed} onChange={e => setSeed(+e.target.value || 0)}
                    style={{ flex: 1, fontSize: 12, fontFamily: 'var(--f-mono)' }} />
                  <button className="btn ghost icon" title="Randomize" onClick={() => setSeed(Math.floor(Math.random() * 4e9))}>
                    <DiceIcon size={14} />
                  </button>
                </div>

                <div className="img-divline" />
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
              </div>
            </div>

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
                    <div key={i} className="img-thumb" data-on={selectedVariant === i ? '1' : '0'}
                      onClick={() => setSelectedVariant(i)}>
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
          <div className="img-upload-grid">
            <div
              className={`img-dropzone${dragging ? ' dragging' : ''}`}
              style={{ aspectRatio: '4/5' }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); setUploadFile({ name: 'portrait.png', size: '1.2 MB', dims: '832×1216' }); }}
              onClick={handleDropClick}
            >
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              {!uploadFile ? (
                <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 12 }}>
                  <UploadIcon size={32} style={{ color: 'var(--ink-3)' }} />
                  <div className="serif-i" style={{ fontSize: 28 }}>Drop a portrait here</div>
                  <div className="helpr">PNG, JPG, WEBP · up to 8 MB<br />Recommended 832 × 1216 for SillyTavern v2 cards</div>
                  <button className="btn ghost"><FolderIcon size={14} /> Browse files</button>
                </div>
              ) : (
                <div className="img-upload-preview">
                  <span>{uploadFile.dims}</span>
                </div>
              )}
            </div>
            <div className="col" style={{ gap: 14 }}>
              <div className="card" style={{ padding: 16 }}>
                <span className="uplabel">Selected file</span>
                {uploadFile ? (
                  <div className="col" style={{ gap: 8, marginTop: 8 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <ImageIcon size={20} />
                      <div className="col" style={{ gap: 2 }}>
                        <b style={{ fontSize: 13 }}>{uploadFile.name}</b>
                        <span className="helpr">{uploadFile.dims} · {uploadFile.size}</span>
                      </div>
                    </div>
                    <div className="img-divline" />
                    <div className="img-kv">
                      <label>Crop</label>
                      <select style={{ width: 'auto' }}><option>Center 3:4</option><option>Top 3:4</option><option>None</option></select>
                      <label>Resize</label>
                      <select style={{ width: 'auto' }}><option>Fit to 832×1216</option><option>Original</option></select>
                    </div>
                    <button className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={handleUseAsPortrait}>
                      <CheckIcon size={13} /> Use as portrait
                    </button>
                    <button className="btn ghost sm" onClick={() => setUploadFile(null)}>Choose a different file</button>
                  </div>
                ) : (
                  <div className="helpr" style={{ marginTop: 6 }}>None — drop or browse on the left.</div>
                )}
              </div>
              <div className="card" style={{ padding: 16 }}>
                <span className="uplabel">Or paste a URL</span>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <input className="field" placeholder="https://…" />
                  <button className="btn ghost"><DownloadIcon size={13} /></button>
                </div>
                <p className="helpr" style={{ marginTop: 8 }}>We'll fetch the image and store a local copy in your project.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PortraitScreen;
