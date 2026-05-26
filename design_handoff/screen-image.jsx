// ─── Portrait (ComfyUI) screen ─────────────────────────────

const WORKFLOWS = [
  { id: 'portrait_sdxl', name: 'portrait_sdxl_v3', model: 'sd_xl_base_1.0', size: '832×1216', steps: 28, sampler: 'dpmpp_2m_karras' },
  { id: 'illustrious',   name: 'illustrious_anime', model: 'noobaiXL_v07', size: '896×1152', steps: 30, sampler: 'euler_a' },
  { id: 'flux',          name: 'flux_dev_portrait', model: 'flux1-dev-fp8', size: '1024×1024', steps: 20, sampler: 'euler' },
];

function ImageGen({ onContinue, characters, activeCharId, activeChar, onSelectChar, onAddChar }) {
  const [mode, setMode] = React.useState('generate'); // generate | upload
  const [workflow, setWorkflow] = React.useState(WORKFLOWS[0]);
  const [steps, setSteps] = React.useState(28);
  const [cfg, setCfg] = React.useState(7.0);
  const [seed, setSeed] = React.useState(2814596043);
  const [denoise, setDenoise] = React.useState(1.0);
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [selected, setSelected] = React.useState(0);

  const [prompt, setPrompt] = React.useState(
    `(masterpiece, best quality, ultra detailed), half-elf woman, auburn shoulder-length hair, smoke-grey eyes, notched scar on left ear, sleeveless wine-stained leather doublet with tooled lark sigil, ornate rapier at hip, baldur's gate docks at dusk, moody amber lighting, oil painting style, cinematic`
  );
  const [neg, setNeg] = React.useState(
    `(worst quality, low quality, blurry), extra fingers, watermark, signature, deformed hands, text, frame, modern clothing`
  );

  const run = () => {
    setGenerating(true);
    setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p >= 100) { p = 100; clearInterval(t); setGenerating(false); }
      setProgress(p);
    }, 180);
  };

  const stepLabel = `step ${Math.round(progress / 100 * steps)} / ${steps}`;

  return (
    <>
      <PageHead step={5} subtitle="Make or import a face"
        title={<>Conjure a <em style={{fontStyle:'normal',color:'var(--acc)'}}>portrait</em></>}
        actions={
          <>
            <div style={{width:240}} className="img-tabs">
              <button data-on={mode==='generate'?'1':'0'} onClick={()=>setMode('generate')}><I.Sparks size={12} style={{verticalAlign:-2,marginRight:4}}/> Generate</button>
              <button data-on={mode==='upload'?'1':'0'} onClick={()=>setMode('upload')}><I.Upload size={12} style={{verticalAlign:-2,marginRight:4}}/> Upload</button>
            </div>
            <button className="btn primary" onClick={onContinue}>Continue to Preview <I.Arrow size={14}/></button>
          </>
        } />
      <CharacterStrip characters={characters} activeId={activeCharId}
                      onSelect={onSelectChar} onAdd={onAddChar}/>
      <div className="ss-page-body scroll">
        {mode === 'generate' ? (
          <div className="img-grid">
            {/* LEFT COLUMN — workflow + params */}
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
                  const w = WORKFLOWS.find(x => x.id === e.target.value);
                  setWorkflow(w); setSteps(w.steps);
                }} style={{fontSize:12, fontFamily:'var(--f-mono)'}}>
                  {WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.name} — {w.size}</option>)}
                </select>

                <div className="divline"/>
                <span className="uplabel">Sampler params</span>
                <div className="kv">
                  <label>Steps</label>
                  <input type="number" min={1} max={150} value={steps} onChange={e => setSteps(+e.target.value)}/>
                  <label>CFG scale</label>
                  <input type="number" step={0.1} min={0} max={30} value={cfg} onChange={e => setCfg(+e.target.value)}/>
                  <label>Denoise</label>
                  <input type="number" step={0.05} min={0} max={1} value={denoise} onChange={e => setDenoise(+e.target.value)}/>
                  <label>Sampler</label>
                  <select style={{width:'auto'}} defaultValue={workflow.sampler}>
                    <option>dpmpp_2m_karras</option><option>euler_a</option><option>euler</option><option>dpmpp_3m_sde</option>
                  </select>
                  <label>Scheduler</label>
                  <select style={{width:'auto'}} defaultValue="karras">
                    <option>karras</option><option>normal</option><option>exponential</option>
                  </select>
                </div>

                <div className="divline"/>
                <span className="uplabel">Seed</span>
                <div className="row" style={{gap:6}}>
                  <input className="field" value={seed} onChange={e => setSeed(+e.target.value || 0)} style={{flex:1, fontSize:12, fontFamily:'var(--f-mono)'}}/>
                  <button className="btn ghost icon" title="Randomize" onClick={() => setSeed(Math.floor(Math.random() * 4e9))}><I.Dice size={14}/></button>
                </div>
                <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12, marginTop:4}}>
                  <input type="checkbox" defaultChecked style={{accentColor:'var(--acc)'}}/> Increment seed each run
                </label>

                <div className="divline"/>
                <span className="uplabel">Models</span>
                <div className="kv">
                  <label>Checkpoint</label>
                  <select style={{width:'auto'}} defaultValue="sdxl">
                    <option value="sdxl">sd_xl_base_1.0</option>
                    <option>juggernautXL_v9</option>
                    <option>ponyDiffusion_v6</option>
                  </select>
                  <label>VAE</label>
                  <select style={{width:'auto'}}>
                    <option>sdxl_vae_fp16_fix</option>
                    <option>baked</option>
                  </select>
                  <label>LoRA</label>
                  <select style={{width:'auto'}}>
                    <option>— none —</option>
                    <option>oil_painting_v3 · 0.8</option>
                    <option>baldursgate_portraits · 0.6</option>
                  </select>
                </div>
              </div>
            </div>

            {/* MIDDLE — preview canvas + prompt */}
            <div className="img-col">
              <div className="h">
                <b>{generating ? 'Sampling…' : 'Preview'}</b>
                <span style={{font:'500 10.5px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--ink-3)'}}>
                  {workflow.size} · seed {seed}
                </span>
              </div>
              <div className="img-canvas">
                {!generating && (
                  <div className="placeholder">
                    <div style={{textAlign:'center'}}>
                      <I.Image size={28} style={{opacity:0.4}}/>
                      <div style={{marginTop:8}}>portrait · 832×1216</div>
                      <div style={{fontSize:9.5, opacity:0.6, marginTop:2}}>press generate</div>
                    </div>
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
                {!generating && (
                  <div className="gen-meta">
                    last · 3.4s · 28 steps<br/>
                    dpmpp_2m_karras · cfg 7.0
                  </div>
                )}
              </div>
              <div className="f" style={{flexDirection:'column', gap:8, alignItems:'stretch'}}>
                <span className="uplabel">Positive prompt
                  <button style={{float:'right', background:'none', border:0, color:'var(--acc)', cursor:'pointer', font:'500 10px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.1em'}}>
                    <I.Sparks size={10} style={{verticalAlign:-1}}/> auto-fill from card
                  </button>
                </span>
                <textarea className="field" value={prompt} onChange={e => setPrompt(e.target.value)} style={{minHeight:78, fontFamily:'var(--f-mono)', fontSize:11.5}}/>
                <span className="uplabel">Negative prompt</span>
                <textarea className="field" value={neg} onChange={e => setNeg(e.target.value)} style={{minHeight:48, fontFamily:'var(--f-mono)', fontSize:11.5}}/>
                <div className="row" style={{gap:8, marginTop:4}}>
                  <button className="btn primary" onClick={run} disabled={generating} style={{flex:1, justifyContent:'center'}}>
                    {generating ? <><I.Stop size={12}/> Stop ({Math.round(progress)}%)</> : <><I.Play size={12}/> Queue generation</>}
                  </button>
                  <button className="btn ghost icon" title="Save preset" onClick={() => window.toast && window.toast({
                    kind: 'ok', title: 'Preset saved',
                    body: `${workflow.name} · cfg ${cfg} · ${steps} steps · seed ${seed} stored as a one-click preset.`,
                  })}><I.Save size={14}/></button>
                </div>
              </div>
            </div>

            {/* RIGHT — gallery */}
            <div className="img-col">
              <div className="h"><b>Generated · 4</b>
                <button className="btn ghost sm"><I.Trash size={11}/></button>
              </div>
              <div className="b scroll">
                <div className="gallery">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="thumb" data-on={selected === i ? '1' : '0'} onClick={() => setSelected(i)}>
                      <span className="meta">{(seed + i).toString().slice(-6)}</span>
                    </div>
                  ))}
                </div>
                <div className="divline"/>
                <span className="uplabel">Selected · #{selected + 1}</span>
                <div className="kv">
                  <label>Seed</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{seed + selected}</span>
                  <label>Steps</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{steps}</span>
                  <label>CFG</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{cfg}</span>
                  <label>Time</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>3.4s</span>
                  <label>Size</label><span className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{workflow.size}</span>
                </div>
                <div className="divline"/>
                <button className="btn ghost sm" style={{justifyContent:'center'}}><I.Reroll size={11}/> Re-roll with these params</button>
                <button className="btn ghost sm" style={{justifyContent:'center'}} onClick={() => window.toast && window.toast({
                  kind: 'ok', title: 'Portrait saved',
                  body: `image_${(seed + selected).toString(36)}.png written to output folder.`,
                })}><I.Download size={11}/> Save PNG only</button>
              </div>
              <div className="f">
                <button className="btn primary" style={{flex:1, justifyContent:'center'}} onClick={onContinue}>
                  <I.Check size={13}/> Use as portrait
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ImageUpload onContinue={onContinue}/>
        )}
      </div>
    </>
  );
}

function ImageUpload({ onContinue }) {
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState(null);
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:24, maxWidth: 1100, margin: '20px auto 0'}}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); setFile({name:'portrait.png', size:'1.2 MB', dims:'832×1216'}); }}
        onClick={() => setFile({name:'portrait.png', size:'1.2 MB', dims:'832×1216'})}
        style={{
          aspectRatio:'4/5',
          border:`2px dashed ${dragging ? 'var(--acc)' : 'var(--hair-strong)'}`,
          background: dragging ? 'var(--acc-soft)' : 'var(--panel)',
          borderRadius:8, display:'grid', placeItems:'center',
          cursor:'pointer', transition:'all .15s'
        }}>
        {!file ? (
          <div className="col" style={{alignItems:'center', textAlign:'center', gap:12}}>
            <I.Upload size={32} style={{color:'var(--ink-3)'}}/>
            <div className="serif-i" style={{fontSize:28}}>Drop a portrait here</div>
            <div className="helpr">PNG, JPG, WEBP · up to 8 MB<br/>Recommended 832 × 1216 for SillyTavern v2 cards</div>
            <button className="btn ghost"><I.Folder size={14}/> Browse files</button>
          </div>
        ) : (
          <div style={{
            width:'70%', aspectRatio:'3/4',
            backgroundColor:'var(--panel-2)',
            backgroundImage:'repeating-linear-gradient(135deg, transparent 0 11px, var(--hair) 11px 12px)',
            border:'1px solid var(--hair)', borderRadius:4,
            display:'grid', placeItems:'center', color:'var(--ink-3)',
            font:'500 10.5px/1 var(--f-mono)', textTransform:'uppercase', letterSpacing:'0.1em'
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
                <select style={{width:'auto'}}><option>Center 3:4</option><option>Top 3:4</option><option>None</option></select>
                <label>Resize</label>
                <select style={{width:'auto'}}><option>Fit to 832×1216</option><option>Original</option></select>
              </div>
              <button className="btn primary" style={{justifyContent:'center', marginTop:4}} onClick={onContinue}>
                <I.Check size={13}/> Use as portrait
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

Object.assign(window, { ImageGen });
