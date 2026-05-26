// ─── Compose (editor) screen ───────────────────────────────

const FIELDS = [
  { id: 'name',        label: 'Name',         req: true,  type: 'line',  helper: 'How the model addresses the character.' },
  { id: 'epithet',     label: 'Title / epithet', req: false, type: 'line', helper: 'Optional flourish, shown beneath the name.' },
  { id: 'tags',        label: 'Tags',         req: false, type: 'tags',  helper: 'Used by SillyTavern\'s prompt filters.' },
  { id: 'appearance',  label: 'Appearance',   req: true,  type: 'text',  helper: 'Sensory description: build, dress, marks.' },
  { id: 'personality', label: 'Personality',  req: true,  type: 'text',  helper: 'Traits as a comma list or short prose.' },
  { id: 'backstory',   label: 'Backstory',    req: false, type: 'text',  helper: 'Compressed past — model condenses lore.' },
  { id: 'abilities',   label: 'Abilities & skills', req: false, type: 'text', helper: 'Powers, magic, mundane talents.' },
  { id: 'relationships', label: 'Relationships', req: false, type: 'text', helper: 'Allies, rivals, ties to other NPCs.' },
  { id: 'quotes',      label: 'Example quotes', req: false, type: 'quotes', helper: 'Voice anchors — italic, in-character.' },
  { id: 'stats',       label: 'Stat block',   req: false, type: 'stats', helper: 'Custom numbers — STR, HP, age, etc.' },
];

const SEED_VALUES = {
  name: 'Elara Wynd',
  epithet: 'The Crimson Lark',
  tags: ['half-elf', 'bard', 'harper', 'docks', 'morally grey'],
  appearance: `Mid-height half-elf, mid-twenties in human years. Auburn hair cut at the shoulder, smoke-grey eyes, a notched scar on her left ear. She wears a sleeveless leather doublet stained wine-dark, with a lark sigil tooled near the collar. A worn rapier — "Songthorn" — rides on her left hip, balanced by a quill-case of folded ravensteel on her right.`,
  personality: `Cheerful with strangers, watchful with friends. Collects names the way other bards collect rhymes; remembers everyone by the first lie they told her. Drinks little but matches every cup at her table, then pours hers into a hidden flask. Quick to laugh, slow to forgive, never the first one out the door of a tavern fire.`,
  backstory: `Born in Reithwin during the early Shadow-curse and smuggled to the coast in a refugee wagon. Trained as a chorister at the Temple of Lathander in Baldur's Gate, but left when she found her voice opened doors faster than her prayers. Recruited by the Harpers two winters ago after she sang a coded ballad in the Elfsong that nobody but a Harper should have known.`,
  abilities: `College of Lore bard — Cutting Words, Bardic Inspiration, second-level spells. Speaks Elvish, Common, Thieves' Cant. Skilled at reading lips across a crowded room and at picking simple locks with a bone hairpin. Carries one casting of Disguise Self per day in a folded silver paper inside her doublet.`,
  relationships: `• Halsin (mentor in spirit, never met) — Elara learned of the druid through Harper letters and keeps a pressed leaf from him as a luck-token.\n• Wyll Ravengard — drinking acquaintance; she sings him false news to test if it reaches Ulder.\n• Cazador Szarr — never met; she'd cross the Sword Coast to put a quarrel in his eye.`,
  quotes: [
    `You have the look of a man who pays for his secrets with his name. Sit. I'll pour.`,
    `A song is just a contract you can't read.`,
    `Lathander was very kind to me. That is why I left.`,
  ],
  stats: [
    ['STR', '10'], ['DEX', '16'], ['CON', '12'],
    ['INT', '13'], ['WIS', '11'], ['CHA', '18'],
    ['HP', '34/34'], ['AC', '15'], ['age', '27'], ['height', '5\'8"'],
  ],
};

// Track per-field state in a hook
function useFields() {
  const init = FIELDS.reduce((acc, f) => {
    acc[f.id] = {
      value: SEED_VALUES[f.id] ?? (f.type === 'tags' ? [] : f.type === 'quotes' ? [''] : f.type === 'stats' ? [['', '']] : ''),
      locked: false,
      rolling: false,
      showPrompt: false,
      prompt: '',
      history: f.id === 'epithet' ? 2 : f.id === 'personality' ? 3 : 1,
    };
    return acc;
  }, {});
  const [state, setState] = React.useState(init);
  const set = (id, patch) => setState(s => ({ ...s, [id]: { ...s[id], ...patch } }));
  return [state, set];
}

function FieldCard({ field, st, onChange, onPatch }) {
  const wordCount = React.useMemo(() => {
    const v = st.value;
    if (typeof v === 'string') return v.trim().split(/\s+/).filter(Boolean).length;
    if (Array.isArray(v) && field.type === 'tags') return v.length + ' tags';
    if (Array.isArray(v) && field.type === 'quotes') return v.length + ' quotes';
    if (Array.isArray(v) && field.type === 'stats') return v.length + ' rows';
    return 0;
  }, [st.value, field.type]);

  const startReroll = () => {
    onPatch({ rolling: true });
    setTimeout(() => onPatch({ rolling: false, history: st.history + 1, showPrompt: false, prompt: '' }), 1400);
  };

  const idx = FIELDS.findIndex(f => f.id === field.id) + 1;

  return (
    <div className="field-card" data-locked={st.locked ? '1' : '0'} data-state={st.rolling ? 'rolling' : 'idle'}>
      <div className="fc-head">
        <span className="num">{String(idx).padStart(2, '0')}</span>
        <h4>{field.label}</h4>
        <span className="req" data-r={field.req ? '1' : '0'}>{field.req ? 'required' : 'optional'}</span>
        <span className="grow"/>
        <div className="tools">
          <button className="tool" title="Custom reroll prompt"
                  data-active={st.showPrompt ? '1' : '0'}
                  onClick={() => onPatch({ showPrompt: !st.showPrompt })}><I.Pen size={14}/></button>
          <button className="tool" title="Lock — won't re-roll with Compose All"
                  data-active={st.locked ? '1' : '0'}
                  onClick={() => onPatch({ locked: !st.locked })}><I.Lock size={14}/></button>
          <button className="tool" title="Copy"><I.Copy size={14}/></button>
          <button className="tool" title="Re-roll this field" disabled={st.locked} onClick={startReroll}>
            <I.Reroll size={14}/>
          </button>
        </div>
      </div>

      {st.showPrompt && (
        <div className="fc-reroll-prompt">
          <I.Sparks size={14} style={{color:'var(--acc)', marginTop:4, flexShrink:0}}/>
          <textarea
            placeholder="Steer the re-roll · e.g. “more sinister, less courtly; keep the lark imagery”"
            value={st.prompt}
            onChange={e => onPatch({ prompt: e.target.value })}
          />
          <button className="btn primary sm" onClick={startReroll}><I.Dice size={12}/> Roll</button>
        </div>
      )}

      {field.type === 'line' && (
        <input className="field" value={st.value} disabled={st.locked}
               onChange={e => onChange(e.target.value)}/>
      )}

      {field.type === 'text' && (
        <textarea className="field" value={st.value} disabled={st.locked}
                  onChange={e => onChange(e.target.value)}
                  style={{minHeight: field.id === 'backstory' || field.id === 'appearance' ? 140 : 100}}/>
      )}

      {field.type === 'tags' && (
        <TagsField value={st.value} onChange={onChange} disabled={st.locked}/>
      )}

      {field.type === 'quotes' && (
        <div className="col" style={{gap:6}}>
          {st.value.map((q, i) => (
            <div key={i} className="quote-row">
              <textarea
                rows={Math.max(2, Math.ceil(q.length / 60))}
                value={q}
                disabled={st.locked}
                onChange={e => onChange(st.value.map((x, j) => j === i ? e.target.value : x))}
              />
              <span className="x" onClick={() => onChange(st.value.filter((_, j) => j !== i))}>
                <I.X size={12}/>
              </span>
            </div>
          ))}
          <button className="btn ghost sm" style={{alignSelf:'flex-start'}}
                  onClick={() => onChange([...st.value, ''])}>
            <I.Plus size={11}/> Add quote
          </button>
        </div>
      )}

      {field.type === 'stats' && (
        <StatsField value={st.value} onChange={onChange} disabled={st.locked}/>
      )}

      <div className="fc-foot">
        <div className="row">
          <span>{wordCount} {typeof wordCount === 'number' ? 'words' : ''}</span>
          {st.history > 1 && (
            <span className="hist">
              <I.Dice size={11}/> {st.history} versions <I.Down size={10}/>
            </span>
          )}
          {st.locked && <span style={{color:'var(--ink-3)'}}><I.Lock size={11}/> locked</span>}
        </div>
        <span style={{color:'var(--ink-3)'}}>{field.helper}</span>
      </div>
    </div>
  );
}

function TagsField({ value, onChange, disabled }) {
  const [draft, setDraft] = React.useState('');
  const submit = () => {
    const t = draft.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="tags-input">
      {value.map((t, i) => (
        <span key={t} className={`tag ${i < 2 ? 'acc' : ''}`}>
          {t}
          <span className="x" onClick={() => onChange(value.filter(x => x !== t))}>×</span>
        </span>
      ))}
      <input
        disabled={disabled}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); submit(); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        placeholder={value.length ? '' : 'Add tag and press Enter…'}
      />
    </div>
  );
}

function StatsField({ value, onChange, disabled }) {
  return (
    <div className="stat-grid">
      {value.map(([k, v], i) => (
        <div key={i} className="stat-row">
          <input className="key" placeholder="stat" value={k} disabled={disabled}
                 onChange={e => onChange(value.map((r, j) => j === i ? [e.target.value, r[1]] : r))}/>
          <span style={{color:'var(--ink-3)'}}>·</span>
          <input className="val" placeholder="—" value={v} disabled={disabled}
                 onChange={e => onChange(value.map((r, j) => j === i ? [r[0], e.target.value] : r))}/>
          <span className="x" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <I.X size={12}/>
          </span>
        </div>
      ))}
      <button className="btn ghost sm" style={{gridColumn: '1 / -1', justifySelf:'flex-start'}}
              onClick={() => onChange([...value, ['', '']])}>
        <I.Plus size={11}/> Add stat
      </button>
    </div>
  );
}

function Editor({ onContinue, characters, activeCharId, activeChar, onSelectChar, onAddChar, onDeleteChar }) {
  const [fields, set] = useFields();
  const [composing, setComposing] = React.useState(false);

  const composeAll = () => {
    setComposing(true);
    const unlocked = FIELDS.filter(f => !fields[f.id].locked);
    unlocked.forEach((f, i) => {
      setTimeout(() => set(f.id, { rolling: true }), i * 120);
      setTimeout(() => set(f.id, { rolling: false, history: fields[f.id].history + 1 }), i * 120 + 1100);
    });
    setTimeout(() => setComposing(false), unlocked.length * 120 + 1200);
  };

  const lockedCount = Object.values(fields).filter(f => f.locked).length;
  const totalTokens = 1247; // mock

  return (
    <>
      <PageHead step={2} subtitle="Let the model format the lore"
        title={<>Compose <em style={{fontStyle:'normal',color:'var(--acc)'}}>{activeChar ? activeChar.name.split(' ')[0] : 'character'}</em></>}
        actions={
          <>
            <button className="btn ghost" title={`Delete ${activeChar?.name || 'character'}`}
                    onClick={() => activeChar && onDeleteChar && onDeleteChar(activeChar.id)}
                    disabled={!activeChar || characters.length <= 1}
                    style={{color: 'var(--bad)'}}>
              <I.Trash size={14}/> Delete
            </button>
            <button className="btn ghost" onClick={() => window.toast && window.toast({
              kind: 'ok', title: 'Character saved',
              body: `${activeChar ? activeChar.name : 'Draft'} · ${Object.values(fields).filter(f => f.history > 1).length} fields written.`,
            })}><I.Save size={14}/> Save</button>
            <button className="btn ghost" onClick={composeAll} disabled={composing}>
              <I.Dice size={14}/> Re-roll all {lockedCount > 0 && <span style={{opacity:0.6,marginLeft:4}}>({FIELDS.length - lockedCount})</span>}
            </button>
            <button className="btn primary" onClick={onContinue}>
              Continue to Lorebook <I.Arrow size={14}/>
            </button>
          </>
        } />
      <CharacterStrip characters={characters} activeId={activeCharId}
                      onSelect={onSelectChar} onAdd={onAddChar} showAdd/>
      <div className="ss-page-body scroll">
        <div className="editor-grid">
          {/* SOURCE PANEL */}
          <div className="editor-source">
            <div className="h">
              <b><em>elara_wynd</em> · source</b>
              <button className="btn ghost sm"><I.Globe size={12}/> Re-crawl</button>
            </div>
            <div className="b scroll">
              <p><b>Elara Wynd</b>, called the <mark>Crimson Lark</mark> by the patrons of the Elfsong, is a half-elf bard who haunts the docks of Baldur's Gate.</p>
              <p>She wears a sleeveless leather doublet stained the colour of dried wine, with a sigil of a lark tooled near the collar. <mark>Her left ear bears a notched scar from a duel.</mark></p>
              <p>Cheerful in public houses, watchful in alleys. <mark>She collects names the way other bards collect rhymes.</mark></p>
              <p>Born in Reithwin Town the year of the Mind Flayer crisis, Elara survived the Shadow-curse by sheltering in a refugee wagon bound for the coast…</p>
              <p style={{color:'var(--ink-3)', fontSize:11.5, marginTop:14}}>4 sections · 1,842 words · highlighted spans were consumed by the formatter.</p>
            </div>
            <div className="f">
              <span>1,842 → 1,247 tokens</span>
              <span><I.Check size={12} style={{verticalAlign:-2,marginRight:3}}/> embedded</span>
            </div>
          </div>

          {/* FIELDS */}
          <div className="col" style={{gap:12}}>
            {FIELDS.map(f => (
              <FieldCard key={f.id}
                field={f}
                st={fields[f.id]}
                onChange={v => set(f.id, { value: v })}
                onPatch={p => set(f.id, p)}
              />
            ))}
            <div className="row" style={{justifyContent:'space-between', padding: '12px 4px', color: 'var(--ink-3)'}}>
              <span className="uplabel">{Object.values(fields).filter(f => f.history > 1).length} fields touched · {totalTokens} tokens estimated</span>
              <span className="uplabel"><kbd>⌘</kbd> <kbd>R</kbd> reroll focused</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Editor });
