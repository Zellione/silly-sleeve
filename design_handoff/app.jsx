// ─── Silly Sleeve · App shell ───────────────────────────────

const PROJECT_CHARACTERS = [
  { id: 'C1', name: 'Elara Wynd',       initial: 'E', epithet: 'Crimson Lark',  tokens: 1247, ready: true },
  { id: 'C2', name: 'Olly Aldelwynd',   initial: 'O', epithet: 'Tavernkeeper',  tokens: 840,  ready: true },
  { id: 'C3', name: 'Halbreck Crae',    initial: 'H', epithet: 'Master Harper', tokens: 610,  ready: false },
];

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState('dashboard');
  const [modal, setModal] = React.useState(null);
  const [characters, setCharacters] = React.useState(PROJECT_CHARACTERS);
  const [activeCharId, setActiveCharId] = React.useState('C1');
  const [unsaved, setUnsaved] = React.useState(true);

  injectStyles();
  injectScreenStyles();

  React.useEffect(() => {
    document.documentElement.dataset.theme = t.dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--acc', t.accent);
    const acc = t.accent;
    document.documentElement.style.setProperty('--acc-soft', acc + (t.dark ? '2d' : '20'));
    document.documentElement.style.setProperty('--acc-line', acc + '66');
  }, [t.dark, t.accent]);

  const activeChar = characters.find(c => c.id === activeCharId) || characters[0];
  const project = {
    name: 'Baldur\'s Gate · Harper cell',
    updated: 'just now',
    unsaved: unsaved && route !== 'dashboard',
    tokens: characters.reduce((s, c) => s + c.tokens, 0),
    onSave: () => setUnsaved(false),
  };

  const addCharacter = () => {
    const n = characters.length + 1;
    const letters = ['A','B','C','D','E','F','G','H','I','J'];
    const newChar = {
      id: 'C' + (n + 10),
      name: 'Untitled #' + n,
      initial: letters[characters.length % letters.length],
      epithet: 'new character',
      tokens: 0, ready: false,
    };
    setCharacters([...characters, newChar]);
    setActiveCharId(newChar.id);
    setUnsaved(true);
  };

  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const requestDeleteChar = (charId) => {
    const target = characters.find(c => c.id === charId);
    if (!target) return;
    setConfirmDelete(target);
  };

  const deleteCharacter = (charId) => {
    const target = characters.find(c => c.id === charId);
    const remaining = characters.filter(c => c.id !== charId);
    setCharacters(remaining);
    if (activeCharId === charId && remaining.length > 0) {
      setActiveCharId(remaining[0].id);
    }
    setUnsaved(true);
    setConfirmDelete(null);
    window.toast && window.toast({
      kind: 'bad',
      title: `${target.name} deleted`,
      body: `Character removed from the project. ${remaining.length} character${remaining.length === 1 ? '' : 's'} remaining.`,
    });
  };

  const llm = { status: 'ok', name: 'koboldcpp · mistral-7b' };
  const comfy = { status: 'ok', name: 'sdxl · 127.0.0.1:8188' };

  const routeLabels = {
    dashboard: 'PROJECTS', crawler: 'CRAWL · STEP 01',
    editor: 'COMPOSE · STEP 02', lorebook: 'LOREBOOK · STEP 03',
    projectImage: 'PROJECT IMAGE · STEP 04',
    image: 'PORTRAIT · STEP 05', preview: 'PREVIEW · STEP 06',
    export: 'EXPORT · STEP 07', settings: 'SETTINGS',
  };

  const charContext = {
    characters, activeCharId, activeChar,
    onSelectChar: setActiveCharId, onAddChar: addCharacter,
    onDeleteChar: requestDeleteChar,
  };

  return (
    <div className="ss-app" data-sidebar={t.sidebar}>
      <TitleBar project={project} />

      <div className="ss-main">
        <Sidebar current={route} onNav={setRoute} project={project}
                 showStepBadges={t.showStepBadges}/>
        <main className="ss-content">
          {route === 'dashboard' && <Dashboard onNav={setRoute} onNew={() => setRoute('crawler')}/>}
          {route === 'crawler'   && <Crawler onContinue={() => setRoute('editor')}/>}
          {route === 'editor'    && <Editor onContinue={() => setRoute('lorebook')} {...charContext}/>}
          {route === 'lorebook'  && <Lorebook onContinue={() => setRoute('projectImage')} characters={characters}/>}
          {route === 'projectImage' && <ProjectImage onContinue={() => setRoute('image')} project={project}/>}
          {route === 'image'     && <ImageGen onContinue={() => setRoute('preview')} {...charContext}/>}
          {route === 'preview'   && <Preview onContinue={() => setRoute('export')} {...charContext}/>}
          {route === 'export'    && <ExportHub onFinish={() => setModal('saved')} characters={characters}/>}
          {route === 'settings'  && <Settings tweak={t} setTweak={setTweak}/>}
        </main>
      </div>

      <StatusBar project={project} llm={llm} comfy={comfy} route={routeLabels[route]}/>

      <ToastProvider/>

      {confirmDelete && (
        <Modal title={<>Delete <em style={{fontStyle:'italic', fontFamily:'var(--f-display)', color:'var(--bad)'}}>{confirmDelete.name}</em>?</>}
               onClose={() => setConfirmDelete(null)}
               footer={
                 <>
                   <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                   <button className="btn primary" style={{background:'var(--bad)', color:'#fff'}}
                           onClick={() => deleteCharacter(confirmDelete.id)}>
                     <I.Trash size={13}/> Delete character
                   </button>
                 </>
               }>
          <p style={{margin:'0 0 10px'}}>This removes <b>{confirmDelete.name}</b> from the project — all fields, generation history, prompts and portrait references go with it.</p>
          <div className="col" style={{gap:6, padding:'10px 12px', background:'var(--bg)', borderRadius:4, border:'1px solid var(--hair)', marginTop:8}}>
            <div className="row" style={{gap:8, fontSize:12}}>
              <span className="dot bad" style={{flexShrink:0}}/>
              <span>{confirmDelete.tokens.toLocaleString()} tokens of formatted text will be lost</span>
            </div>
            <div className="row" style={{gap:8, fontSize:12}}>
              <span className="dot bad" style={{flexShrink:0}}/>
              <span>Lorebook entries scoped only to this character become unscoped (project-wide)</span>
            </div>
            <div className="row" style={{gap:8, fontSize:12}}>
              <span className="dot idle" style={{flexShrink:0}}/>
              <span>The cached wiki crawl stays — you can rebuild from it</span>
            </div>
          </div>
          <p style={{margin:'12px 0 0', fontSize:12, color:'var(--ink-3)'}}>This cannot be undone outside of the project's last save.</p>
        </Modal>
      )}

      {modal === 'saved' && (
        <Modal title="Exported to SillyTavern"
               onClose={() => setModal(null)}
               footer={
                 <>
                   <button className="btn ghost" onClick={() => setModal(null)}>Stay here</button>
                   <button className="btn primary" onClick={() => { setModal(null); setRoute('dashboard'); }}>
                     Back to projects
                   </button>
                 </>
               }>
          <p style={{margin:0}}>Exported <b>{characters.length}</b> characters and the project lorebook (<b>6</b> entries) to your SillyTavern library.</p>
          <div className="col" style={{gap:6, marginTop:14, padding:'10px 12px', background:'var(--bg)', borderRadius:4, border:'1px solid var(--hair)'}}>
            {characters.map(c => (
              <div key={c.id} className="row" style={{gap:8}}>
                <I.Check size={13} style={{color:'var(--ok)'}}/>
                <span className="mono" style={{fontSize:11.5}}>characters/{c.name.toLowerCase().replace(/\s+/g, '_')}.png</span>
              </div>
            ))}
            <div className="row" style={{gap:8, marginTop:4, paddingTop:6, borderTop:'1px solid var(--hair)'}}>
              <I.Check size={13} style={{color:'var(--ok)'}}/>
              <span className="mono" style={{fontSize:11.5}}>worldinfo/harper_cell.json</span>
            </div>
          </div>
        </Modal>
      )}

      <TweaksPanel title="Silly Sleeve · Tweaks">
        <TweakSection label="Appearance"/>
        <TweakToggle label="Dark mode" value={t.dark}
                     onChange={v => setTweak('dark', v)}/>
        <TweakColor label="Accent" value={t.accent}
                    options={['#e07a4f', '#8b5cf6', '#22a06b', '#d33f49', '#3b82f6', '#c79e3b']}
                    onChange={v => setTweak('accent', v)}/>

        <TweakSection label="Layout"/>
        <TweakRadio label="Sidebar" value={t.sidebar}
                    options={['rail', 'compact', 'wide']}
                    onChange={v => setTweak('sidebar', v)}/>
        <TweakToggle label="Step numbers" value={t.showStepBadges}
                     onChange={v => setTweak('showStepBadges', v)}/>

        <TweakSection label="Jump to"/>
        <div className="col" style={{gap:4}}>
          {NAV.map(n => (
            <button key={n.id} className="ss-nav-item"
                    data-active={route === n.id ? '1' : '0'}
                    onClick={() => setRoute(n.id)}
                    style={{padding:'6px 8px'}}>
              {React.createElement(I[n.icon], { size: 13 })}
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
