import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import { useAutoSave } from '../components/useAutoSave';
import {
  LockIcon, CopyIcon, RerollIcon, SparksIcon,
  SaveIcon, ArrowIcon, PlusIcon, XIcon, DownIcon,
  CheckIcon, TrashIcon, DiceIcon, GlobeIcon, FolderIcon,
} from '../icons';
import {
  GetCharacters, AddCharacter, UpdateCharacter, DeleteCharacter,
  SetActiveCharacter, GetCachedCrawl, CountTokens,
  GenerateField, GenerateCharacterBulk,
  PickSaveBundle, SaveProjectBundle,
} from '../../wailsjs/go/main/App';
import { SectionContent } from '../components/SectionContent';
import { TagsInput } from '../components/TagsInput';
import { logError } from '../utils/log';
import { compose, crawler } from '../../wailsjs/go/models';

interface FieldSpec {
  id: string;
  label: string;
  required: boolean;
  type: 'line' | 'text' | 'tags' | 'quotes' | 'stats';
  helper: string;
}

const FIELDS: FieldSpec[] = [
  { id: 'name',          label: 'Name',                required: true,  type: 'line',   helper: 'How the model addresses the character.' },
  { id: 'epithet',       label: 'Title / epithet',     required: false, type: 'line',   helper: 'Optional flourish, shown beneath the name.' },
  { id: 'tags',          label: 'Tags',                 required: false, type: 'tags',   helper: "Used by SillyTavern's prompt filters." },
  { id: 'appearance',    label: 'Appearance',           required: true,  type: 'text',   helper: 'Sensory description: build, dress, marks.' },
  { id: 'personality',   label: 'Personality',          required: true,  type: 'text',   helper: 'Traits as a comma list or short prose.' },
  { id: 'backstory',     label: 'Backstory',            required: false, type: 'text',   helper: 'Compressed past — model condenses lore.' },
  { id: 'abilities',     label: 'Abilities & skills',   required: false, type: 'text',   helper: 'Powers, magic, mundane talents.' },
  { id: 'relationships', label: 'Relationships',        required: false, type: 'text',   helper: 'Allies, rivals, ties to other NPCs.' },
  { id: 'quotes',        label: 'Example quotes',       required: false, type: 'quotes', helper: 'Voice anchors — italic, in-character.' },
  { id: 'stats',         label: 'Stat block',           required: false, type: 'stats',  helper: 'Custom numbers — STR, HP, age, etc.' },
];

interface FieldState {
  value: any;
  locked: boolean;
  dirty: boolean;
  showPrompt: boolean;
  prompt: string;
  rolling: boolean;
  history: number;
}

function wordCount(val: any, type: string): number {
  if (typeof val === 'string') return val.trim().split(/\s+/).filter(Boolean).length;
  if (Array.isArray(val) && type === 'tags') return 0;
  if (Array.isArray(val) && type === 'quotes') return val.map((q: string) => q.trim().split(/\s+/).filter(Boolean).length).reduce((a: number,b: number) => a+b, 0);
  if (Array.isArray(val) && type === 'stats') return 0;
  return 0;
}

function wordCountLabel(val: any, type: string): string {
  const wc = wordCount(val, type);
  if (Array.isArray(val) && type === 'tags') return val.length + ' tags';
  if (Array.isArray(val) && type === 'quotes') return val.length + ' quotes, ' + wc + ' words';
  if (Array.isArray(val) && type === 'stats') return val.length + ' rows';
  return wc + ' words';
}

function charsFromFieldState(ch: compose.Character, fields: Record<string, FieldState>): compose.Character {
  return compose.Character.createFrom({
    ...ch,
    name: fields.name?.value ?? ch.name,
    epithet: fields.epithet?.value ?? ch.epithet,
    tags: fields.tags?.value ?? ch.tags,
    appearance: fields.appearance?.value ?? ch.appearance,
    personality: fields.personality?.value ?? ch.personality,
    backstory: fields.backstory?.value ?? ch.backstory,
    abilities: fields.abilities?.value ?? ch.abilities,
    relationships: fields.relationships?.value ?? ch.relationships,
    quotes: fields.quotes?.value ?? ch.quotes,
    stats: fields.stats?.value ?? ch.stats,
    dirty: Object.values(fields).some(f => f.dirty),
  });
}

function fieldStateFromChar(ch: compose.Character, field: FieldSpec): FieldState {
  let val: any;
  switch (field.id) {
    case 'name': val = ch.name; break;
    case 'epithet': val = ch.epithet; break;
    case 'tags': val = ch.tags ?? []; break;
    case 'appearance': val = ch.appearance; break;
    case 'personality': val = ch.personality; break;
    case 'backstory': val = ch.backstory; break;
    case 'abilities': val = ch.abilities; break;
    case 'relationships': val = ch.relationships; break;
    case 'quotes': val = (ch.quotes && ch.quotes.length > 0) ? ch.quotes : ['']; break;
    case 'stats': val = (ch.stats && ch.stats.length > 0) ? ch.stats : [{ key: '', value: '' }]; break;
    default: val = '';
  }
  return { value: val, locked: false, dirty: false, showPrompt: false, prompt: '', rolling: false, history: 1 };
}

const StatsField: React.FC<{
  value: compose.StatKV[]; onChange: (v: compose.StatKV[]) => void; locked: boolean;
}> = ({ value, onChange, locked }) => (
  <div className="stat-grid">
    {value.map((row, i) => (
      <div key={i} className="stat-row">
        <input className="key" placeholder="stat" value={row.key} disabled={locked}
          onChange={e => onChange(value.map((r, j) => j === i ? compose.StatKV.createFrom({ key: e.target.value, value: r.value }) : r))} />
        <span style={{ color: 'var(--ink-3)' }}>·</span>
        <input className="val" placeholder="—" value={row.value} disabled={locked}
          onChange={e => onChange(value.map((r, j) => j === i ? compose.StatKV.createFrom({ key: r.key, value: e.target.value }) : r))} />
        {!locked && (
          <button type="button" className="x" aria-label="Remove stat" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <XIcon size={12} />
          </button>
        )}
      </div>
    ))}
    {!locked && (
      <button className="btn ghost sm" style={{ gridColumn: '1 / -1', justifySelf: 'flex-start' }}
        onClick={() => onChange([...value, compose.StatKV.createFrom({ key: '', value: '' })])}>
        <PlusIcon size={11} /> Add stat
      </button>
    )}
  </div>
);

const FieldCard: React.FC<{
  field: FieldSpec;
  idx: number;
  st: FieldState;
  tokenCount: number;
  onChange: (v: any) => void;
  onPatch: (p: Partial<FieldState>) => void;
  onReroll: () => void;
  onBlur: () => void;
}> = ({ field, idx, st, tokenCount, onChange, onPatch, onReroll, onBlur }) => {
  if (!st) return null;
  const displayCount = wordCountLabel(st.value, field.type);

  const startReroll = () => {
    if (st.locked) return;
    onReroll();
  };

  return (
    <div className="field-card" data-locked={st.locked ? '1' : '0'} data-state={st.rolling ? 'rolling' : 'idle'}>
      <div className="fc-head">
        <span className="num">{String(idx).padStart(2, '0')}</span>
        <h4>{field.label}</h4>
        <span className="req" data-r={field.required ? '1' : '0'}>{field.required ? 'required' : 'optional'}</span>
        <span className="grow" />
        <div className="tools">
          <button className="tool" title="Custom reroll prompt"
            data-active={st.showPrompt ? '1' : '0'}
            onClick={() => onPatch({ showPrompt: !st.showPrompt })}>
            <SparksIcon size={14} />
          </button>
          <button className="tool" title="Lock — won't re-roll with Compose All"
            data-active={st.locked ? '1' : '0'}
            onClick={() => onPatch({ locked: !st.locked })}>
            <LockIcon size={14} />
          </button>
          <button className="tool" title="Copy"
            onClick={() => {
              const v = typeof st.value === 'string' ? st.value : JSON.stringify(st.value);
              navigator.clipboard.writeText(v);
            }}>
            <CopyIcon size={14} />
          </button>
          <button className="tool" title="Re-roll this field" disabled={st.locked} onClick={startReroll}>
            <RerollIcon size={14} />
          </button>
        </div>
      </div>

      {st.showPrompt && (
        <div className="fc-reroll-prompt">
          <SparksIcon size={14} style={{ color: 'var(--acc)', marginTop: 4, flexShrink: 0 }} />
          <textarea
            placeholder="Steer the re-roll · e.g. “more sinister, less courtly; keep the lark imagery”"
            value={st.prompt}
            onChange={e => onPatch({ prompt: e.target.value })}
          />
          <button className="btn primary sm" onClick={startReroll}><RerollIcon size={12} /> Roll</button>
        </div>
      )}

      {st.rolling ? (
        <div className="shimmer" style={{
          height: field.type === 'text' ? (field.id === 'backstory' || field.id === 'appearance' ? 120 : 80) : 38,
          margin: '8px 0',
        }} />
      ) : (
        <>
          {field.type === 'line' && (
            <input className="field" value={st.value} disabled={st.locked}
              onChange={e => { onChange(e.target.value); onPatch({ dirty: true }); }}
              onBlur={onBlur} />
          )}

          {field.type === 'text' && (
            <textarea className="field" value={st.value} disabled={st.locked}
              onChange={e => { onChange(e.target.value); onPatch({ dirty: true }); }}
              onBlur={onBlur}
              style={{ minHeight: field.id === 'backstory' || field.id === 'appearance' ? 140 : 100 }} />
          )}

          {field.type === 'tags' && (
            <TagsInput
              value={st.value}
              onChange={v => { onChange(v); onPatch({ dirty: true }); }}
              disabled={st.locked}
              placeholder="Add tag and press Enter…"
              normalize={s => s.toLowerCase()}
              accentCount={2}
            />
          )}

          {field.type === 'quotes' && (
            <div className="col" style={{ gap: 6 }}>
              {st.value.map((q: string, i: number) => (
                <div key={i} className="quote-row">
                  <textarea
                    rows={Math.max(2, Math.ceil(q.length / 60))}
                    value={q}
                    disabled={st.locked}
                    onChange={e => {
                      const next = st.value.map((x: string, j: number) => j === i ? e.target.value : x);
                      onChange(next);
                      onPatch({ dirty: true });
                    }}
                  />
                  {!st.locked && (
                    <button type="button" className="x" aria-label="Remove quote" onClick={() => onChange(st.value.filter((_: any, j: number) => j !== i))}>
                      <XIcon size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!st.locked && (
                <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                  onClick={() => onChange([...st.value, ''])}>
                  <PlusIcon size={11} /> Add quote
                </button>
              )}
            </div>
          )}

          {field.type === 'stats' && (
            <StatsField value={st.value} onChange={v => { onChange(v); onPatch({ dirty: true }); }} locked={st.locked} />
          )}
        </>
      )}

      <div className="fc-foot">
        <div className="row">
          <span>{displayCount}</span>
          {tokenCount > 0 && <span className="hist">~{tokenCount} tokens</span>}
          {st.history > 1 && (
            <span className="hist">
              <DiceIcon size={11} /> {st.history} versions <DownIcon size={10} />
            </span>
          )}
          {st.locked && <span style={{ color: 'var(--ink-3)' }}><LockIcon size={11} /> locked</span>}
          {st.dirty && <span style={{ color: 'var(--acc)' }}>· modified</span>}
        </div>
        <span style={{ color: 'var(--ink-3)' }}>{field.helper}</span>
      </div>
    </div>
  );
};

const CharacterStrip: React.FC<{
  characters: compose.Character[];
  activeId: number;
  onSelect: (id: number) => void;
  onAdd: () => void;
}> = ({ characters, activeId, onSelect, onAdd }) => (
  <div className="ss-char-strip scroll">
    <span className="uplabel">Characters · {characters.length}</span>
    {characters.map(c => (
      <button key={c.id} className="ss-char-tab"
        data-on={c.id === activeId ? '1' : '0'}
        onClick={() => onSelect(c.id)}>
        <span className="av">{c.name[0] || '?'}</span>
        <span className="nm">{c.name || 'Untitled'}</span>
        {c.epithet && <span className="ep">{c.epithet}</span>}
      </button>
    ))}
    <button className="ss-char-add" onClick={onAdd}>
      <PlusIcon size={11} /> Add character
    </button>
  </div>
);

interface EditorScreenProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
}

const EditorScreen: React.FC<EditorScreenProps> = ({ projectPath, onProjectPathChange }) => {
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [activeChar, setActiveChar] = useState<compose.Character | null>(null);
  const [crawl, setCrawl] = useState<crawler.CrawlResult | null>(null);
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [tokenCache, setTokenCache] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const flushActiveCharRef = useRef<() => Promise<compose.Character | null>>(
    () => Promise.resolve(null),
  );

  const warnedNoPathRef = useRef(false);

  const doSaveBundle = useCallback(async (path: string) => {
    try {
      await flushActiveCharRef.current();
      await SaveProjectBundle(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Auto-save failed:', msg);
    }
  }, []);

  const { handleChange: autoSaveChange, handleBlur: autoSaveBlur, autoSaveMode, autoSaveInterval } = useAutoSave({
    projectPath,
    onSave: doSaveBundle,
  });

  useEffect(() => {
    if (autoSaveMode === 'off' || projectPath || warnedNoPathRef.current) return;
    warnedNoPathRef.current = true;
    toast({ kind: 'warn', title: 'Auto-save ready', body: 'Save or open a project first to enable auto-save.' });
  }, [autoSaveMode, projectPath, toast]);

  const refreshCharacters = useCallback(async () => {
    const chars = await GetCharacters();
    setCharacters(chars);
    return chars;
  }, []);

  useEffect(() => {
    GetCharacters().then(async (chars) => {
      setCharacters(chars);
      if (chars.length > 0) {
        const ch = chars[0];
        setActiveChar(ch);
        await SetActiveCharacter(ch.id);
      }
    }).catch(e => logError('EditorScreen.loadCharacters', e));
    GetCachedCrawl().then(r => { if (r) setCrawl(r); }).catch(e => logError('EditorScreen.loadCachedCrawl', e));
  }, []);

  useEffect(() => {
    if (!activeChar) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(prev => {
      const next: Record<string, FieldState> = {};
      for (const f of FIELDS) {
        const isLocked = prev[f.id]?.locked ?? false;
        const charVal = fieldStateFromChar(activeChar, f);
        next[f.id] = {
          value: isLocked ? (prev[f.id]?.value ?? charVal.value) : charVal.value,
          locked: isLocked,
          dirty: isLocked ? (prev[f.id]?.dirty ?? false) : false,
          showPrompt: isLocked ? (prev[f.id]?.showPrompt ?? false) : false,
          prompt: isLocked ? (prev[f.id]?.prompt ?? '') : '',
          rolling: false,
          history: prev[f.id]?.history ?? 1,
        };
      }
      return next;
    });
  }, [activeChar]);

  const flushActiveCharacter = useCallback(async (): Promise<compose.Character | null> => {
    if (!activeChar) return null;
    const updated = charsFromFieldState(activeChar, fields);
    await UpdateCharacter(updated);
    await refreshCharacters();
    setActiveChar(updated);
    for (const f of FIELDS) {
      setFields(prev => ({ ...prev, [f.id]: { ...prev[f.id], dirty: false } }));
    }
    return updated;
  }, [activeChar, fields, refreshCharacters]);

  useEffect(() => {
    flushActiveCharRef.current = flushActiveCharacter;
  }, [flushActiveCharacter]);

  useEffect(() => {
    const updateTokens = async () => {
      const cache: Record<string, number> = {};
      for (const f of FIELDS) {
        const val = fields[f.id]?.value;
        const text = typeof val === 'string' ? val : Array.isArray(val) ? JSON.stringify(val) : '';
        if (text) {
          try {
            cache[f.id] = await CountTokens(text);
          } catch {
            cache[f.id] = Math.round(text.length / 4);
          }
        } else {
          cache[f.id] = 0;
        }
      }
      setTokenCache(cache);
    };
    if (Object.keys(fields).length > 0) updateTokens();
  }, [fields]);

  const totalTokens = useMemo(() =>
    Object.values(tokenCache).reduce((a, b) => a + b, 0),
    [tokenCache],
  );

  const activeId = activeChar?.id ?? 0;
  const dirtyCount = useMemo(() =>
    Object.values(fields).filter(f => f.dirty).length,
    [fields],
  );

  const lockedCount = useMemo(() =>
    Object.values(fields).filter(f => f.locked).length,
    [fields],
  );

  const loadActive = useCallback(async (id: number) => {
    const chars = await refreshCharacters();
    const ch = chars.find(c => c.id === id) ?? null;
    setActiveChar(ch);
    await SetActiveCharacter(id);
  }, [refreshCharacters]);

  const selectChar = useCallback((id: number) => {
    loadActive(id);
  }, [loadActive]);

  const handleAdd = useCallback(async () => {
    try {
      const ch = await AddCharacter();
      await refreshCharacters();
      setActiveChar(ch);
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Add failed', body: e?.message || 'Could not create character.' });
    }
  }, [toast, refreshCharacters]);

  const handleDelete = useCallback(async () => {
    if (!activeChar || characters.length <= 1) return;
    try {
      await DeleteCharacter(activeChar.id);
      const chars = await refreshCharacters();
      const next = chars.find(c => c.id !== activeChar.id) ?? chars[0] ?? null;
      if (next) loadActive(next.id);
      toast({ kind: 'ok', title: 'Character deleted', body: `Removed "${activeChar.name}".` });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Delete failed', body: e?.message || 'Could not delete character.' });
    }
  }, [activeChar, characters.length, loadActive, toast, refreshCharacters]);

  const handleSave = useCallback(async () => {
    if (!activeChar) return;
    try {
      const updated = await flushActiveCharacter();
      if (updated) {
        toast({ kind: 'ok', title: 'Saved', body: `"${updated.name}" · ${dirtyCount} fields written.` });
      }
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Save failed', body: e?.message || 'Could not save character.' });
    }
  }, [activeChar, dirtyCount, toast, flushActiveCharacter]);

  const handleSaveProject = useCallback(async () => {
    try {
      const filePath = await PickSaveBundle();
      if (!filePath) return;
      await flushActiveCharRef.current();
      await SaveProjectBundle(filePath);
      onProjectPathChange(filePath);
      toast({ kind: 'ok', title: 'Project saved', body: `Written to ${filePath}.` });
    } catch (e: any) {
      if (e?.message) {
        toast({ kind: 'bad', title: 'Save project failed', body: e.message });
      }
    }
  }, [toast, onProjectPathChange]);

  const setFieldValue = useCallback((id: string, value: any) => {
    setFields(prev => ({ ...prev, [id]: { ...prev[id], value } }));
    autoSaveChange();
  }, [autoSaveChange]);

  const patchField = useCallback((id: string, patch: Partial<FieldState>) => {
    setFields(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const handleCompose = useCallback(async () => {
    if (!activeChar) return;
    const locked = FIELDS.filter(f => fields[f.id]?.locked).map(f => f.id);

    for (const f of FIELDS) {
      if (!fields[f.id]?.locked) {
        patchField(f.id, { rolling: true });
      }
    }

    try {
      const ch = await GenerateCharacterBulk(locked);
      await refreshCharacters();
      setActiveChar(ch);

      for (const f of FIELDS) {
        if (fields[f.id]?.locked) {
          patchField(f.id, { rolling: false });
          continue;
        }
        const val = fieldStateFromChar(ch, FIELDS.find(x => x.id === f.id)!);
        setFields(prev => ({ ...prev, [f.id]: { ...prev[f.id], value: val.value, dirty: false, rolling: false, history: prev[f.id]?.history ? prev[f.id].history + 1 : 2 } }));
      }
      toast({ kind: 'ok', title: 'Composed', body: `"${ch.name}" generated from ${locked.length > 0 ? (FIELDS.length - locked.length) + ' of ' + FIELDS.length : 'all'} fields.` });
    } catch (e: any) {
      for (const f of FIELDS) {
        patchField(f.id, { rolling: false });
      }
      toast({ kind: 'bad', title: 'Compose failed', body: e?.message || 'Could not reach the LLM endpoint.' });
    }
  }, [activeChar, fields, patchField, toast, refreshCharacters]);

  const handleFieldReroll = useCallback(async (fieldID: string) => {
    const st = fields[fieldID];
    if (!st || !activeChar) return;
    const customPrompt = st.prompt || '';

    patchField(fieldID, { rolling: true });

    try {
      const ch = await GenerateField(fieldID, customPrompt);
      await refreshCharacters();
      setActiveChar(ch);
      const spec = FIELDS.find(x => x.id === fieldID);
      if (spec) {
        const val = fieldStateFromChar(ch, spec);
        patchField(fieldID, {
          value: val.value,
          rolling: false,
          dirty: false,
          history: (st.history || 1) + 1,
          showPrompt: false,
          prompt: '',
        });
      } else {
        patchField(fieldID, { rolling: false });
      }
      const label = spec?.label || fieldID;
      toast({ kind: 'ok', title: `${label} rerolled`, body: 'Field updated from LLM.' });
    } catch (e: any) {
      patchField(fieldID, { rolling: false });
      toast({ kind: 'bad', title: 'Reroll failed', body: e?.message || 'Could not reach the LLM endpoint.' });
    }
  }, [fields, activeChar, patchField, toast, refreshCharacters]);

  const isComposing = FIELDS.some(f => fields[f.id]?.rolling);

  if (!activeChar || Object.keys(fields).length === 0) {
    return (
      <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="serif-i" style={{ fontSize: 28, color: 'var(--ink-2)' }}>Loading character…</div>
      </div>
    );
  }

  return (
    <>
      <PageHead
        step={2}
        subtitle="Let the model format the lore"
        title={<>Compose <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>{activeChar.name.split(' ')[0] || 'character'}</em></>}
        actions={
          <>
            <button className="btn ghost"
              onClick={handleDelete}
              disabled={!activeChar || characters.length <= 1}
              style={{ color: 'var(--bad)' }}>
              <TrashIcon size={14} /> Delete
            </button>
            <button className="btn ghost" onClick={handleSave}>
              <SaveIcon size={14} /> Save
            </button>
            <button className="btn ghost" onClick={handleSaveProject}>
              <FolderIcon size={14} /> Save project
            </button>
            <button className="btn ghost" onClick={handleCompose} disabled={isComposing}>
              <DiceIcon size={14} /> Re-roll all{lockedCount > 0 && <span style={{ opacity: 0.6, marginLeft: 4 }}>({FIELDS.length - lockedCount})</span>}
            </button>
            <button className="btn primary" disabled title="Coming in a later phase">
              Continue to Lorebook <ArrowIcon size={14} />
            </button>
          </>
        } />
      <CharacterStrip
        characters={characters}
        activeId={activeId}
        onSelect={selectChar}
        onAdd={handleAdd}
      />
      <div className="ss-page-body scroll">
        <div className="editor-grid">
          <div className="editor-source">
            <div className="h">
              <b><em>{crawl?.title || '—'}</em> · source</b>
              <button className="btn ghost sm" disabled title="Coming in a later phase">
                <GlobeIcon size={12} /> Re-crawl
              </button>
            </div>
            <div className="b scroll">
              {crawl ? (
                <>
                  {crawl.sections && <SectionContent sections={crawl.sections} />}
                  {crawl.infobox && crawl.infobox.length > 0 && (
                    <dl className="infobox" style={{ marginTop: 16 }}>
                      {crawl.infobox.map((entry, i) => (
                        <React.Fragment key={i}>
                          {entry.section && (i === 0 || crawl.infobox[i - 1].section !== entry.section) && (
                            <div className="infobox-section">{entry.section}</div>
                          )}
                          <dt>{entry.key}</dt>
                          <dd>{entry.value}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </>
              ) : (
                <div className="col" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>No source crawled. Go to Crawl to fetch a wiki page first.</span>
                </div>
              )}
            </div>
            <div className="f">
              <span>{crawl ? `${crawl.wordCount.toLocaleString()} → ${totalTokens.toLocaleString()} tokens` : '—'}</span>
              <span><CheckIcon size={12} style={{ verticalAlign: -2, marginRight: 3 }} /> embedded</span>
            </div>
          </div>

          <div className="col" style={{ gap: 12 }}>
            {FIELDS.map(f => (
              <FieldCard key={f.id}
                field={f}
                idx={FIELDS.findIndex(x => x.id === f.id) + 1}
                st={fields[f.id]}
                tokenCount={tokenCache[f.id] ?? 0}
                onChange={v => setFieldValue(f.id, v)}
                onPatch={p => patchField(f.id, p)}
                onReroll={() => handleFieldReroll(f.id)}
                onBlur={autoSaveBlur}
              />
            ))}
            <div className="row" style={{ justifyContent: 'space-between', padding: '12px 4px', color: 'var(--ink-3)' }}>
              <span className="uplabel">{dirtyCount} fields modified · {totalTokens} tokens estimated</span>
              <span className="uplabel">
                {autoSaveMode !== 'off' && (
                  <span style={{ color: projectPath ? 'var(--acc)' : 'var(--ink-3)', marginRight: 12 }}>
                    Auto-save: {autoSaveMode === 'timed' ? `${autoSaveMode} (${(autoSaveInterval || 30) + 's'})` : autoSaveMode}
                    {!projectPath && ' — save project first'}
                  </span>
                )}
                <kbd>&#8984;</kbd> <kbd>S</kbd> save
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditorScreen;
