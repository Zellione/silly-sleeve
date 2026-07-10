import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import { useAutoSave } from '../components/useAutoSave';
import {
  LockIcon, CopyIcon, RerollIcon, SparksIcon,
  SaveIcon, ArrowIcon, PlusIcon, XIcon, DownIcon,
  CheckIcon, TrashIcon, DiceIcon, GlobeIcon, FolderIcon,
} from '../icons';
import {
  GetCharacters, GetActiveCharacter, AddCharacter, UpdateCharacter, DeleteCharacter,
  SetActiveCharacter, GetCrawlForCharacter,
  GenerateField, GenerateCharacterBulk,
  PickSaveBundle, SaveProjectBundle,
  GetSettings, GetProjectFieldEndpoints, SetProjectFieldEndpoint, ImportCard,
} from '../../wailsjs/go/app/App';
import { SectionContent } from '../components/SectionContent';
import { TagsInput } from '../components/TagsInput';
import { FieldEndpointChip } from '../components/FieldEndpointChip';
import { CharacterStrip } from '../components/CharacterStrip';
import { logError } from '../utils/log';
import {
  FIELDS, type FieldSpec, type FieldState, type FieldValue,
  wordCountLabel, useFieldEditor,
} from '../components/useFieldEditor';
import { compose, crawler, settings } from '../../wailsjs/go/models';

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

const FieldInput: React.FC<{
  field: FieldSpec;
  st: FieldState;
  onChange: (v: FieldValue) => void;
  onPatch: (p: Partial<FieldState>) => void;
  onBlur: () => void;
}> = ({ field, st, onChange, onPatch, onBlur }) => {
  if (field.type === 'line') {
    return (
      <input className="field" value={st.value as string} disabled={st.locked}
        onChange={e => { onChange(e.target.value); onPatch({ dirty: true }); }}
        onBlur={onBlur} />
    );
  }

  if (field.type === 'text') {
    return (
      <textarea className="field" value={st.value as string} disabled={st.locked}
        onChange={e => { onChange(e.target.value); onPatch({ dirty: true }); }}
        onBlur={onBlur}
        style={{ minHeight: field.id === 'backstory' || field.id === 'appearance' ? 140 : 100 }} />
    );
  }

  if (field.type === 'tags') {
    return (
      <TagsInput
        value={st.value as string[]}
        onChange={v => { onChange(v); onPatch({ dirty: true }); }}
        disabled={st.locked}
        placeholder="Add tag and press Enter…"
        normalize={s => s.toLowerCase()}
        accentCount={2}
      />
    );
  }

  if (field.type === 'quotes' || field.type === 'greetings') {
    const isGreeting = field.type === 'greetings';
    return (
      <div className="col" style={{ gap: 6 }}>
        {(st.value as string[]).map((q, i) => (
          <div key={i} className="quote-row">
            <textarea
              rows={Math.max(2, Math.ceil(q.length / 60))}
              value={q}
              disabled={st.locked}
              onChange={e => {
                const next = (st.value as string[]).map((x, j) => j === i ? e.target.value : x);
                onChange(next);
                onPatch({ dirty: true });
              }}
            />
            {!st.locked && (
              <button type="button" className="x" aria-label={isGreeting ? 'Remove greeting' : 'Remove quote'} onClick={() => onChange((st.value as string[]).filter((_, j) => j !== i))}>
                <XIcon size={12} />
              </button>
            )}
          </div>
        ))}
        {!st.locked && (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => onChange([...(st.value as string[]), ''])}>
            <PlusIcon size={11} /> {isGreeting ? 'Add greeting' : 'Add quote'}
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'stats') {
    return <StatsField value={st.value as compose.StatKV[]} onChange={v => { onChange(v); onPatch({ dirty: true }); }} locked={st.locked} />;
  }

  return null;
};

const FieldCard: React.FC<{
  field: FieldSpec;
  idx: number;
  st: FieldState;
  tokenCount: number;
  onChange: (v: FieldValue) => void;
  onPatch: (p: Partial<FieldState>) => void;
  onReroll: () => void;
  onBlur: () => void;
  endpoints: settings.LLMEndpoint[];
  globalMap: Record<string, number>;
  projectMap: Record<string, number>;
  onSelectEndpoint: (slot: string, id: number) => void;
}> = ({ field, idx, st, tokenCount, onChange, onPatch, onReroll, onBlur, endpoints, globalMap, projectMap, onSelectEndpoint }) => {
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
        <FieldEndpointChip
          slot={field.id}
          label={field.label}
          endpoints={endpoints}
          globalMap={globalMap}
          projectMap={projectMap}
          onSelect={onSelectEndpoint}
        />
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
        <FieldInput field={field} st={st} onChange={onChange} onPatch={onPatch} onBlur={onBlur} />
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

interface EditorScreenProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
}

const EditorScreen: React.FC<EditorScreenProps> = ({ projectPath, onProjectPathChange }) => {
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [activeChar, setActiveChar] = useState<compose.Character | null>(null);
  const [crawl, setCrawl] = useState<crawler.CrawlResult | null>(null);
  const [endpoints, setEndpoints] = useState<settings.LLMEndpoint[]>([]);
  const [globalMap, setGlobalMap] = useState<Record<string, number>>({});
  const [projectMap, setProjectMap] = useState<Record<string, number>>({});
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

  const {
    fields, tokenCache, totalTokens, dirtyCount, lockedCount, isComposing, ready,
    setFieldValue, patchField, patchAll, applyGenerated, markAllSaved, buildCharacter, lockedIds,
  } = useFieldEditor(activeChar, { onValueChange: autoSaveChange });

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
    Promise.all([GetCharacters(), GetActiveCharacter()]).then(async ([chars, active]) => {
      setCharacters(chars);
      if (chars.length > 0) {
        // Honor the backend's active character (e.g. the page just sent from the
        // Crawler), falling back to the first when none is set.
        const ch = chars.find(c => c.id === active.id) ?? chars[0];
        setActiveChar(ch);
        await SetActiveCharacter(ch.id);
      }
    }).catch(e => logError('EditorScreen.loadCharacters', e));
  }, []);

  // Load the source page the active character was sent from, refreshing whenever
  // the active character changes so the source panel never shows a stale page.
  useEffect(() => {
    const id = activeChar?.id;
    if (!id) return;
    GetCrawlForCharacter(id)
      .then(r => setCrawl(r ?? null))
      .catch(e => logError('EditorScreen.loadCrawlForCharacter', e));
  }, [activeChar?.id]);

  useEffect(() => {
    GetSettings().then(s => {
      setEndpoints(s.endpoints || []);
      setGlobalMap(s.fieldEndpoints || {});
    }).catch(() => {});
    GetProjectFieldEndpoints().then(setProjectMap).catch(() => {});
  }, []);

  const flushActiveCharacter = useCallback(async (): Promise<compose.Character | null> => {
    if (!activeChar) return null;
    const updated = buildCharacter(activeChar);
    await UpdateCharacter(updated);
    await refreshCharacters();
    setActiveChar(updated);
    markAllSaved();
    return updated;
  }, [activeChar, buildCharacter, markAllSaved, refreshCharacters]);

  useEffect(() => {
    flushActiveCharRef.current = flushActiveCharacter;
  }, [flushActiveCharacter]);

  const activeId = activeChar?.id ?? 0;

  // Mirror the active character id into a ref so async generation handlers can
  // detect a mid-flight character switch and avoid applying a result to (or
  // hijacking the view of) the character the user navigated to.
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

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

  const handleImport = useCallback(async () => {
    try {
      const res = await ImportCard();
      if (!res) return; // cancelled
      await refreshCharacters();
      setActiveChar(res.character);
      const extra = res.importedEntries > 0 ? ` (+${res.importedEntries} lore entries)` : '';
      toast({ kind: 'ok', title: 'Card imported', body: `Imported "${res.character.name}"${extra}.` });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Import failed', body: e?.message || 'Could not import card.' });
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

  const handleCompose = useCallback(async () => {
    if (!activeChar) return;
    const targetId = activeChar.id;
    const locked = lockedIds();
    patchAll({ rolling: true }, st => !st.locked);

    try {
      const ch = await GenerateCharacterBulk(locked);
      await refreshCharacters();
      // The user switched characters mid-compose: the backend already wrote the
      // result to the original character, so don't apply it to the current view.
      if (activeIdRef.current !== targetId) return;
      setActiveChar(ch);

      for (const f of FIELDS) {
        if (fields[f.id]?.locked) {
          patchField(f.id, { rolling: false });
        } else {
          applyGenerated(f.id, ch);
        }
      }
      toast({ kind: 'ok', title: 'Composed', body: `"${ch.name}" generated from ${locked.length > 0 ? (FIELDS.length - locked.length) + ' of ' + FIELDS.length : 'all'} fields.` });
    } catch (e: any) {
      if (activeIdRef.current === targetId) patchAll({ rolling: false });
      toast({ kind: 'bad', title: 'Compose failed', body: e?.message || 'Could not reach the LLM endpoint.' });
    }
  }, [activeChar, fields, lockedIds, patchAll, patchField, applyGenerated, toast, refreshCharacters]);

  const handleFieldReroll = useCallback(async (fieldID: string) => {
    const st = fields[fieldID];
    if (!st || !activeChar) return;
    const targetId = activeChar.id;
    const customPrompt = st.prompt || '';

    patchField(fieldID, { rolling: true });

    try {
      const ch = await GenerateField(fieldID, customPrompt);
      await refreshCharacters();
      // The user switched characters mid-reroll: the backend already wrote the
      // result to the original character, so don't apply it to the current view.
      if (activeIdRef.current !== targetId) return;
      setActiveChar(ch);
      const spec = FIELDS.find(x => x.id === fieldID);
      if (spec) {
        applyGenerated(fieldID, ch, { showPrompt: false, prompt: '' });
      } else {
        patchField(fieldID, { rolling: false });
      }
      const label = spec?.label || fieldID;
      toast({ kind: 'ok', title: `${label} rerolled`, body: 'Field updated from LLM.' });
    } catch (e: any) {
      if (activeIdRef.current === targetId) patchField(fieldID, { rolling: false });
      toast({ kind: 'bad', title: 'Reroll failed', body: e?.message || 'Could not reach the LLM endpoint.' });
    }
  }, [fields, activeChar, patchField, applyGenerated, toast, refreshCharacters]);

  const selectFieldEndpoint = useCallback((slot: string, id: number) => {
    SetProjectFieldEndpoint(slot, id);
    setProjectMap(prev => {
      const next = { ...prev };
      if (id <= 0) delete next[slot]; else next[slot] = id;
      return next;
    });
  }, []);

  if (!activeChar || !ready) {
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
        title={<>Compose <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>{activeChar.name.trim() || 'character'}</em></>}
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
        onImport={handleImport}
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
                endpoints={endpoints}
                globalMap={globalMap}
                projectMap={projectMap}
                onSelectEndpoint={selectFieldEndpoint}
              />
            ))}
            <FieldEndpointChip
              slot="bulk"
              label="Bulk generation"
              endpoints={endpoints}
              globalMap={globalMap}
              projectMap={projectMap}
              onSelect={selectFieldEndpoint}
            />
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
