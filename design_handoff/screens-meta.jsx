// Dashboard + Settings screens.

const SAMPLE_PROJECTS = [
  {
    id: 'C-04', name: 'Astarion', epithet: 'The Spawn of Cazador',
    source: 'baldursgate.fandom.com', sourceShort: 'baldursgate · wiki',
    tags: ['vampire spawn', 'elf', 'rogue', 'companion'],
    updated: '2h ago', tokens: 1240, status: 'ready', portrait: true,
  },
  {
    id: 'C-03', name: 'Yennefer', epithet: 'of Vengerberg',
    source: 'witcher.fandom.com', sourceShort: 'witcher · wiki',
    tags: ['sorceress', 'aretuza'], updated: 'yesterday', tokens: 1850, status: 'draft', portrait: true,
  },
  {
    id: 'C-02', name: 'Aerith Gainsborough', epithet: 'Last of the Cetra',
    source: 'finalfantasy.fandom.com', sourceShort: 'ff · wiki',
    tags: ['cetra', 'flowergirl', 'midgar'], updated: '3d ago', tokens: 980, status: 'ready', portrait: true,
  },
  {
    id: 'C-01', name: 'Loghain Mac Tir', epithet: 'Hero of River Dane',
    source: 'dragonage.fandom.com', sourceShort: 'dragonage · wiki',
    tags: ['warrior', 'antagonist', 'fereldan'], updated: '1 wk ago', tokens: 2210, status: 'archived', portrait: false,
  },
  {
    id: 'C-00', name: 'Ciri', epithet: 'Lion Cub of Cintra',
    source: 'witcher.fandom.com', sourceShort: 'witcher · wiki',
    tags: ['witcher', 'elder blood'], updated: '2 wks ago', tokens: 1620, status: 'ready', portrait: true,
  },
];

function Dashboard({ onNav, onNew, projects = SAMPLE_PROJECTS }) {
  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const filtered = projects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const count = (s) => projects.filter(p => s === 'all' || p.status === s).length;

  return (
    <>
      <PageHead
        title={<>Your <em style={{fontStyle:'normal',color:'var(--acc)'}}>projects</em></>}
        actions={
          <>
            <button className="btn ghost"><I.Upload size={14}/> Import .png</button>
            <button className="btn primary" onClick={onNew}><I.Plus size={14}/> New project</button>
          </>
        } />
      <div className="ss-page-body scroll">
        <div className="dash-filters">
          <button className="chip" data-on={filter==='all'?'1':'0'} onClick={()=>setFilter('all')}>All <span className="count">{count('all')}</span></button>
          <button className="chip" data-on={filter==='draft'?'1':'0'} onClick={()=>setFilter('draft')}>Drafts <span className="count">{count('draft')}</span></button>
          <button className="chip" data-on={filter==='ready'?'1':'0'} onClick={()=>setFilter('ready')}>Ready <span className="count">{count('ready')}</span></button>
          <button className="chip" data-on={filter==='archived'?'1':'0'} onClick={()=>setFilter('archived')}>Archived <span className="count">{count('archived')}</span></button>
          <div className="search">
            <I.Search size={14}/>
            <input placeholder="Filter by name…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="emoji"><I.Sparks size={36}/></div>
            <h2>No characters yet. Start with a wiki page you love.</h2>
            <p>Paste a Fandom URL on the Crawl step and Silly Sleeve will pull lore, infobox, quotes and trivia — ready for the LLM to reformat into a character card.</p>
            <div className="row">
              <button className="btn primary" onClick={() => onNav('crawler')}><I.Globe size={14}/> Crawl a wiki page</button>
              <button className="btn ghost"><I.Upload size={14}/> Import existing card</button>
            </div>
          </div>
        ) : (
          <div className="grid-cards">
            {filtered.map(p => (
              <div key={p.id} className="proj-card" onClick={() => onNav('editor')}>
                <div className={`proj-thumb ${p.portrait ? '' : 'empty'}`}>
                  {p.portrait && <>
                    <span className="badge">portrait · 832×1216</span>
                    <span className="badge">{p.id}</span>
                  </>}
                </div>
                <div className="proj-meta">
                  <h3>
                    <span className="serif-i">{p.name}</span>
                    <span className="pid">{p.id}</span>
                  </h3>
                  <div className="src"><I.Link size={12}/> {p.sourceShort}</div>
                  <div className="tags">
                    {p.tags.slice(0,3).map(t => <span key={t} className="tag">{t}</span>)}
                    {p.tags.length > 3 && <span className="tag">+{p.tags.length-3}</span>}
                  </div>
                  <div className="ft">
                    <span>{p.tokens} tokens</span>
                    <span><b>·</b> {p.updated}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="proj-card" onClick={onNew} style={{
              borderStyle: 'dashed',
              borderColor: 'var(--hair-strong)',
              background: 'transparent',
              alignItems: 'center', justifyContent: 'center', minHeight: 320
            }}>
              <div className="col" style={{alignItems:'center', textAlign:'center', padding:24, gap:14}}>
                <div style={{width:48,height:48,border:'1px dashed var(--hair-strong)',borderRadius:'50%',display:'grid',placeItems:'center'}}>
                  <I.Plus size={22} />
                </div>
                <div className="serif-i" style={{fontSize:22}}>New character</div>
                <div className="helpr">From a wiki URL or scratch</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Settings ─────────────────────────────────────────────
const SETTINGS_SECTIONS = [
  { id: 'llm',     label: 'LLM endpoints',  status: 'ok'   },
  { id: 'comfy',   label: 'ComfyUI',        status: 'ok'   },
  { id: 'prompts', label: 'Prompts',        status: 'idle' },
  { id: 'crawler', label: 'Wiki crawler',   status: 'idle' },
  { id: 'shortcuts', label: 'Shortcuts',    status: 'idle' },
  { id: 'about',   label: 'About',          status: 'idle' },
];

function Settings({ tweak, setTweak }) {
  const [sect, setSect] = React.useState('llm');
  return (
    <>
      <PageHead title={<>Settings</>}
        actions={<button className="btn ghost" onClick={() => window.toast({
          kind: 'ok', title: 'Settings saved',
          body: 'Endpoints, prompts and defaults written to ~/Library/Application Support/Silly Sleeve.'
        })}><I.Save size={14}/> Save changes</button>} />
      <div className="ss-page-body scroll">
        <div className="settings-grid">
          <nav className="settings-nav">
            {SETTINGS_SECTIONS.map(s => (
              <button key={s.id} data-on={sect===s.id?'1':'0'} onClick={()=>setSect(s.id)}>
                <span>{s.label}</span>
                {s.status === 'ok' && <span className="dot ok"/>}
                {s.status === 'idle' && <span className="dot idle"/>}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {sect === 'llm' && <SettingsLLM/>}
            {sect === 'comfy' && <SettingsComfy/>}
            {sect === 'prompts' && <SettingsPrompts/>}
            {sect === 'crawler' && <SettingsCrawler/>}
            {sect === 'shortcuts' && <SettingsShortcuts/>}
            {sect === 'about' && <SettingsAbout/>}
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsLLM() {
  const [endpoints, setEndpoints] = React.useState([
    { id: 1, name: 'Local koboldcpp', url: 'http://127.0.0.1:5001/v1', model: 'Mistral-7B-Instruct-v0.3.Q5_K_M.gguf', ok: true, key: null, isDefault: true, contextSize: 8192, temperature: 0.85, systemPrompt: 'You are formatting wiki content into a SillyTavern character card. Stay in third person present tense. Output only the requested field.' },
    { id: 2, name: 'OpenRouter',      url: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-haiku', ok: true, key: 'sk-or-v1-7d8e3a4b9c2f1e6d5a8b9c0d', contextSize: 200000, temperature: 0.7, systemPrompt: 'You are an expert at formatting fictional character cards from wiki lore. Output only the requested field — no preamble.' },
    { id: 3, name: 'Mistral Cloud',   url: 'https://api.mistral.ai/v1', model: 'mistral-large-latest', ok: false, key: 'msk-9f8e7d6c5b4a3210fedcba', contextSize: 128000, temperature: 0.9, systemPrompt: 'Format the wiki content into a vivid character description.' },
  ]);
  const [editing, setEditing] = React.useState(null);
  const [testing, setTesting] = React.useState({});  // { [endpointId]: true }
  const [moreOpen, setMoreOpen] = React.useState(null);  // endpoint id with menu open
  const moreRef = React.useRef(null);

  React.useEffect(() => {
    if (moreOpen == null) return;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const pushToast = (toast) => window.toast && window.toast(toast);

  const testEndpoint = (e) => {
    if (testing[e.id]) return;
    setTesting({ ...testing, [e.id]: true });
    // Mock test: ~80% succeed
    const willSucceed = Math.random() > 0.2;
    const latency = 280 + Math.random() * 700;
    setTimeout(() => {
      setTesting(prev => { const n = { ...prev }; delete n[e.id]; return n; });
      // Reflect outcome on the card too
      setEndpoints(prev => prev.map(x => x.id === e.id ? { ...x, ok: willSucceed } : x));
      if (willSucceed) {
        pushToast({
          kind: 'ok',
          title: `${e.name} responded`,
          body: `${Math.round(latency)} ms · model "${e.model.split('/').pop()}" reachable.`,
        });
      } else {
        const errors = [
          { title: 'Connection refused', body: `No process listening at ${e.url}. Is the server running?` },
          { title: 'Auth failed · 401', body: 'API key was rejected. Check the token in Edit → Authentication.' },
          { title: 'Model not found · 404', body: `Endpoint up, but "${e.model}" isn't loaded.` },
          { title: 'Timed out', body: `No response after 10 s from ${new URL(e.url).host}.` },
        ];
        pushToast({ kind: 'bad', ...errors[Math.floor(Math.random() * errors.length)] });
      }
    }, latency);
  };

  const saveEndpoint = (updated) => {
    setEndpoints(endpoints.map(e => e.id === updated.id ? updated : e));
    setEditing(null);
    pushToast({ kind: 'ok', title: 'Endpoint saved', body: `${updated.name} updated.` });
  };

  const addNew = () => {
    setEditing({
      id: Math.max(...endpoints.map(e => e.id), 0) + 1,
      name: 'New endpoint',
      url: 'https://',
      model: '',
      ok: false, key: null,
      contextSize: 8192,
      temperature: 0.8,
      systemPrompt: 'You are formatting wiki content into a SillyTavern character card. Output only the requested field.',
      _isNew: true,
    });
  };

  const create = (updated) => {
    setEndpoints([...endpoints, { ...updated, _isNew: undefined }]);
    setEditing(null);
    pushToast({ kind: 'ok', title: 'Endpoint added', body: `${updated.name} is ready to test.` });
  };

  return (
    <div className="settings-section">
      <h3>LLM endpoints</h3>
      <p className="desc">Any OpenAI-compatible <code style={{fontFamily:'var(--f-mono)', background:'var(--panel)', padding:'2px 5px', borderRadius:3}}>/v1/chat/completions</code> endpoint works — local (koboldcpp, ollama, vLLM, llama-server) or hosted. The default endpoint is used for all rerolls unless you override it per-field.</p>
      <div className="settings-form">
        {endpoints.map(e => (
          <div key={e.id} className="endpoint-card">
            <div className="h">
              <span className="ic">{e.name[0]}</span>
              <div style={{display:'flex',flexDirection:'column',gap:1}}>
                <span>{e.name}</span>
                <span style={{font:'500 10px/1 var(--f-mono)', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:3}}>{e.model}</span>
              </div>
              <span className="grow"/>
              {e.isDefault && <span className="pill" style={{color:'var(--acc)',borderColor:'var(--acc-line)',background:'var(--acc-soft)'}}>default</span>}
              <span className={`pill ${e.ok?'ok':'idle'}`}>{e.ok ? '✓ connected' : '… untested'}</span>
              <div className="ep-more-wrap" ref={moreOpen === e.id ? moreRef : null}>
                <button className="btn icon ghost" style={{width:28,height:28}}
                        data-on={moreOpen === e.id ? '1' : '0'}
                        onClick={(ev) => { ev.stopPropagation(); setMoreOpen(moreOpen === e.id ? null : e.id); }}>
                  <I.More size={14}/>
                </button>
                {moreOpen === e.id && (
                  <div className="ep-more-menu" onClick={ev => ev.stopPropagation()}>
                    <button className="ep-more-item" disabled={e.isDefault} onClick={() => {
                      setEndpoints(endpoints.map(x => ({ ...x, isDefault: x.id === e.id })));
                      setMoreOpen(null);
                      pushToast({ kind: 'ok', title: 'Default endpoint changed',
                                  body: `${e.name} is now used for all field rerolls.` });
                    }}>
                      <I.Check size={13}/> Set as default
                      {e.isDefault && <span className="hint">current</span>}
                    </button>
                    <button className="ep-more-item" onClick={() => {
                      setMoreOpen(null);
                      const copy = { ...e, id: Math.max(...endpoints.map(x => x.id), 0) + 1,
                                     name: e.name + ' (copy)', isDefault: false, ok: false };
                      setEndpoints([...endpoints, copy]);
                      pushToast({ kind: 'ok', title: 'Endpoint duplicated',
                                  body: `${copy.name} created.` });
                    }}>
                      <I.Copy size={13}/> Duplicate
                    </button>
                    <button className="ep-more-item" onClick={() => {
                      setMoreOpen(null);
                      pushToast({ kind: 'ok', title: 'Config copied to clipboard',
                                  body: `Paste into a .json file or another machine.` });
                    }}>
                      <I.Download size={13}/> Export config
                    </button>
                    <div className="ep-more-sep"/>
                    <button className="ep-more-item danger" onClick={() => {
                      const wasDefault = e.isDefault;
                      const next = endpoints.filter(x => x.id !== e.id);
                      // Promote first remaining endpoint to default if needed
                      if (wasDefault && next.length) next[0] = { ...next[0], isDefault: true };
                      setEndpoints(next);
                      setMoreOpen(null);
                      pushToast({ kind: 'bad', title: 'Endpoint deleted',
                                  body: `${e.name} removed.${wasDefault && next.length ? ` ${next[0].name} is now default.` : ''}` });
                    }}>
                      <I.Trash size={13}/> Delete endpoint
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="url">{e.url}</div>
            <div className="row foot">
              <span>{e.key ? `auth · ${e.key.slice(0, 6)}${'•'.repeat(8)}` : 'no auth'}</span>
              <div className="row" style={{gap:6}}>
                <button className="btn ghost sm" disabled={testing[e.id]} onClick={() => testEndpoint(e)}>
                  {testing[e.id] ? <><span className="dot warn" style={{boxShadow:'none', width:6, height:6}}/> Testing…</> : 'Test'}
                </button>
                <button className="btn ghost sm" onClick={() => setEditing(e)}>Edit</button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn ghost" style={{alignSelf:'flex-start'}} onClick={addNew}>
          <I.Plus size={14}/> Add endpoint
        </button>
      </div>

      <h3 style={{marginTop:24}}>Generation defaults</h3>
      <div className="settings-form">
        <div className="form-row">
          <label>Temperature <small>0 deterministic — 2 wild</small></label>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <input type="range" min="0" max="2" step="0.05" defaultValue="0.85" style={{flex:1, accentColor:'var(--acc)'}}/>
            <input className="field" type="text" defaultValue="0.85" style={{width:70, textAlign:'right', fontFamily:'var(--f-mono)'}}/>
          </div>
        </div>
        <div className="form-row">
          <label>Max tokens <small>per field re-roll</small></label>
          <input className="field" type="number" defaultValue="320" style={{width:120, fontFamily:'var(--f-mono)'}}/>
        </div>
        <div className="form-row">
          <label>System prompt template <small>injected at the top of every formatting call</small></label>
          <textarea className="field" defaultValue={`You are formatting wiki content into a SillyTavern character card. Stay in third person present tense. Avoid plot spoilers post-act 1 unless tagged. Output only the requested field — no preamble.`} style={{minHeight: 110, fontFamily:'var(--f-mono)', fontSize:12}}/>
        </div>
      </div>

      {editing && (
        <EndpointEditor
          endpoint={editing}
          onSave={editing._isNew ? create : saveEndpoint}
          onClose={() => setEditing(null)}
          onDelete={editing._isNew ? null : () => {
            setEndpoints(endpoints.filter(e => e.id !== editing.id));
            setEditing(null);
            pushToast({ kind: 'ok', title: 'Endpoint removed', body: `${editing.name} deleted.` });
          }}/>
      )}
    </div>
  );
}

// ToastStack now lives in components.jsx (ToastProvider, mounted at App level)

// ─── Endpoint editor flyout ───────────────────────────────
function EndpointEditor({ endpoint, onSave, onClose, onDelete }) {
  const [draft, setDraft] = React.useState(endpoint);
  const [showKey, setShowKey] = React.useState(false);
  const [testing, setTesting] = React.useState('idle'); // idle | testing | ok | fail
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const authOn = draft.key !== null && draft.key !== undefined;

  const toggleAuth = (on) => {
    if (on) set('key', '');
    else set('key', null);
  };

  const runTest = () => {
    setTesting('testing');
    setTimeout(() => {
      const ok = Math.random() > 0.2;
      setTesting(ok ? 'ok' : 'fail');
      window.toast && window.toast(ok
        ? { kind: 'ok',  title: `${draft.name} responded`,
            body: `${Math.round(280 + Math.random()*700)} ms · ${draft.model || 'no model set'} reachable.` }
        : { kind: 'bad', title: `Couldn't reach ${draft.name}`,
            body: `Check the URL and (if hosted) your API key.` });
    }, 1100);
  };

  return (
    <>
      <div className="ep-flyout-bg" onClick={onClose}/>
      <aside className="ep-flyout" onClick={e => e.stopPropagation()}>
        <header className="ep-fly-head">
          <div>
            <div className="uplabel">{endpoint._isNew ? 'New endpoint' : 'Edit endpoint'}</div>
            <input className="ep-fly-title" value={draft.name}
                   onChange={e => set('name', e.target.value)}
                   placeholder="Endpoint name…"/>
          </div>
          <button className="btn icon ghost" onClick={onClose} title="Close"><I.X size={14}/></button>
        </header>

        <div className="ep-fly-body scroll">

          {/* URL */}
          <div className="ep-row">
            <label>Base URL
              <small>OpenAI-compatible endpoint — should end in <code>/v1</code>.</small>
            </label>
            <div className="ep-url">
              <span className="ic"><I.Link size={12}/></span>
              <input value={draft.url} onChange={e => set('url', e.target.value)}
                     placeholder="https://api.example.com/v1"
                     spellCheck={false}/>
              <button className="ep-test-btn" data-state={testing} onClick={runTest} disabled={testing === 'testing'}>
                {testing === 'idle'    && <>Test</>}
                {testing === 'testing' && <>Testing…</>}
                {testing === 'ok'      && <><I.Check size={12}/> OK</>}
                {testing === 'fail'    && <><I.X size={12}/> Failed</>}
              </button>
            </div>
          </div>

          {/* Auth + API key */}
          <div className="ep-row">
            <label>Authentication
              <small>Toggle on for hosted endpoints that require an API key.</small>
            </label>
            <div className="ep-auth-block">
              <div className="ep-toggle-row">
                <div>
                  <b>Use API key</b>
                  <small>Sent as <code>Authorization: Bearer …</code></small>
                </div>
                <button className="ep-switch" data-on={authOn ? '1' : '0'}
                        onClick={() => toggleAuth(!authOn)}
                        role="switch" aria-checked={authOn}><i/></button>
              </div>
              {authOn && (
                <div className="ep-key-input">
                  <I.Key size={13} style={{color:'var(--ink-3)', flexShrink:0}}/>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft.key || ''}
                    onChange={e => set('key', e.target.value)}
                    placeholder="sk-… or msk-… or your provider's token"
                    spellCheck={false}/>
                  <button className="ep-eye" onClick={() => setShowKey(!showKey)}
                          title={showKey ? 'Hide key' : 'Reveal key'}>
                    {showKey ? <I.X size={12}/> : <I.Eye size={12}/>}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Model */}
          <div className="ep-row">
            <label>Model
              <small>Identifier passed in the <code>model</code> param.</small>
            </label>
            <input className="ep-input" value={draft.model}
                   onChange={e => set('model', e.target.value)}
                   placeholder="e.g. mistral-large-latest"
                   style={{fontFamily:'var(--f-mono)'}}/>
          </div>

          <div className="ep-divline"/>

          {/* Context size */}
          <div className="ep-row">
            <label>Context size
              <small>Max tokens the model can hold in one call.</small>
            </label>
            <div className="ep-slider-row">
              <input type="range" min="2048" max="262144" step="1024"
                     value={Math.min(262144, draft.contextSize)}
                     onChange={e => set('contextSize', +e.target.value)}
                     style={{accentColor:'var(--acc)'}}/>
              <input className="ep-num" type="number" min="512" max="2000000" step="1024"
                     value={draft.contextSize}
                     onChange={e => set('contextSize', +e.target.value)}/>
              <span className="ep-unit">tok</span>
            </div>
            <div className="ep-presets">
              {[4096, 8192, 16384, 32768, 128000, 200000].map(n => (
                <button key={n} className="ep-preset"
                        data-on={draft.contextSize === n ? '1' : '0'}
                        onClick={() => set('contextSize', n)}>
                  {n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="ep-row">
            <label>Temperature
              <small>0 deterministic · 2 wild · 0.7–0.9 is the sweet spot for character writing.</small>
            </label>
            <div className="ep-slider-row">
              <input type="range" min="0" max="2" step="0.05"
                     value={draft.temperature}
                     onChange={e => set('temperature', +e.target.value)}
                     style={{accentColor:'var(--acc)'}}/>
              <input className="ep-num" type="number" min="0" max="2" step="0.05"
                     value={draft.temperature}
                     onChange={e => set('temperature', +e.target.value)}/>
            </div>
          </div>

          {/* System prompt */}
          <div className="ep-row">
            <label>System prompt
              <small>Prepended to every call against this endpoint.</small>
            </label>
            <textarea className="ep-textarea"
                      value={draft.systemPrompt}
                      onChange={e => set('systemPrompt', e.target.value)}
                      placeholder="You are an expert at…"/>
            <div className="row" style={{justifyContent:'space-between', marginTop:4}}>
              <span className="helpr">{draft.systemPrompt.length} chars · ~{Math.round(draft.systemPrompt.length / 4)} tokens</span>
              <button className="btn ghost sm" onClick={() => set('systemPrompt', '')}>Clear</button>
            </div>
          </div>

        </div>

        <footer className="ep-fly-foot">
          {onDelete && (
            <button className="btn ghost" onClick={onDelete} style={{color:'var(--bad)'}}>
              <I.Trash size={13}/> Delete
            </button>
          )}
          <span style={{flex:1}}/>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(draft)}>
            <I.Check size={13}/> {endpoint._isNew ? 'Create' : 'Save'}
          </button>
        </footer>
      </aside>

      <style>{ENDPOINT_FLYOUT_STYLES}</style>
    </>
  );
}

const ENDPOINT_FLYOUT_STYLES = `
.ep-flyout-bg {
  position: fixed; inset: 0;
  background: oklch(0.18 0.01 60 / 0.4);
  backdrop-filter: blur(4px);
  z-index: 90;
  animation: ep-fade .15s ease-out;
}
@keyframes ep-fade { from { opacity: 0; } to { opacity: 1; } }
.ep-flyout {
  position: fixed;
  top: 32px; right: 0; bottom: 24px;
  width: 480px; max-width: 100vw;
  background: var(--panel);
  border-left: 1px solid var(--hair-strong);
  display: flex; flex-direction: column;
  z-index: 95;
  box-shadow: -16px 0 40px -10px #0006;
  animation: ep-slide .22s cubic-bezier(.2,.7,.3,1);
}
@keyframes ep-slide {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
.ep-fly-head {
  display: flex; align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--hair);
  gap: 12px;
}
.ep-fly-head .uplabel { margin-bottom: 4px; }
.ep-fly-title {
  appearance: none;
  border: 0; outline: none; background: transparent;
  font: 400 26px/1 var(--f-display); font-style: italic;
  color: var(--ink);
  width: 100%;
  padding: 2px 0;
}
.ep-fly-title::placeholder { color: var(--ink-3); }
.ep-fly-body {
  flex: 1; min-height: 0;
  overflow-y: auto;
  padding: 18px 20px 22px;
  display: flex; flex-direction: column; gap: 20px;
}
.ep-fly-foot {
  padding: 14px 20px;
  border-top: 1px solid var(--hair);
  display: flex; gap: 8px; align-items: center;
}

.ep-row { display: flex; flex-direction: column; gap: 8px; }
.ep-row > label {
  display: flex; flex-direction: column; gap: 3px;
  font: 600 12px/1.3 var(--f-sans);
  color: var(--ink);
}
.ep-row > label small {
  font: 400 11.5px/1.4 var(--f-sans);
  color: var(--ink-3);
}
.ep-row > label small code {
  font: 500 10.5px/1 var(--f-mono);
  background: var(--panel-2);
  padding: 2px 5px;
  border-radius: 2px;
  color: var(--ink-2);
}

.ep-input {
  appearance: none;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 10px 12px;
  font: 13px/1.4 var(--f-sans);
  color: var(--ink);
  outline: none;
}
.ep-input:focus { border-color: var(--acc-line); }
.ep-textarea {
  appearance: none;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 11px 13px;
  font: 12.5px/1.6 var(--f-mono);
  color: var(--ink);
  outline: none; resize: vertical;
  min-height: 120px;
}
.ep-textarea:focus { border-color: var(--acc-line); }

.ep-url {
  display: flex; align-items: center;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  overflow: hidden;
}
.ep-url:focus-within { border-color: var(--acc-line); }
.ep-url .ic {
  padding: 0 10px;
  color: var(--ink-3);
  border-right: 1px solid var(--hair);
  align-self: stretch;
  display: grid; place-items: center;
  background: var(--panel-2);
}
.ep-url input {
  flex: 1; min-width: 0;
  appearance: none; border: 0; outline: none; background: transparent;
  padding: 11px 12px;
  font: 500 12.5px/1 var(--f-mono);
  color: var(--ink);
}
.ep-test-btn {
  appearance: none; border: 0;
  margin: 5px 5px 5px 0;
  padding: 0 14px;
  border-radius: 3px;
  background: var(--ink); color: var(--bg);
  font: 500 11px/1 var(--f-sans);
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
  height: 30px;
}
.ep-test-btn:hover { opacity: 0.88; }
.ep-test-btn[data-state="ok"]   { background: var(--ok); color: #fff; }
.ep-test-btn[data-state="fail"] { background: var(--bad); color: #fff; }
.ep-test-btn[data-state="testing"] { opacity: 0.6; cursor: progress; }

.ep-auth-block {
  display: flex; flex-direction: column; gap: 8px;
}
.ep-toggle-row {
  display: grid; grid-template-columns: 1fr auto; gap: 10px;
  align-items: center;
  padding: 11px 14px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
}
.ep-toggle-row > div { display: flex; flex-direction: column; gap: 2px; }
.ep-toggle-row > div > b { font: 600 12.5px/1.2 var(--f-sans); }
.ep-toggle-row > div > small { font: 400 11.5px/1.4 var(--f-sans); color: var(--ink-3); }
.ep-toggle-row > div > small code {
  font: 500 10.5px/1 var(--f-mono);
  background: var(--panel-2);
  padding: 2px 4px;
  border-radius: 2px;
  color: var(--ink-2);
}

.ep-key-input {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  animation: ep-grow .18s ease-out;
}
@keyframes ep-grow {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ep-key-input:focus-within { border-color: var(--acc-line); }
.ep-key-input input {
  flex: 1; min-width: 0;
  appearance: none; border: 0; outline: none; background: transparent;
  font: 500 12.5px/1 var(--f-mono);
  color: var(--ink);
  padding: 2px 0;
  letter-spacing: 0.04em;
}
.ep-eye {
  appearance: none; border: 0; background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  display: grid; place-items: center;
}
.ep-eye:hover { color: var(--ink); background: var(--hair); }

.ep-slider-row {
  display: flex; align-items: center; gap: 10px;
}
.ep-slider-row > input[type="range"] { flex: 1; }
.ep-num {
  appearance: none;
  width: 90px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 7px 10px;
  font: 600 12px/1 var(--f-mono);
  color: var(--ink);
  outline: none;
  text-align: right;
  -moz-appearance: textfield;
}
.ep-num::-webkit-inner-spin-button,
.ep-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ep-num:focus { border-color: var(--acc-line); }
.ep-unit {
  font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--ink-3);
}
.ep-presets {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.ep-preset {
  appearance: none;
  padding: 5px 9px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 3px;
  font: 500 10.5px/1 var(--f-mono);
  color: var(--ink-2);
  cursor: pointer;
}
.ep-preset:hover { border-color: var(--hair-strong); color: var(--ink); }
.ep-preset[data-on="1"] {
  background: var(--acc-soft);
  border-color: var(--acc);
  color: var(--acc);
}

.ep-divline {
  height: 1px; background: var(--hair); margin: 2px 0;
}

.ep-switch {
  position: relative;
  width: 36px; height: 20px;
  border: 0; padding: 0;
  border-radius: 999px;
  background: var(--hair-strong);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
.ep-switch[data-on="1"] { background: var(--acc); }
.ep-switch i {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff;
  transition: transform .15s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.ep-switch[data-on="1"] i { transform: translateX(16px); }
`;

function SettingsComfy() {
  return (
    <div className="settings-section">
      <h3>ComfyUI backend</h3>
      <p className="desc">Point Silly Sleeve at a running ComfyUI server. Workflows you save here are exposed in the Portrait step as one-click presets.</p>
      <div className="settings-form">
        <div className="form-row">
          <label>Server URL <small>WebSocket address</small></label>
          <div style={{display:'flex',gap:8}}>
            <input className="field" defaultValue="ws://127.0.0.1:8188" style={{fontFamily:'var(--f-mono)'}}/>
            <button className="btn primary" onClick={() => {
              window.toast && window.toast({
                kind: 'ok', title: 'ComfyUI connected',
                body: 'Workflow queue is empty. 12 nodes available.',
              });
            }}><I.Check size={14}/> Test</button>
          </div>
        </div>
        <div className="form-row">
          <label>Auth token <small>optional · sent as <code>Authorization: Bearer</code></small></label>
          <input className="field" type="password" placeholder="—"/>
        </div>
        <div className="form-row">
          <label>Output folder <small>where ComfyUI writes images</small></label>
          <input className="field" defaultValue="/home/me/ComfyUI/output" style={{fontFamily:'var(--f-mono)'}}/>
        </div>
        <div className="form-row">
          <label>Default workflow</label>
          <select className="field">
            <option>portrait_sdxl_v3.json — 832×1216 · 28 steps</option>
            <option>illustrious_anime.json — 896×1152</option>
            <option>flux_dev_portrait.json — 1024×1024</option>
          </select>
        </div>
      </div>

      <h3 style={{marginTop:24}}>Saved workflows</h3>
      <div className="settings-form">
        {[
          {name:'portrait_sdxl_v3.json', model:'sd_xl_base_1.0', size:'832×1216', def:true},
          {name:'illustrious_anime.json', model:'noobaiXL_v07', size:'896×1152'},
          {name:'flux_dev_portrait.json', model:'flux1-dev-fp8', size:'1024×1024'},
        ].map(w => (
          <div key={w.name} className="endpoint-card">
            <div className="h">
              <span className="ic" style={{background:'var(--acc)',color:'var(--acc-fg)'}}><I.Node size={13}/></span>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <span>{w.name}</span>
                <span style={{font:'500 10px/1 var(--f-mono)', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.1em'}}>{w.model} · {w.size}</span>
              </div>
              <span className="grow"/>
              {w.def && <span className="pill" style={{color:'var(--acc)',borderColor:'var(--acc-line)',background:'var(--acc-soft)'}}>default</span>}
              <button className="btn ghost sm">Edit nodes</button>
            </div>
          </div>
        ))}
        <button className="btn ghost" style={{alignSelf:'flex-start'}}><I.Upload size={14}/> Import .json workflow</button>
      </div>
    </div>
  );
}

function SettingsPrompts() {
  const FIELD_PROMPTS = [
    { id: 'name',         label: 'Name',         token: '{{name}}',        def: `Read the wiki content and output just the character's canonical name as it appears in headings. No commentary.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'epithet',      label: 'Title / epithet', token: '{{epithet}}', def: `Find or invent a single short epithet for the character — the kind a tavern-singer would tag them with. 2-6 words, no quotes.\n\nNAME: {{name}}\nWIKI:\n{{wikiContent}}` },
    { id: 'tags',         label: 'Tags',         token: '{{tags}}',        def: `Output 4-8 single-word or hyphenated tags describing the character (race, class, faction, region, vibe). Comma-separated, lowercase.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'appearance',   label: 'Appearance',   token: '{{appearance}}',  def: `Write a sensory description of {{name}} — build, clothes, distinguishing marks, posture. Third person present tense, 60-110 words, no plot spoilers.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'personality',  label: 'Personality',  token: '{{personality}}', def: `Describe {{name}}'s personality in 60-110 words. Mix traits with how they manifest in behaviour. Avoid summarizing their backstory here.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'backstory',    label: 'Backstory',    token: '{{backstory}}',   def: `Compress {{name}}'s history into 80-140 words. Past tense. Touch on origin, defining wound, current motivation. Skip later-act spoilers unless explicitly tagged.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'abilities',    label: 'Abilities & skills', token: '{{abilities}}', def: `List {{name}}'s powers and skills in 60-110 words. Mix magical and mundane. Note known item-based abilities last.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'relationships',label: 'Relationships',token: '{{relationships}}', def: `Describe up to 3 important relationships for {{name}}. Format: bullet · name (relation) — one-line dynamic. Skip people not in the source.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'quotes',       label: 'Example quotes', token: '{{quotes}}',    def: `Write 3 short in-character lines for {{name}}. Each under 25 words. They should reveal voice, not deliver exposition. One per line, no numbering.\n\nWIKI:\n{{wikiContent}}` },
    { id: 'stats',        label: 'Stat block',   token: '{{stats}}',       def: `Output a JSON object of key/value stat pairs appropriate to the source system. Numeric values where possible. 6-12 entries.\n\nWIKI:\n{{wikiContent}}` },
  ];

  const LORE_PROMPT = {
    label: 'Lorebook entry',
    token: '{{loreContent}}',
    def: `You are formatting a single lorebook entry for SillyTavern. Output only the body content — no title, no preamble. Structure:\n\n[Category] one-sentence definition. [key_data(k:v; k:v)]. 1-2 sentences of sensory or behavioural detail. Optionally one sentence of cross-link bait.\n\nKEEP UNDER 90 WORDS.\nCATEGORY: {{category}}\nNAME: {{entryName}}\nSOURCE:\n{{loreContent}}`,
  };

  const BULK_PROMPTS = [
    {
      id: 'fullCharacter',
      label: 'Full character (bulk)',
      token: '{{characterCard}}',
      def: `You are bootstrapping a complete SillyTavern character card from a crawled wiki page. Read the source and output a SINGLE JSON object with ALL of the following keys filled in. Use the per-field constraints noted in parentheses.\n\n{\n  "name":          string  // canonical name only\n  "epithet":       string  // 2-6 word tag, no quotes\n  "tags":          string[] // 4-8 lowercase, hyphenated tokens\n  "appearance":    string  // 60-110 words, third-person present\n  "personality":   string  // 60-110 words, traits + behaviour\n  "backstory":     string  // 80-140 words, past tense, no late-act spoilers\n  "abilities":     string  // 60-110 words, mix magical + mundane\n  "relationships": string  // up to 3 bullets, "• name (relation) — dynamic"\n  "quotes":        string[] // 3 in-character lines, each <25 words\n  "stats":         object  // 6-12 key:value pairs (numbers where possible)\n}\n\nOutput ONLY the JSON — no preamble, no markdown fence.\n\nWIKI:\n{{wikiContent}}`,
    },
    {
      id: 'fullLorebook',
      label: 'Full lorebook (bulk)',
      token: '{{lorebook}}',
      def: `You are bootstrapping a complete SillyTavern lorebook from a crawled wiki page (or the cross-linked wiki for the character {{name}}). Propose 6-14 entries covering factions, key locations, important items, related characters, and world rules.\n\nFor each entry, output an object with this shape:\n\n{\n  "comment":  string   // human-readable name, e.g. "The Harpers — Faction"\n  "key":      string[] // 2-5 trigger words; first one is the canonical name\n  "category": string   // Faction | Location | Item | Character | World | Event\n  "content":  string   // ≤90 words. Start with "[Category] one-sentence def." then [key_data(k:v; k:v)] then 1-2 sensory/behavioural sentences.\n  "position": 0..6     // 0 before chardef, 1 after, 2 before examples, 3 after, 4 @depth, 5 before AN, 6 after AN\n  "order":    integer  // higher = inserted first; 200 for world rules, 100 for primary factions, 60-80 for locations, 40 for items\n  "constant": boolean  // true ONLY for world baselines that must always be in context\n}\n\nReturn a JSON array of these objects. No preamble, no markdown fence.\n\nWIKI:\n{{wikiContent}}`,
    },
  ];

  const [selected, setSelected] = React.useState('name');
  const [prompts, setPrompts] = React.useState(() => {
    const o = { lorebook: LORE_PROMPT.def };
    FIELD_PROMPTS.forEach(p => { o[p.id] = p.def; });
    BULK_PROMPTS.forEach(p => { o[p.id] = p.def; });
    return o;
  });

  const activeMeta = selected === 'lorebook'
    ? { ...LORE_PROMPT, id: 'lorebook' }
    : (BULK_PROMPTS.find(p => p.id === selected)
       || FIELD_PROMPTS.find(p => p.id === selected));

  const isModified = prompts[selected] !== activeMeta.def;
  const reset = () => setPrompts({ ...prompts, [selected]: activeMeta.def });
  const update = (v) => setPrompts({ ...prompts, [selected]: v });

  const tokens = ['{{wikiContent}}','{{name}}','{{epithet}}','{{tags}}',
                  '{{appearance}}','{{personality}}','{{backstory}}',
                  '{{characterCard}}','{{entryName}}','{{category}}','{{loreContent}}'];

  return (
    <div className="settings-section">
      <h3>Prompts</h3>
      <p className="desc">The templates Silly Sleeve sends to the LLM for each character field and for lorebook entries. Use <code style={{fontFamily:'var(--f-mono)', background:'var(--panel)', padding:'2px 5px', borderRadius:3}}>&#123;&#123;variables&#125;&#125;</code> — they're filled in at call-time from the crawled source and the in-progress card.</p>

      <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:18, alignItems:'start'}}>
        <div className="prompt-list">
          <div className="uplabel" style={{padding:'4px 8px 8px'}}>Bulk generation</div>
          {BULK_PROMPTS.map(p => {
            const modified = prompts[p.id] !== p.def;
            return (
              <button key={p.id} className="prompt-item" data-on={selected === p.id ? '1' : '0'}
                      onClick={() => setSelected(p.id)}>
                <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <I.Sparks size={12} style={{flexShrink:0, opacity: selected === p.id ? 1 : 0.6}}/>
                  {p.label}
                </span>
                {modified && <span className="dot acc-dot" title="modified from default"/>}
              </button>
            );
          })}
          <div className="uplabel" style={{padding:'12px 8px 8px'}}>Character fields</div>
          {FIELD_PROMPTS.map(p => {
            const modified = prompts[p.id] !== p.def;
            return (
              <button key={p.id} className="prompt-item" data-on={selected === p.id ? '1' : '0'}
                      onClick={() => setSelected(p.id)}>
                <span>{p.label}</span>
                {modified && <span className="dot acc-dot" title="modified from default"/>}
              </button>
            );
          })}
          <div className="uplabel" style={{padding:'12px 8px 8px'}}>Lorebook</div>
          <button className="prompt-item" data-on={selected === 'lorebook' ? '1' : '0'}
                  onClick={() => setSelected('lorebook')}>
            <span>Lorebook entry</span>
            {prompts.lorebook !== LORE_PROMPT.def && <span className="dot acc-dot"/>}
          </button>
        </div>

        <div className="prompt-edit">
          <div className="prompt-edit-h">
            <div>
              <h4>{activeMeta.label}</h4>
              <span className="helpr">Returned content fills <code style={{fontFamily:'var(--f-mono)',background:'var(--panel-2)',padding:'1px 5px',borderRadius:2}}>{activeMeta.token}</code></span>
            </div>
            <div className="row" style={{gap:8}}>
              {isModified && <span className="uplabel" style={{color:'var(--acc)'}}>modified</span>}
              <button className="btn ghost sm" disabled={!isModified} onClick={reset}>
                <I.Reroll size={11}/> Reset to default
              </button>
            </div>
          </div>

          <textarea className="prompt-area"
                    value={prompts[selected]}
                    onChange={e => update(e.target.value)}/>

          <div className="prompt-foot">
            <div className="row" style={{gap:4, flexWrap:'wrap'}}>
              <span className="uplabel">Variables</span>
              {tokens.map(tok => (
                <span key={tok} className="prompt-tok"
                      onClick={() => update(prompts[selected] + tok)}>
                  {tok}
                </span>
              ))}
            </div>
            <span className="helpr">Click a chip to insert.</span>
          </div>
        </div>
      </div>

      <style>{`
        .prompt-list {
          display: flex; flex-direction: column; gap: 2px;
          background: var(--panel); border: 1px solid var(--hair); border-radius: 6px;
          padding: 6px;
        }
        .prompt-item {
          appearance: none; border: 0;
          background: transparent;
          padding: 8px 10px;
          border-radius: 4px;
          color: var(--ink-2);
          font: 500 12.5px/1 var(--f-sans);
          cursor: pointer;
          text-align: left;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .prompt-item:hover { background: var(--hair); color: var(--ink); }
        .prompt-item[data-on="1"] { background: var(--ink); color: var(--bg); }
        .prompt-item .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--acc);
        }
        .prompt-item[data-on="1"] .dot { background: var(--bg); }

        .prompt-edit {
          background: var(--panel); border: 1px solid var(--hair);
          border-radius: 6px;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .prompt-edit-h {
          padding: 14px 18px;
          border-bottom: 1px solid var(--hair);
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 12px;
        }
        .prompt-edit-h h4 {
          font: 400 22px/1 var(--f-display); font-style: italic;
          margin: 0 0 4px;
        }
        .prompt-area {
          appearance: none;
          border: 0; outline: none; resize: vertical;
          background: var(--bg);
          padding: 18px 20px;
          font: 12.5px/1.65 var(--f-mono);
          color: var(--ink);
          min-height: 280px;
          border-bottom: 1px solid var(--hair);
        }
        .prompt-foot {
          padding: 10px 14px 12px;
          background: var(--panel-2);
          display: flex; flex-direction: column; gap: 4px;
        }
        .prompt-tok {
          font: 500 10.5px/1 var(--f-mono);
          padding: 4px 7px;
          background: var(--bg);
          border: 1px solid var(--hair);
          border-radius: 3px;
          color: var(--acc);
          cursor: pointer;
        }
        .prompt-tok:hover { border-color: var(--acc); }
      `}</style>
    </div>
  );
}

function StripItem({ label, hint, on: initialOn }) {
  const [on, setOn] = React.useState(initialOn);
  return (
    <button type="button" className="strip-item" data-on={on ? '1' : '0'}
            onClick={() => setOn(!on)}>
      <div className={'check' + (on ? ' on' : '')}>
        {on && <I.Check size={11}/>}
      </div>
      <div className="info">
        <b>{label}</b>
        <span>{hint}</span>
      </div>
      <span className="state">{on ? 'stripped' : 'kept'}</span>
    </button>
  );
}

function SettingsCrawler() {
  return (
    <div className="settings-section">
      <h3>Wiki crawler</h3>
      <p className="desc">Defaults applied when you crawl a new page. You can override any of these inline on the Crawl step.</p>
      <div className="settings-form">
        <div className="form-row">
          <label>Follow links</label>
          <select className="field" defaultValue="1">
            <option value="0">Only the URL given</option>
            <option value="1">Follow 1 hop · same domain</option>
            <option value="2">Follow 2 hops · same domain</option>
          </select>
        </div>
        <div className="form-row">
          <label>Strip <small>noise removed before sending to LLM</small></label>
          <div className="strip-list">
            {[
              { k: 'nav',    label: 'Navigation & breadcrumbs', hint: 'Top sidebar, breadcrumb trails, "see also" rails', on: true },
              { k: 'refs',   label: 'Reference markers',        hint: 'Inline citation numbers like [1], [12]',         on: true },
              { k: 'empty',  label: 'Empty headings',           hint: 'Sections with no body text',                      on: true },
              { k: 'gal',    label: 'Image galleries',          hint: 'Inline image grids (portraits, screenshots)',     on: true },
              { k: 'toc',    label: 'Tables of contents',       hint: 'In-article TOCs at the top of the page',          on: true },
              { k: 'notice', label: 'Cleanup / spoiler notices',hint: 'Editor banners and spoiler warnings',             on: false },
            ].map(it => (
              <StripItem key={it.k} {...it}/>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label>User agent <small>polite identification for fandom</small></label>
          <input className="field" defaultValue="SillySleeve/0.4 (+https://sillysleeve.app)" style={{fontFamily:'var(--f-mono)', fontSize:11}}/>
        </div>
        <div className="form-row">
          <label>Rate limit <small>requests per second</small></label>
          <input className="field" type="number" defaultValue="1" min="0" max="10" step="0.5" style={{width:120}}/>
        </div>
      </div>
    </div>
  );
}

function SettingsShortcuts() {
  const rows = [
    ['Command palette', '⇧ ⌘ P'],
    ['Save project', '⌘ S'],
    ['Re-roll focused field', '⌘ R'],
    ['Re-roll all unlocked', '⇧ ⌘ R'],
    ['Lock / unlock field', '⌘ L'],
    ['Send to portrait step', '⌘ ⏎'],
    ['Toggle theme', '⌃ ⇧ T'],
    ['New project', '⌘ N'],
  ];
  return (
    <div className="settings-section">
      <h3>Shortcuts</h3>
      <div className="settings-form">
        {rows.map(([l,k]) => (
          <div key={l} className="row" style={{justifyContent:'space-between'}}>
            <span style={{fontSize:13}}>{l}</span>
            <span className="row" style={{gap:4}}>
              {k.split(' ').map((p,i) => <kbd key={i}>{p}</kbd>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsAbout() {
  return (
    <div className="settings-section">
      <h3>About</h3>
      <div className="settings-form" style={{lineHeight:1.6, color:'var(--ink-2)', fontSize:12.5}}>
        <p style={{margin:0}}><span className="serif-i" style={{fontSize:24, color:'var(--ink)'}}>Silly Sleeve</span> — a desktop workshop for crafting SillyTavern character cards and lorebooks from wiki sources.</p>
        <p style={{margin:0}}><b>v0.4.2-alpha</b> · electron 28 · darwin-arm64</p>
        <div className="divline"/>
        <p style={{margin:0}} className="helpr">Silly Sleeve is an independent tool. SillyTavern, ComfyUI and the various wiki services it talks to are separate projects with their own licenses and communities.</p>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, Settings });
