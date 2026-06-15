import React, { useState, useEffect, useCallback } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  PlusIcon, SearchIcon, TrashIcon, CopyIcon,
  MoreIcon, BookIcon, UploadIcon, PenIcon,
} from '../icons';
import { GetLorebook, SaveLorebook, ExportLorebook, PickExportFolder, GetCharacters, ImportLorebook } from '../../wailsjs/go/main/App';
import { TagsInput } from '../components/TagsInput';
import { reorderByDrag, remapForMerge, renumberFromZero } from '../utils/lorebook';
import { lorebook, compose } from '../../wailsjs/go/models';

const POSITIONS = [
  { i: 0, name: 'Before Char Defs', hint: 'Top of context — system frame' },
  { i: 1, name: 'After Char Defs', hint: 'Just after the character card' },
  { i: 2, name: 'Before Example Msgs', hint: 'Ahead of <START> examples' },
  { i: 3, name: 'After Example Msgs', hint: 'After <START> examples' },
  { i: 4, name: '@ Depth (in chat)', hint: 'Injected N messages back · uses depth' },
  { i: 5, name: 'Before Author Note', hint: 'Just above the author note' },
  { i: 6, name: 'After Author Note', hint: 'Below the author note' },
];

const SEL_LOGIC = [
  { v: 0, label: 'AND ANY' },
  { v: 1, label: 'NOT ALL' },
  { v: 2, label: 'NOT ANY' },
  { v: 3, label: 'AND ALL' },
];

/* ─── Token input (triggers) ────────────────────────── */

const TokenInput: React.FC<{
  value: string[];
  onChange: (v: string[]) => void;
  accentFirst?: boolean;
  placeholder?: string;
}> = ({ value, onChange, accentFirst, placeholder }) => (
  <TagsInput
    value={value}
    onChange={onChange}
    placeholder={placeholder || 'Type and press Enter…'}
    placeholderWhenFilled="Add another…"
    accentCount={accentFirst ? 1 : 0}
    className="lb-keys"
    emptyClassName="empty"
    tagClassName="lb-key"
    accentClassName="primary"
  />
);

/* ─── Toggle ────────────────────────────────────────── */

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button className="lb-switch" data-on={value ? '1' : '0'} onClick={() => onChange(!value)}>
    <i />
  </button>
);

const ToggleRow: React.FC<{ label: string; hint: string; value: boolean; onChange: (v: boolean) => void }> =
  ({ label, hint, value, onChange }) => (
    <div className="lb-toggle-row">
      <div><b>{label}</b><small>{hint}</small></div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );

/* ─── Entry detail editor ───────────────────────────── */

const LbDetail: React.FC<{
  entry: lorebook.Entry | null;
  characters: compose.Character[];
  onChange: (e: lorebook.Entry) => void;
}> = ({ entry, characters, onChange }) => {
  if (!entry) return (
    <div className="lb-detail" style={{display:'grid', placeItems:'center', color:'var(--ink-3)'}}>
      <div className="col" style={{alignItems:'center', textAlign:'center', gap:8}}>
        <BookIcon size={36} style={{opacity:0.4}}/>
        <div className="serif-i" style={{fontSize:24, color:'var(--ink-2)'}}>Pick an entry to edit</div>
        <div className="helpr">Or add a new one with the button below.</div>
      </div>
    </div>
  );

  const set = <K extends keyof lorebook.Entry>(k: K, v: lorebook.Entry[K]) => onChange({...entry, [k]: v} as lorebook.Entry);
  const tokenCount = entry.content ? Math.round(entry.content.length / 4) : 0;

  return (
    <div className="lb-detail">
      <div className="dh">
        <span className="id-pill">UID · {String(entry.uid || 0).padStart(3, '0')}</span>
        <input className="title" value={entry.comment || ''} onChange={e => set('comment', e.target.value)}
               placeholder="Entry name…" />
        <div className="tools">
          <button className="btn ghost icon" title="Duplicate"><CopyIcon size={14}/></button>
          <button className="btn ghost icon" title="Delete"><TrashIcon size={14}/></button>
        </div>
      </div>

      <div className="db scroll">
        {/* === KEYS === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Triggers</h4><hr/></div>
          <div className="lb-row">
            <span>Primary keys<small>Any match activates this entry.</small></span>
            <TokenInput value={entry.key || []} onChange={v => set('key', v)} accentFirst
                        placeholder='e.g. "Harpers", "silver harp"…'/>
          </div>
          <div className="lb-row">
            <span>Secondary keys<small>Combined with primary via the logic below.</small></span>
            <TokenInput value={entry.keysecondary || []} onChange={v => set('keysecondary', v)}
                        placeholder="Optional…"/>
          </div>
          <div className="lb-row">
            <span>Selective logic<small>How primary &amp; secondary keys combine.</small></span>
            <div className="lb-grid-2">
              <div className="lb-seg">
                {SEL_LOGIC.map(o => (
                  <button key={o.v} data-on={entry.selectiveLogic === o.v ? '1' : '0'}
                          onClick={() => set('selectiveLogic', o.v)}>
                    {o.label} <span className="k">{o.v}</span>
                  </button>
                ))}
              </div>
              <ToggleRow label="Selective" hint="Require secondary keys"
                         value={entry.selective || false} onChange={v => set('selective', v)}/>
            </div>
          </div>
        </div>

        {/* === CONTENT === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Content</h4><hr/></div>
          <div className="lb-content">
            <div className="ch">
              <PenIcon size={11}/> <span>Injected verbatim when triggered</span>
            </div>
            <textarea value={entry.content || ''} onChange={e => set('content', e.target.value)} spellCheck={false}/>
            <div className="cf">
              <span><b>{(entry.content || '').length.toLocaleString()}</b> chars</span>
              <span><b>~{tokenCount.toLocaleString()}</b> tokens</span>
              <span className="grow"/>
              <span>Markdown</span>
            </div>
          </div>
        </div>

        {/* === POSITION === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Position in context</h4><hr/></div>
          <div className="lb-positions">
            {POSITIONS.map(p => (
              <button key={p.i} className="lb-pos" data-on={entry.position === p.i ? '1' : '0'}
                      onClick={() => set('position', p.i)}>
                <b><span className="ix">{p.i}</span>{p.name}</b>
                <small>{p.hint}</small>
              </button>
            ))}
          </div>
          {entry.position === 4 && (
            <div className="lb-row">
              <span>Depth<small>Injected N messages back into chat history.</small></span>
              <div className="lb-mini" style={{maxWidth:200}}>
                <input type="number" min={0} max={64} value={entry.depth || 4}
                       onChange={e => set('depth', +e.target.value)}/>
              </div>
            </div>
          )}
        </div>

        {/* === SCOPE === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Character scope</h4><hr/></div>
          <div className="lb-row">
            <span>Applies to<small>No selection = global (all characters).</small></span>
            <div className="lb-scope">
              {characters.length === 0 && <span className="lb-scope-empty">No characters in project.</span>}
              {characters.map(c => {
                const id = String(c.id);
                const on = (entry.characters || []).includes(id);
                return (
                  <button key={c.id} type="button" className="lb-scope-chip" data-on={on ? '1' : '0'}
                          onClick={() => set('characters',
                            on ? (entry.characters || []).filter(x => x !== id)
                               : [...(entry.characters || []), id])}>
                    {c.name || `#${c.id}`}
                  </button>
                );
              })}
            </div>
            {(entry.characters || []).length === 0 && characters.length > 0 &&
              <small className="lb-scope-note">Global · all characters</small>}
          </div>
        </div>

        {/* === ACTIVATION === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Activation</h4><hr/></div>
          <div className="lb-grid-3">
            <div className="lb-mini">
              <span>Order</span>
              <input type="number" value={entry.order || 100} onChange={e => set('order', +e.target.value)}/>
              <span className="help">Higher = inserted first.</span>
            </div>
            <div className="lb-mini">
              <span>Sticky</span>
              <input type="number" min={0} value={entry.sticky || 0} onChange={e => set('sticky', +e.target.value)}/>
              <span className="help">Stay active N messages after trigger.</span>
            </div>
            <div className="lb-mini">
              <span>UID</span>
              <input type="number" value={entry.uid || 0} disabled style={{opacity:0.6}}/>
              <span className="help">Auto-assigned on save.</span>
            </div>
          </div>
          <div className="lb-row">
            <span>Probability<small>Chance the entry fires when keys match.</small></span>
            <div className="col" style={{gap:8}}>
              <div className="prob-bar">
                <input type="range" min={0} max={100} value={entry.probability || 100}
                       disabled={!entry.useProbability}
                       onChange={e => set('probability', +e.target.value)}/>
                <span className="val">{entry.probability || 100}</span>
              </div>
              <ToggleRow label="Use probability" hint="Off = always fire when keys match (100%)"
                         value={entry.useProbability || false} onChange={v => set('useProbability', v)}/>
            </div>
          </div>
        </div>

        {/* === BEHAVIOR === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Behavior</h4><hr/></div>
          <div className="lb-grid-2">
            <ToggleRow label="Constant" hint="Always active — ignores keys"
                       value={entry.constant || false} onChange={v => set('constant', v)}/>
            <ToggleRow label="Vectorized" hint="Trigger via semantic match"
                       value={entry.vectorized || false} onChange={v => set('vectorized', v)}/>
            <ToggleRow label="Add as memo" hint="Show in the chat memo panel"
                       value={entry.addMemo !== false} onChange={v => set('addMemo', v)}/>
            <ToggleRow label="Ignore budget" hint="Always inject, even past token limit"
                       value={entry.ignoreBudget || false} onChange={v => set('ignoreBudget', v)}/>
            <ToggleRow label="Exclude from recursion" hint="This entry's content won't trigger others"
                       value={entry.excludeRecursion || false} onChange={v => set('excludeRecursion', v)}/>
            <ToggleRow label="Prevent further recursion" hint="Stop chain when this fires"
                       value={entry.preventRecursion || false} onChange={v => set('preventRecursion', v)}/>
            <ToggleRow label="Disabled" hint="Skip during context build"
                       value={entry.disable || false} onChange={v => set('disable', v)}/>
          </div>
        </div>
      </div>

      <div className="lb-meta-bar">
        <span><b>Pos</b> {POSITIONS[entry.position || 0]?.name || '—'}</span>
        <span><b>Order</b> {entry.order || 100}</span>
        <span><b>P</b> {entry.useProbability ? (entry.probability || 100) + '%' : '∞'}</span>
        {entry.constant && <span style={{color:'var(--acc)'}}>constant</span>}
        {entry.vectorized && <span style={{color:'oklch(0.55 0.18 280)'}}>vector</span>}
        {entry.disable && <span style={{color:'var(--bad)'}}>disabled</span>}
      </div>
    </div>
  );
};

/* ─── Lorebook screen ───────────────────────────────── */

function positionLabel(e: lorebook.Entry): string {
  if (e.constant) return 'A';
  if (e.vectorized) return 'V';
  return `P${e.position || 0}`;
}

const LorebookScreen: React.FC = () => {
  const [entries, setEntries] = useState<lorebook.Entry[]>([]);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [dragUid, setDragUid] = useState<number | null>(null);
  const [pendingImport, setPendingImport] = useState<lorebook.Entry[] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    GetLorebook().then(es => {
      setEntries(es || []);
      setLoaded(true);
    }).catch(() => {
      toast({ kind: 'bad', title: 'Load failed', body: 'Could not load lorebook entries.' });
      setLoaded(true);
    });
  }, [toast]);

  useEffect(() => {
    GetCharacters().then(cs => setCharacters(cs || [])).catch(() => setCharacters([]));
  }, []);

  useEffect(() => {
    if (!pendingImport) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingImport(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingImport]);

  const persist = useCallback((es: lorebook.Entry[]) => {
    setEntries(es);
    SaveLorebook(es).catch(() => {
      toast({ kind: 'bad', title: 'Save failed', body: 'Could not persist lorebook.' });
    });
  }, [toast]);

  const filtered = entries.filter(e =>
    !search ||
    (e.comment || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.key || []).some(k => k.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = entries.find(e => e.uid === selectedUid) || null;

  const updateSelected = (updated: lorebook.Entry) => {
    const next = entries.map(e => e.uid === updated.uid ? updated : e);
    persist(next);
  };

  const addEntry = () => {
    const maxUid = entries.reduce((m, e) => Math.max(m, e.uid || 0), -1);
    const fresh = new lorebook.Entry({
      uid: maxUid + 1,
      comment: 'New entry',
      key: [],
      keysecondary: [],
      content: '',
      constant: false,
      selective: false,
      selectiveLogic: 0,
      addMemo: true,
      order: 100,
      position: 0,
      disable: false,
      probability: 100,
      useProbability: true,
      depth: 4,
      sticky: 0,
      vectorized: false,
      ignoreBudget: false,
      excludeRecursion: false,
      preventRecursion: false,
      characters: [],
    });
    const next = [...entries, fresh];
    persist(next);
    setSelectedUid(fresh.uid);
  };

  const deleteSelected = () => {
    if (selectedUid == null) return;
    const next = entries.filter(e => e.uid !== selectedUid);
    persist(next);
    setSelectedUid(null);
  };

  const duplicateEntry = () => {
    if (!selected) return;
    const maxUid = entries.reduce((m, e) => Math.max(m, e.uid || 0), -1);
    const copy = {...selected, uid: maxUid + 1, comment: (selected.comment || 'Entry') + ' (copy)'};
    const next = [...entries, copy];
    persist(next);
    setSelectedUid(copy.uid);
  };

  const dragEnabled = !search; // reorder only meaningful over the full, unfiltered list

  const handleDrop = (targetUid: number) => {
    if (dragUid == null || dragUid === targetUid) { setDragUid(null); return; }
    persist(reorderByDrag(entries, dragUid, targetUid));
    setDragUid(null);
  };

  const handleExport = useCallback(async () => {
    try {
      const folder = await PickExportFolder();
      if (!folder) return;
      const filePath = await ExportLorebook(folder);
      toast({ kind: 'ok', title: 'Lorebook exported', body: `Written to ${filePath}.` });
    } catch (e: any) {
      if (e?.message) {
        toast({ kind: 'bad', title: 'Export failed', body: e.message });
      }
    }
  }, [toast]);

  const handleImport = useCallback(async () => {
    try {
      const imported = await ImportLorebook();
      // Empty array = a file with no entries (inform the user). null/undefined = the
      // user cancelled the dialog (stay silent).
      if (!imported || imported.length === 0) {
        if (imported?.length === 0) {
          toast({ kind: 'info', title: 'Nothing imported', body: 'No entries found in that file.' });
        }
        return;
      }
      setPendingImport(imported);
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Import failed', body: e?.message || 'Could not read that file.' });
    }
  }, [toast]);

  const applyImport = (mode: 'merge' | 'replace') => {
    if (!pendingImport) return;
    const next = mode === 'merge'
      ? [...entries, ...remapForMerge(entries, pendingImport)]
      : renumberFromZero(pendingImport);
    persist(next);
    setSelectedUid(next.length ? next[mode === 'merge' ? entries.length : 0].uid : null);
    setPendingImport(null);
    toast({ kind: 'ok', title: 'Lorebook imported', body: `${pendingImport.length} entr${pendingImport.length === 1 ? 'y' : 'ies'} ${mode === 'merge' ? 'merged' : 'loaded'}.` });
  };

  if (!loaded) {
    return (
      <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="shimmer" style={{ width: 200, height: 16 }} />
      </div>
    );
  }

  const active = entries.filter(e => !e.disable).length;
  const totalTokens = entries.reduce((s, e) => s + Math.round((e.content || '').length / 4), 0);

  return (
    <>
      <PageHead step={3} subtitle="Build the world around them"
        title={<>Author the <em style={{fontStyle:'normal',color:'var(--acc)'}}>lorebook</em></>}
        actions={
          <>
            <button className="btn ghost" onClick={handleImport}><UploadIcon size={13}/> Import .json</button>
            <button className="btn ghost" onClick={handleExport}><UploadIcon size={13}/> Export world_info.json</button>
          </>
        } />
      <div className="ss-page-body scroll">
        <div className="lb-grid">
          {/* LEFT — list */}
          <div className="lb-list">
            <div className="lh">
              <div className="row">
                <h3 className="name">Lorebook</h3>
              </div>
              <div className="meta">
                <b>{entries.length}</b> entries · <b>{active}</b> active · ~<b>{totalTokens.toLocaleString()}</b> tokens
              </div>
              <div className="sr">
                <SearchIcon size={13}/>
                <input className="search" placeholder="Search by name or trigger key…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
            </div>

            <div className="lb-entries scroll">
              {filtered.sort((a, b) => (b.order || 0) - (a.order || 0)).map(e => (
                <button key={e.uid} className="lb-entry"
                        data-on={selectedUid === e.uid ? '1' : '0'}
                        data-disabled={e.disable ? '1' : '0'}
                        draggable={dragEnabled}
                        onDragStart={() => setDragUid(e.uid)}
                        onDragOver={ev => { if (dragEnabled) ev.preventDefault(); }}
                        onDrop={ev => { ev.preventDefault(); handleDrop(e.uid); }}
                        data-drag={dragUid === e.uid ? '1' : '0'}
                        onClick={() => setSelectedUid(e.uid)}>
                  <span className="grip"><MoreIcon size={12}/></span>
                  <span className="uid">{String(e.uid || 0).padStart(2, '0')}</span>
                  <div className="body">
                    <b>{e.comment || 'Untitled'}</b>
                    <div className="keys">
                      {(e.key || []).slice(0, 3).map(k => <span key={k} className="k">{k}</span>)}
                      {(e.key || []).length > 3 && <span className="ko">+{(e.key || []).length - 3}</span>}
                      {(e.key || []).length === 0 && <span className="ko">no keys</span>}
                    </div>
                  </div>
                  <div className="meta">
                    <span className="ord">{e.order || 100}</span>
                    <span className={'pos' + (e.constant ? ' constant' : '') + (e.vectorized ? ' vec' : '')}>
                      {positionLabel(e)}
                    </span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{padding:'30px 12px', textAlign:'center', color:'var(--ink-3)', fontSize:12}}>
                  {search ? `No entries match "${search}".` : 'No entries yet. Add one below.'}
                </div>
              )}
            </div>

            <div className="lf">
              <button className="btn primary" onClick={addEntry}><PlusIcon size={13}/> New entry</button>
              {selected && (
                <>
                  <button className="btn ghost" onClick={duplicateEntry}><CopyIcon size={13}/> Duplicate</button>
                  <button className="btn ghost" onClick={deleteSelected} style={{color: 'var(--bad)'}}><TrashIcon size={13}/> Delete</button>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — detail */}
          <LbDetail entry={selected} characters={characters} onChange={updateSelected}/>
        </div>
      </div>
      {pendingImport && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div className="lb-import-overlay" role="dialog" aria-label="Import lorebook" onClick={e => { if (e.target === e.currentTarget) setPendingImport(null); }}>
          <div className="lb-import-card">
            <h3>Import {pendingImport.length} entr{pendingImport.length === 1 ? 'y' : 'ies'}</h3>
            <p>Merge into the current {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}, or replace them?</p>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
              <button className="btn ghost" onClick={() => applyImport('replace')}>Replace all</button>
              <button className="btn primary" onClick={() => applyImport('merge')}>Merge</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LorebookScreen;
