import React, { useState, useRef } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, CheckIcon, XIcon, ArrowIcon,
  DiceIcon, SaveIcon, TrashIcon, DownloadIcon, RerollIcon,
  FolderIcon, ImageIcon,
} from '../icons';

const PROJECT_IMG_WORKFLOWS = [
  { id: 'sdxl_cover', name: 'cover_sdxl_v2', model: 'sd_xl_base_1.0', size: '1344×768', steps: 26, sampler: 'dpmpp_2m_karras' },
  { id: 'flux_banner', name: 'flux_banner', model: 'flux1-dev-fp8', size: '1216×832', steps: 20, sampler: 'euler' },
  { id: 'painterly', name: 'painterly_square', model: 'juggernautXL_v9', size: '1024×1024', steps: 30, sampler: 'dpmpp_2m_karras' },
];

const ProjectImageScreen: React.FC = () => {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const [workflow, setWorkflow] = useState(PROJECT_IMG_WORKFLOWS[0]);
  const [steps, setSteps] = useState(26);
  const [cfg, setCfg] = useState(7);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 4e9));
  const [sampler, setSampler] = useState('dpmpp_2m_karras');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [variants, setVariants] = useState<number[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const generationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const generateVariants = () => {
    if (generating) return;
    /* v8 ignore start */
    setGenerating(true);
    setProgress(0);
    const newVariants: number[] = [];
    const seeds = [seed, seed + 1, seed + 2];

    let currentVariant = 0;
    generationRef.current = setInterval(() => {
      if (currentVariant >= 3) {
        const ref = generationRef.current;
        if (ref !== null) clearInterval(ref);
        generationRef.current = null;
        setGenerating(false);
        setProgress(100);
        setHasImage(true);
        toast({ kind: 'ok', title: 'Generation complete', body: '3 cover variants ready.' });
        return;
      }

      const variantProgress = Math.min(100, Math.max(0,
        ((currentVariant / 3) * 100) + (Math.random() * 30)
      ));

      if (variantProgress >= (currentVariant + 1) / 3 * 100) {
        newVariants.push(seeds[currentVariant]);
        setVariants([...newVariants]);
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

  const handleUseAsProjectImage = () => {
    toast({ kind: 'ok', title: 'Project image set', body: 'Cover art saved and will appear in exports.' });
  };

  const stepLabel = `step ${Math.round(progress / 100 * steps)} / ${steps}`;

  // Upload mode
  const [dragging, setDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<{ name: string; size: string; dims: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    /* v8 ignore start */
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setUploadFile({ name: file.name, size: `${sizeMB} MB`, dims: '? × ?' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    /* v8 ignore stop */
  };

  return (
    <>
      <PageHead step={4} subtitle="Cover art for the whole project"
        title={<>Project <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>image</em></>}
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

      <div className="ss-page-body scroll">
        {mode === 'generate' ? (
          <div className="proj-img-grid">
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
                  const w = PROJECT_IMG_WORKFLOWS.find(x => x.id === e.target.value);
                  if (w) { setWorkflow(w); setSteps(w.steps); setSampler(w.sampler); }
                }} style={{ fontSize: 12, fontFamily: 'var(--f-mono)' }}>
                  {PROJECT_IMG_WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.name} — {w.size}</option>)}
                </select>

                <div className="img-divline" />
                <span className="uplabel">Sampler params</span>
                <div className="img-kv">
                  <label>Steps</label>
                  <input type="number" min={1} max={150} value={steps} onChange={e => setSteps(+e.target.value)} />
                  <label>CFG scale</label>
                  <input type="number" step={0.1} min={0} max={30} value={cfg} onChange={e => setCfg(+e.target.value)} />
                  <label>Sampler</label>
                  <select value={sampler} onChange={e => setSampler(e.target.value)} style={{ width: 'auto' }}>
                    <option>dpmpp_2m_karras</option><option>euler_a</option><option>euler</option>
                  </select>
                  <label>Aspect</label>
                  <select style={{ width: 'auto' }} defaultValue="banner">
                    <option value="banner">Banner · 16:9</option>
                    <option value="cover">Cover · 3:2</option>
                    <option value="square">Square · 1:1</option>
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
                <span className="uplabel">Use project context</span>
                <div className="col" style={{ gap: 6 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--acc)' }} />
                    Mood from lorebook entries
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--acc)' }} />
                    Setting from &ldquo;World&rdquo; entry
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" style={{ accentColor: 'var(--acc)' }} />
                    Cameo characters in scene
                  </label>
                </div>
              </div>
            </div>

            <div className="img-col">
              <div className="img-col-head">
                <b>{generating ? 'Sampling…' : 'Project cover'}</b>
                <span className="img-col-sub">{workflow.size} · seed {seed}</span>
              </div>
              <div className="img-canvas" style={{ aspectRatio: '16/9' }}>
                {!generating && variants.length === 0 && !hasImage && (
                  <div className="img-placeholder">
                    <ImageIcon size={32} style={{ opacity: 0.4 }} />
                    <div style={{ marginTop: 10 }}>project cover</div>
                    <div style={{ fontSize: 10.5, opacity: 0.6, marginTop: 4 }}>press generate</div>
                  </div>
                )}
                {!generating && hasImage && (
                  <div className="img-placeholder proj-cover-shot">
                    <div className="proj-cover-name">Project Name</div>
                    <div className="proj-cover-sub">cover art · {workflow.size}</div>
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
                  <button className="img-auto-fill" onClick={() => toast({ kind: 'info', title: 'Auto-fill', body: 'Prompt will auto-fill from lorebook context when generation is queued.' })}>
                    <SparksIcon size={10} style={{ verticalAlign: -1 }} /> auto-fill from lorebook
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
                <b>Versions · {variants.length}</b>
                <button className="btn ghost sm" onClick={() => { setVariants([]); setHasImage(false); }}>
                  <TrashIcon size={11} />
                </button>
              </div>
              <div className="img-col-body scroll">
                <div className="proj-img-versions">
                  {variants.map((variantSeed, i) => (
                    <button key={variantSeed} className={`proj-img-version${selectedVariant === i ? ' on' : ''}`}
                      onClick={() => setSelectedVariant(i)}>
                      <div className="proj-version-thumb" />
                      <div className="proj-version-meta">
                        <b>v{i + 1}</b>
                        <span>{(variantSeed).toString().slice(-7)} · cfg {(cfg + i * 0.5).toFixed(1)}</span>
                      </div>
                      {selectedVariant === i && <CheckIcon size={13} style={{ color: 'var(--acc)' }} />}
                    </button>
                  ))}
                </div>
                {variants.length > 0 && (
                  <>
                    <div className="img-divline" />
                    <span className="uplabel">Selected · v{selectedVariant + 1}</span>
                    <div className="img-kv">
                      <label>Seed</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{seed + selectedVariant}</span>
                      <label>Steps</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{steps}</span>
                      <label>Workflow</label><span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{workflow.name}</span>
                      <label>Size</label><span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{workflow.size}</span>
                    </div>
                    <div className="img-divline" />
                    <button className="btn ghost sm" style={{ justifyContent: 'center', width: '100%' }}>
                      <RerollIcon size={11} /> Re-roll variants
                    </button>
                    <button className="btn ghost sm" style={{ justifyContent: 'center', width: '100%' }}>
                      <DownloadIcon size={11} /> Save PNG only
                    </button>
                  </>
                )}
              </div>
              <div className="img-col-foot">
                <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleUseAsProjectImage} disabled={variants.length === 0}>
                  <CheckIcon size={13} /> Use as project image
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="img-upload-grid">
            <div
              role="button" tabIndex={0}
              className={`img-dropzone${dragging ? ' dragging' : ''}`}
              style={{ aspectRatio: '16/9' }}
              onDragOver={e => { e.preventDefault(); /* v8 ignore next */ setDragging(true); }}
              onDragLeave={() => /* v8 ignore next */ { setDragging(false); }}
              onDrop={e => { /* v8 ignore start */ e.preventDefault(); setDragging(false); setUploadFile({ name: 'cover.png', size: '2.4 MB', dims: '1920×1080' }); /* v8 ignore stop */ }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              {!uploadFile ? (
                <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 12 }}>
                  <UploadIcon size={32} style={{ color: 'var(--ink-3)' }} />
                  <div className="serif-i" style={{ fontSize: 28 }}>Drop a cover image here</div>
                  <div className="helpr">PNG, JPG, WEBP · up to 16 MB<br />Recommended 1920 × 1080 (16:9) or 1024 × 1024 (square)</div>
                  <button className="btn ghost"><FolderIcon size={14} /> Browse files</button>
                </div>
              ) : (
                <div className="img-upload-preview" style={{ aspectRatio: '16/9' }}>
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
                      <select style={{ width: 'auto' }}><option>Center 16:9</option><option>Top 16:9</option><option>None</option></select>
                      <label>Resize</label>
                      <select style={{ width: 'auto' }}><option>Fit to 1920×1080</option><option>Original</option></select>
                    </div>
                    <button className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={handleUseAsProjectImage}>
                      <CheckIcon size={13} /> Use as project image
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

export default ProjectImageScreen;
