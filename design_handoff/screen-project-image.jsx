// ─── Project image screen ─────────────────────────────────
// One project-level image (cover art, banner, mood-board). Per-character
// portraits stay on their own step.

const PROJECT_IMG_WORKFLOWS = [
  { id: 'sdxl_cover',   name: 'cover_sdxl_v2',     model: 'sd_xl_base_1.0',  size: '1344×768',  steps: 26, sampler: 'dpmpp_2m_karras' },
  { id: 'flux_banner',  name: 'flux_banner',       model: 'flux1-dev-fp8',   size: '1216×832',  steps: 20, sampler: 'euler' },
  { id: 'painterly',    name: 'painterly_square',  model: 'juggernautXL_v9', size: '1024×1024', steps: 30, sampler: 'dpmpp_2m_karras' },
];

function ProjectImage({ onContinue, project }) {
  const [mode, setMode] = React.useState('generate');
  const [workflow, setWorkflow] = React.useState(PROJECT_IMG_WORKFLOWS[0]);
  const [steps, setSteps] = React.useState(workflow.steps);
  const [cfg, setCfg] = React.useState(7.0);
  const [seed, setSeed] = React.useState(1840352711);
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [selected, setSelected] = React.useState(0);
  const [hasImage, setHasImage] = React.useState(false);

  const [prompt, setPrompt] = React.useState(
    `wide cinematic establishing shot, the docks of Baldur's Gate at dusk, lamplit cobblestone, fog rolling in from the Chionthar, silhouetted tavern with the silver harp sigil hanging over the door, moody oil-painting style, warm amber lights against blue gloom, no characters in foreground`
  );
  const [neg, setNeg] = React.useState(
    `(worst quality, low quality, blurry), watermark, signature, text, frame, modern buildings, vehicles`
  );

  const run = () => {
    setGenerating(true);
    setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p >= 100) {
        p = 100; clearInterval(t);
        setGenerating(false); setHasImage(true);
      }
      setProgress(p);
    }, 180);
  };

  const projectName = project?.name || 'Untitled project';
  const stepLabel = `step ${Math.round(progress / 100 * steps)} / ${steps}`;

  return (
    <>
      <PageHead step={4} subtitle="Cover art for the whole project"
        title={<>Project <em style={{fontStyle:'normal',color:'var(--acc)'}}>image</em></>}
        actions={
          <>
            <div style={{width:240}} className="img-tabs">
              <button data-on={mode==='generate'?'1':'0'} onClick={()=>setMode('generate')}><I.Sparks size={12} style={{verticalAlign:-2,marginRight:4}}/> Generate</button>
              <button data-on={mode==='upload'?'1':'0'} onClick={()=>setMode('upload')}><I.Upload size={12} style={{verticalAlign:-2,marginRight:4}}/> Upload</button>
            </div>
            <button className="btn primary" onClick={onContinue}>Continue to Portrait <I.Arrow size={14}/></button>
          </>
        } />
      <div className="ss-page-body scroll">
        {mode === 'generate' ? (
          <div className="proj-img-grid">
            {/* LEFT — workflow + params */}
            <div className="img-col">
              <div className="h"><b>Workflow</b>
                <button className="btn ghost sm"><I.Upload size={11}/> .json</button>
              </div>
              <div className="b scroll">
                <div className="workflow-pill">
                  <div className="ic"><I.Node size={16}/></div>
                  <div>
                    <b>{workflow.name}.json</b>
                    <span>{workflow.model} · {workflow.size}</span>
                  </div>
                </div>
                <select className="field" value={workflow.id} onChange={e => {
                  const w = PROJECT_IMG_WORKFLOWS.find(x => x.id === e.target.value);
                  setWorkflow(w); setSteps(w.steps);
                }} style={{fontSize:12, fontFamily:'var(--f-mono)'}}>
                  {PROJECT_IMG_WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.name} — {w.size}</option>)}
                </select>

                <div className="divline"/>
                <span className="uplabel">Sampler params</span>
                <div className="kv">
                  <label>Steps</label>
                  <input type="number" min={1} max={150} value={steps} onChange={e => setSteps(+e.target.value)}/>
                  <label>CFG scale</label>
                  <input type="number" step={0.1} min={0} max={30} value={cfg} onChange={e => setCfg(+e.target.value)}/>
                  <label>Sampler</label>
                  <select style={{width:'auto'}} defaultValue={workflow.sampler}>
                    <option>dpmpp_2m_karras</option><option>euler_a</option><option>euler</option>
                  </select>
                  <label>Aspect</label>
                  <select style={{width:'auto'}} defaultValue="banner">
                    <option value="banner">Banner · 16:9</option>
                    <option value="cover">Cover · 3:2</option>
                    <option value="square">Square · 1:1</option>
                  </select>
                </div>

                <div className="divline"/>
                <span className="uplabel">Seed</span>
                <div className="row" style={{gap:6}}>
                  <input className="field" value={seed} onChange={e => setSeed(+e.target.value || 0)} style={{flex:1, fontSize:12, fontFamily:'var(--f-mono)'}}/>
                  <button className="btn ghost icon" title="Randomize" onClick={() => setSeed(Math.floor(Math.random() * 4e9))}><I.Dice size={14}/></button>
                </div>

                <div className="divline"/>
                <span className="uplabel">Use project context</span>
                <div className="col" style={{gap:6}}>
                  <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                    <input type="checkbox" defaultChecked style={{accentColor:'var(--acc)'}}/>
                    Mood from lorebook entries
                  </label>
                  <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                    <input type="checkbox" defaultChecked style={{accentColor:'var(--acc)'}}/>
                    Setting from "World" entry
                  </label>
                  <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                    <input type="checkbox" style={{accentColor:'var(--acc)'}}/>
                    Cameo characters in scene
                  </label>
                </div>
              </div>
            </div>

            {/* CENTER — preview */}
            <div className="img-col">
              <div className="h">
                <b>{generating ? 'Sampling…' : 'Project cover'}</b>
                <span style={{font:'500 10.5px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--ink-3)'}}>
                  {workflow.size} · seed {seed}
                </span>
              </div>
              <div className="img-canvas">
                {!generating && (
                  <div className="proj-cover-placeholder">
                    {hasImage ? (
                      <div className="proj-cover-shot">
                        <div className="proj-cover-name">{projectName}</div>
                        <div className="proj-cover-sub">cover art · {workflow.size}</div>
                      </div>
                    ) : (
                      <div style={{textAlign:'center'}}>
                        <I.Image size={32} style={{opacity:0.4}}/>
                        <div style={{marginTop:10, font:'500 11px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.14em'}}>project cover</div>
                        <div style={{fontSize:10.5, opacity:0.6, marginTop:4, fontFamily:'var(--f-mono)'}}>press generate</div>
                      </div>
                    )}
                  </div>
                )}
                {generating && (
                  <div className="generating" style={{flexDirection:'column'}}>
                    <div className="progress-disc"/>
                    <div style={{marginTop:14, font:'500 11px/1 var(--f-mono)', color:'var(--ink-2)', textTransform:'uppercase', letterSpacing:'0.14em'}}>
                      {stepLabel}
                    </div>
                    <div style={{marginTop:6, width:160}} className="bar"><i style={{width: progress + '%'}}/></div>
                  </div>
                )}
              </div>
              <div className="f" style={{flexDirection:'column', gap:8, alignItems:'stretch'}}>
                <span className="uplabel">Positive prompt
                  <button style={{float:'right', background:'none', border:0, color:'var(--acc)', cursor:'pointer', font:'500 10px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.1em'}}>
                    <I.Sparks size={10} style={{verticalAlign:-1}}/> auto-fill from lorebook
                  </button>
                </span>
                <textarea className="field" value={prompt} onChange={e => setPrompt(e.target.value)} style={{minHeight:78, fontFamily:'var(--f-mono)', fontSize:11.5}}/>
                <span className="uplabel">Negative prompt</span>
                <textarea className="field" value={neg} onChange={e => setNeg(e.target.value)} style={{minHeight:48, fontFamily:'var(--f-mono)', fontSize:11.5}}/>
                <div className="row" style={{gap:8, marginTop:4}}>
                  <button className="btn primary" onClick={run} disabled={generating} style={{flex:1, justifyContent:'center'}}>
                    {generating ? <><I.Stop size={12}/> Stop ({Math.round(progress)}%)</> : <><I.Play size={12}/> Queue generation</>}
                  </button>
                  <button className="btn ghost icon" title="Save preset"><I.Save size={14}/></button>
                </div>
              </div>
            </div>

            {/* RIGHT — versions */}
            <div className="img-col">
              <div className="h"><b>Versions · 3</b>
                <button className="btn ghost sm"><I.Trash size={11}/></button>
              </div>
              <div className="b scroll">
                <div className="proj-img-versions">
                  {[0, 1, 2].map(i => (
                    <button key={i} className={'proj-img-version' + (selected === i ? ' on' : '')}
                            onClick={() => setSelected(i)}>
                      <div className="thumb"/>
                      <div className="meta">
                        <b>v{i + 1}</b>
                        <span>{(seed + i).toString().slice(-7)} · cfg {(cfg + i * 0.5).toFixed(1)}</span>
                      </div>
                      {selected === i && <I.Check size={13} style={{color:'var(--acc)'}}/>}
                    </button>
                  ))}
                </div>
                <div className="divline"/>
                <span className="uplabel">Selected · v{selected + 1}</span>
                <div className="kv">
                  <label>Seed</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{seed + selected}</span>
                  <label>Steps</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{steps}</span>
                  <label>Workflow</label><span className="mono" style={{fontSize:10, color:'var(--ink-2)'}}>{workflow.name}</span>
                  <label>Size</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{workflow.size}</span>
                </div>
                <div className="divline"/>
                <button className="btn ghost sm" style={{justifyContent:'center'}}>
                  <I.Reroll size={11}/> Re-roll variants
                </button>
                <button className="btn ghost sm" style={{justifyContent:'center'}} onClick={() => window.toast && window.toast({
                  kind: 'ok', title: 'Cover saved',
                  body: 'project_cover.png written to project folder.',
                })}><I.Download size={11}/> Save PNG only</button>
              </div>
              <div className="f">
                <button className="btn primary" style={{flex:1, justifyContent:'center'}} onClick={() => {
                  window.toast && window.toast({
                    kind: 'ok', title: 'Project image set',
                    body: 'This cover appears on the dashboard, in exports, and on shared links.',
                  });
                  onContinue && onContinue();
                }}>
                  <I.Check size={13}/> Use as project image
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ProjectImageUpload onContinue={onContinue}/>
        )}
      </div>
    </>
  );
}

function ProjectImageUpload({ onContinue }) {
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState(null);
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:24, maxWidth: 1100, margin: '20px auto 0'}}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); setFile({name:'harper_cell_cover.png', size:'2.4 MB', dims:'1920×1080'}); }}
        onClick={() => setFile({name:'harper_cell_cover.png', size:'2.4 MB', dims:'1920×1080'})}
        style={{
          aspectRatio:'16/9',
          border:`2px dashed ${dragging ? 'var(--acc)' : 'var(--hair-strong)'}`,
          background: dragging ? 'var(--acc-soft)' : 'var(--panel)',
          borderRadius:8, display:'grid', placeItems:'center',
          cursor:'pointer', transition:'all .15s'
        }}>
        {!file ? (
          <div className="col" style={{alignItems:'center', textAlign:'center', gap:12}}>
            <I.Upload size={32} style={{color:'var(--ink-3)'}}/>
            <div className="serif-i" style={{fontSize:28}}>Drop a cover image here</div>
            <div className="helpr">PNG, JPG, WEBP · up to 16 MB<br/>Recommended 1920 × 1080 (16:9 banner) or 1024 × 1024 (square)</div>
            <button className="btn ghost"><I.Folder size={14}/> Browse files</button>
          </div>
        ) : (
          <div style={{
            width:'80%', aspectRatio:'16/9',
            backgroundColor:'var(--panel-2)',
            backgroundImage:'repeating-linear-gradient(135deg, transparent 0 13px, var(--hair) 13px 14px)',
            border:'1px solid var(--hair)', borderRadius:4,
            display:'grid', placeItems:'center', color:'var(--ink-3)',
            font:'500 11px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.12em'
          }}>{file.dims}</div>
        )}
      </div>
      <div className="col" style={{gap:14}}>
        <div className="card" style={{padding:16}}>
          <span className="uplabel">Selected file</span>
          {file ? (
            <div className="col" style={{gap:8, marginTop:8}}>
              <div className="row" style={{gap:10}}>
                <I.Image size={20}/>
                <div className="col" style={{gap:2}}>
                  <b style={{fontSize:13}}>{file.name}</b>
                  <span className="helpr">{file.dims} · {file.size}</span>
                </div>
              </div>
              <div className="divline"/>
              <div className="kv">
                <label>Crop</label>
                <select style={{width:'auto'}}><option>Center 16:9</option><option>Top 16:9</option><option>None</option></select>
                <label>Resize</label>
                <select style={{width:'auto'}}><option>Fit to 1920×1080</option><option>Original</option></select>
              </div>
              <button className="btn primary" style={{justifyContent:'center', marginTop:4}} onClick={() => {
                window.toast && window.toast({
                  kind: 'ok', title: 'Project image set',
                  body: `${file.name} attached as project cover.`,
                });
                onContinue && onContinue();
              }}>
                <I.Check size={13}/> Use as project image
              </button>
              <button className="btn ghost sm" onClick={() => setFile(null)}>Choose a different file</button>
            </div>
          ) : (
            <div className="helpr" style={{marginTop:6}}>None — drop or browse on the left.</div>
          )}
        </div>
        <div className="card" style={{padding:16}}>
          <span className="uplabel">Or paste a URL</span>
          <div className="row" style={{gap:6, marginTop:8}}>
            <input className="field" placeholder="https://…"/>
            <button className="btn ghost"><I.Download size={13}/></button>
          </div>
          <p className="helpr" style={{marginTop:8}}>We'll fetch the image and store a local copy in your project.</p>
        </div>
      </div>
    </div>
  );
}

// Styles specific to project image screen
const __PROJ_IMG_STYLES = `
.proj-img-grid {
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(0, 1fr) minmax(240px, 280px);
  gap: 18px;
  height: calc(100vh - 175px);
}
@media (max-width: 1180px) {
  .proj-img-grid {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    grid-template-rows: 1fr auto;
    height: auto;
  }
  .proj-img-grid > .img-col:nth-child(3) {
    grid-column: 1 / -1;
    height: 320px;
  }
}
.proj-cover-placeholder {
  width: 80%; max-width: 540px;
  aspect-ratio: 16/9;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 13px, var(--hair) 13px 14px);
  border: 1px solid var(--hair);
  border-radius: 4px;
  display: grid; place-items: center;
  color: var(--ink-3);
}
.proj-cover-shot {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 24px;
  position: relative;
}
.proj-cover-shot::before {
  content: "";
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, transparent 50%, var(--ink) 100%),
    repeating-linear-gradient(135deg, transparent 0 13px, var(--hair) 13px 14px);
  z-index: 0;
}
.proj-cover-name {
  position: relative; z-index: 1;
  font: 400 32px/1 var(--f-display); font-style: italic;
  color: var(--bg);
  text-shadow: 0 2px 8px #000a;
}
.proj-cover-sub {
  position: relative; z-index: 1;
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--bg);
  opacity: 0.75;
  margin-top: 6px;
}
.proj-img-versions {
  display: flex; flex-direction: column; gap: 6px;
}
.proj-img-version {
  appearance: none;
  display: grid;
  grid-template-columns: 60px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 6px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  cursor: pointer;
  color: var(--ink);
  text-align: left;
}
.proj-img-version:hover { border-color: var(--hair-strong); }
.proj-img-version.on {
  border-color: var(--acc);
  background: var(--acc-soft);
}
.proj-img-version .thumb {
  width: 60px; height: 36px;
  border-radius: 3px;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 7px, var(--hair) 7px 8px);
  flex-shrink: 0;
}
.proj-img-version .meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.proj-img-version .meta b { font: 600 12px/1.2 var(--f-sans); }
.proj-img-version .meta span {
  font: 500 9.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ink-3);
}
`;

(function injectProjImgStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('proj-img-styles')) return;
  const s = document.createElement('style');
  s.id = 'proj-img-styles';
  s.textContent = __PROJ_IMG_STYLES;
  document.head.appendChild(s);
})();

Object.assign(window, { ProjectImage });
