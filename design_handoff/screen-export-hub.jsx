// ─── Export Hub ───────────────────────────────────────────
// Ship the whole project at once. Pick characters + lorebook entries,
// pick a format, choose a destination, watch the export queue run.

const EXPORT_FORMATS = [
  { id: 'png-v2',  name: 'Character PNG · v2 spec', sub: 'portrait + embedded JSON · sillytavern-ready', icon: 'Image' },
  { id: 'png-v3',  name: 'Character PNG · v3 (CCv3)', sub: '+ embedded lorebook + asset library', icon: 'Image' },
  { id: 'json',    name: 'JSON only', sub: 'no portrait · clean for diffs / version control', icon: 'Save' },
  { id: 'bundle',  name: 'Silly Sleeve bundle (.slv)', sub: 'everything · source · history · re-importable', icon: 'Folder' },
];

const LORE_ENTRY_PREVIEW = [
  { uid: 0, name: 'The Harpers — Faction',          order: 100, position: 0, chars: ['C1', 'C3'] },
  { uid: 1, name: 'The Elfsong tavern',             order: 80,  position: 1, chars: ['C1', 'C2'] },
  { uid: 2, name: 'Reithwin & the Shadow-curse',    order: 60,  position: 4, chars: ['C1'] },
  { uid: 3, name: 'Songthorn (rapier)',             order: 40,  position: 1, chars: ['C1'] },
  { uid: 4, name: 'World — Faerûn baseline',        order: 200, position: 0, chars: ['C1', 'C2', 'C3'] },
  { uid: 5, name: 'Elfsong — disembodied voice',    order: 50,  position: 4, chars: [] },
];

function ExportHub({ onFinish, characters }) {
  const [fmt, setFmt] = React.useState('png-v2');
  const [pickedChars, setPickedChars] = React.useState(characters.map(c => c.id));
  const [pickedEntries, setPickedEntries] = React.useState(LORE_ENTRY_PREVIEW.map(e => e.uid));
  const [embedLore, setEmbedLore] = React.useState(true);
  const [perChar, setPerChar] = React.useState(true);
  const [destination, setDestination] = React.useState('/Users/me/SillyTavern/public');
  const [phase, setPhase] = React.useState('idle'); // idle | running | done
  const [progress, setProgress] = React.useState(0);

  const toggleChar = (id) => setPickedChars(pickedChars.includes(id)
    ? pickedChars.filter(x => x !== id) : [...pickedChars, id]);
  const toggleEntry = (uid) => setPickedEntries(pickedEntries.includes(uid)
    ? pickedEntries.filter(x => x !== uid) : [...pickedEntries, uid]);

  const run = () => {
    setPhase('running'); setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 14 + 6;
      if (p >= 100) {
        p = 100; clearInterval(t); setProgress(100);
        setTimeout(() => { setPhase('done'); onFinish && onFinish(); }, 400);
      } else setProgress(p);
    }, 200);
  };

  const totalAssets = pickedChars.length + (embedLore ? 0 : 1);
  const sizeEstimate = (pickedChars.length * 1.4 + (embedLore ? 0 : 0.2)).toFixed(1);

  return (
    <>
      <PageHead step={7} subtitle="Ship the project"
        title={<>Export <em style={{fontStyle:'normal',color:'var(--acc)'}}>everything</em></>}
        actions={
          <>
            <button className="btn ghost"><I.Folder size={13}/> Reveal in Finder</button>
            <button className="btn ghost" disabled={pickedEntries.length === 0} onClick={() => {
              setPhase('running'); setProgress(0);
              setTimeout(() => { setProgress(100); setPhase('done'); onFinish && onFinish(); }, 900);
            }}>
              <I.Book size={13}/> Export lorebook ({pickedEntries.length})
            </button>
            <button className="btn primary" onClick={run} disabled={phase==='running' || pickedChars.length===0}>
              {phase === 'running' ? <><I.Stop size={13}/> Exporting… {Math.round(progress)}%</>
                                   : <><I.Download size={13}/> Export {pickedChars.length} {pickedChars.length===1?'character':'characters'}</>}
            </button>
          </>
        } />
      <div className="ss-page-body scroll">
        <div className="exp-grid">
          {/* LEFT — picker columns */}
          <div className="col" style={{gap:18}}>
            {/* characters picker */}
            <div className="exp-pane">
              <div className="exp-pane-h">
                <div>
                  <h3>Characters</h3>
                  <span className="helpr">{pickedChars.length} of {characters.length} selected</span>
                </div>
                <div className="row" style={{gap:6}}>
                  <button className="btn ghost sm" onClick={() => setPickedChars(characters.map(c => c.id))}>All</button>
                  <button className="btn ghost sm" onClick={() => setPickedChars([])}>None</button>
                </div>
              </div>
              <div className="exp-char-grid">
                {characters.map(c => {
                  const on = pickedChars.includes(c.id);
                  return (
                    <button key={c.id} className="exp-char" data-on={on?'1':'0'} onClick={() => toggleChar(c.id)}>
                      <div className="thumb">
                        <span className="av">{c.initial}</span>
                        <span className="check">{on && <I.Check size={12}/>}</span>
                      </div>
                      <div className="info">
                        <b>{c.name}</b>
                        <span className="ep">{c.epithet}</span>
                        <div className="meta">
                          <span>{c.tokens} tok</span>
                          <span>·</span>
                          <span>{c.ready ? 'ready' : 'incomplete'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* lorebook picker */}
            <div className="exp-pane">
              <div className="exp-pane-h">
                <div>
                  <h3>Lorebook entries</h3>
                  <span className="helpr">{pickedEntries.length} of {LORE_ENTRY_PREVIEW.length} selected · scope shown per entry</span>
                </div>
                <div className="row" style={{gap:6}}>
                  <button className="btn ghost sm" onClick={() => setPickedEntries(LORE_ENTRY_PREVIEW.map(e => e.uid))}>All</button>
                  <button className="btn ghost sm" onClick={() => setPickedEntries([])}>None</button>
                </div>
              </div>
              <div className="exp-lore-list">
                {LORE_ENTRY_PREVIEW.map(e => {
                  const on = pickedEntries.includes(e.uid);
                  return (
                    <button key={e.uid} className="exp-lore" data-on={on?'1':'0'} onClick={() => toggleEntry(e.uid)}>
                      <div className={'check' + (on ? ' on' : '')}>{on && <I.Check size={11}/>}</div>
                      <span className="uid">{String(e.uid).padStart(2,'0')}</span>
                      <div className="info">
                        <b>{e.name}</b>
                        <div className="links">
                          {e.chars.length === 0 ? (
                            <span className="link orphan">unscoped · injected always</span>
                          ) : (
                            e.chars.map(cid => {
                              const c = characters.find(x => x.id === cid);
                              return c ? <span key={cid} className="link"><span className="av">{c.initial}</span>{c.name.split(' ')[0]}</span> : null;
                            })
                          )}
                        </div>
                      </div>
                      <span className="ord">P{e.position} · {e.order}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — format, destination, run */}
          <div className="exp-side">
            <div className="card">
              <h4>Export format</h4>
              <div className="export-fmt">
                {EXPORT_FORMATS.map(f => (
                  <button key={f.id} data-on={fmt===f.id?'1':'0'} onClick={() => setFmt(f.id)}>
                    {React.createElement(I[f.icon], { size: 18 })}
                    <div><b>{f.name}</b><span>{f.sub}</span></div>
                  </button>
                ))}
              </div>
              <div className="divline"/>
              <div className="col" style={{gap:6}}>
                <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                  <input type="checkbox" checked={embedLore} onChange={() => setEmbedLore(!embedLore)} style={{accentColor:'var(--acc)'}}/>
                  Embed lorebook in each character (CCv3)
                </label>
                <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                  <input type="checkbox" checked={perChar} onChange={() => setPerChar(!perChar)} style={{accentColor:'var(--acc)'}}/>
                  Scope to per-character links
                </label>
                <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                  <input type="checkbox" defaultChecked style={{accentColor:'var(--acc)'}}/>
                  Include greeting messages
                </label>
                <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                  <input type="checkbox" style={{accentColor:'var(--acc)'}}/>
                  Strip generation metadata
                </label>
              </div>
            </div>

            <div className="card">
              <h4>Destination</h4>
              <div className="col" style={{marginTop:8, gap:8}}>
                <div className="row" style={{gap:6}}>
                  <input className="field" value={destination} onChange={e => setDestination(e.target.value)}
                         style={{fontFamily:'var(--f-mono)', fontSize:11}}/>
                  <button className="btn ghost icon"><I.Folder size={14}/></button>
                </div>
                <div className="exp-dest-paths">
                  <span className="mono">└─ characters/</span>
                  {pickedChars.map(id => {
                    const c = characters.find(x => x.id === id);
                    return c ? <span key={id} className="mono"> &nbsp;&nbsp; ├ {c.name.toLowerCase().replace(/\s+/g, '_')}.png</span> : null;
                  })}
                  {!embedLore && pickedEntries.length > 0 && (
                    <>
                      <span className="mono">└─ worldinfo/</span>
                      <span className="mono"> &nbsp;&nbsp; ├ harper_cell.json <span style={{color:'var(--ink-3)'}}>· {pickedEntries.length} entries</span></span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <h4>Summary</h4>
              <div className="exp-summary">
                <div><span>Characters</span><b>{pickedChars.length}</b></div>
                <div><span>Lore entries</span><b>{pickedEntries.length}</b></div>
                <div><span>Format</span><b className="mono">{fmt}</b></div>
                <div><span>Est. size</span><b className="mono">~{sizeEstimate} MB</b></div>
                <div><span>Est. tokens / char</span><b className="mono">1.0–2.1k</b></div>
              </div>
            </div>

            {phase === 'running' && (
              <div className="card">
                <h4>Export queue</h4>
                <div className="bar" style={{marginTop:10}}><i style={{width: progress + '%'}}/></div>
                <div className="exp-queue">
                  {pickedChars.map((id, i) => {
                    const c = characters.find(x => x.id === id);
                    const charProgress = Math.min(100, Math.max(0, (progress - i * (100/pickedChars.length)) * pickedChars.length));
                    const done = charProgress >= 100;
                    const running = charProgress > 0 && charProgress < 100;
                    return (
                      <div key={id} className="row" style={{justifyContent:'space-between', fontSize:11.5}}>
                        <span style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                          {done ? <I.Check size={11} style={{color:'var(--ok)'}}/>
                                : running ? <span className="dot warn" style={{boxShadow:'none'}}/>
                                          : <span className="dot idle" style={{boxShadow:'none'}}/>}
                          {c?.name}
                        </span>
                        <span className="mono" style={{color:'var(--ink-3)'}}>
                          {done ? 'done · 1.2 MB' : running ? 'writing…' : 'queued'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ExportHub });
