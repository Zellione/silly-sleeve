import React, { useState, useEffect, useRef } from 'react';
import {
  SaveIcon, PlusIcon, CheckIcon, XIcon,
  MoreIcon, TrashIcon, DownloadIcon, CopyIcon,
  LinkIcon, KeyIcon, EyeIcon,
} from '../icons';
import { useToast } from '../components/ToastProvider';
import { GetSettings, SaveSettings, TestLLMEndpoint, GetPromptTemplates, SavePromptTemplates } from '../../wailsjs/go/main/App';
import { settings, prompts } from '../../wailsjs/go/models';

/* ─── Section nav ───────────────────────────────────────── */

const SECTIONS = [
  { id: 'llm', label: 'LLM endpoints' },
  { id: 'comfy', label: 'ComfyUI' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'crawler', label: 'Wiki crawler' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'about', label: 'About' },
];

/* ─── Endpoint flyout ───────────────────────────────────── */

const EndpointFlyout: React.FC<{
  endpoint: settings.LLMEndpoint;
  isNew: boolean;
  onSave: (ep: settings.LLMEndpoint) => void;
  onClose: () => void;
  onDelete?: () => void;
}> = ({ endpoint, isNew, onSave, onClose, onDelete }) => {
  const [draft, setDraft] = useState<settings.LLMEndpoint>({ ...endpoint });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const { toast } = useToast();

  const set = (k: keyof settings.LLMEndpoint, v: any) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  const authOn = draft.key !== undefined && draft.key !== null;

  const toggleAuth = (on: boolean) => {
    set('key', on ? '' : undefined);
  };

  const runTest = async () => {
    setTesting('testing');
    try {
      const res = await TestLLMEndpoint(draft);
      if (res.ok) {
        setTesting('ok');
        toast({ kind: 'ok', title: `${draft.name} responded`, body: `${res.latency_ms} ms · ${draft.model || 'no model set'} reachable.` });
      } else {
        setTesting('fail');
        toast({ kind: 'bad', title: `Couldn't reach ${draft.name}`, body: res.error || 'Check the URL and API key.' });
      }
    } catch (e: any) {
      setTesting('fail');
      toast({ kind: 'bad', title: `Couldn't reach ${draft.name}`, body: e?.message || 'Unknown error' });
    }
  };

  return (
    <>
      <div className="ep-flyout-bg" onClick={onClose} />
      <aside className="ep-flyout" onClick={e => e.stopPropagation()}>
        <header className="ep-fly-head">
          <div style={{ minWidth: 0 }}>
            <div className="uplabel">{isNew ? 'New endpoint' : 'Edit endpoint'}</div>
            <input
              className="ep-fly-title"
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Endpoint name…"
            />
          </div>
          <button className="btn icon ghost" onClick={onClose} title="Close">
            <XIcon size={14} />
          </button>
        </header>

        <div className="ep-fly-body scroll">
          {/* URL */}
          <div className="ep-row">
            <label>
              Base URL
              <small>OpenAI-compatible endpoint — should end in <code>/v1</code>.</small>
            </label>
            <div className="ep-url">
              <span className="ic"><LinkIcon size={12} /></span>
              <input
                value={draft.url}
                onChange={e => set('url', e.target.value)}
                placeholder="https://api.example.com/v1"
                spellCheck={false}
              />
              <button
                className="ep-test-btn"
                data-state={testing}
                onClick={runTest}
                disabled={testing === 'testing'}
              >
                {testing === 'idle' && <>Test</>}
                {testing === 'testing' && <>Testing…</>}
                {testing === 'ok' && <><CheckIcon size={12} /> OK</>}
                {testing === 'fail' && <><XIcon size={12} /> Failed</>}
              </button>
            </div>
          </div>

          {/* Auth */}
          <div className="ep-row">
            <label>
              Authentication
              <small>Toggle on for hosted endpoints that require an API key.</small>
            </label>
            <div className="ep-auth-block">
              <div className="ep-toggle-row">
                <div>
                  <b>Use API key</b>
                  <small>Sent as <code>Authorization: Bearer …</code></small>
                </div>
                <button
                  className="ep-switch"
                  data-on={authOn ? '1' : '0'}
                  onClick={() => toggleAuth(!authOn)}
                  role="switch"
                  aria-checked={authOn}
                >
                  <i />
                </button>
              </div>
              {authOn && (
                <div className="ep-key-input">
                  <KeyIcon size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft.key || ''}
                    onChange={e => set('key', e.target.value)}
                    placeholder="sk-… or msk-… or your provider's token"
                    spellCheck={false}
                  />
                  <button
                    className="ep-eye"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? 'Hide key' : 'Reveal key'}
                  >
                    {showKey ? <XIcon size={12} /> : <EyeIcon size={12} />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Model */}
          <div className="ep-row">
            <label>
              Model
              <small>Identifier passed in the <code>model</code> param.</small>
            </label>
            <input
              className="ep-input"
              value={draft.model}
              onChange={e => set('model', e.target.value)}
              placeholder="e.g. mistral-large-latest"
              style={{ fontFamily: 'var(--f-mono)' }}
            />
          </div>

          <div className="ep-divline" />

          {/* Context size */}
          <div className="ep-row">
            <label>
              Context size
              <small>Max tokens the model can hold in one call.</small>
            </label>
            <div className="ep-slider-row">
              <input
                type="range"
                min={2048}
                max={262144}
                step={1024}
                value={Math.min(262144, draft.contextSize)}
                onChange={e => set('contextSize', +e.target.value)}
                style={{ accentColor: 'var(--acc)' }}
              />
              <input
                className="ep-num"
                type="number"
                min={512}
                max={2000000}
                step={1024}
                value={draft.contextSize}
                onChange={e => set('contextSize', +e.target.value)}
              />
              <span className="ep-unit">tok</span>
            </div>
            <div className="ep-presets">
              {[4096, 8192, 16384, 32768, 128000, 200000].map(n => (
                <button
                  key={n}
                  className="ep-preset"
                  data-on={draft.contextSize === n ? '1' : '0'}
                  onClick={() => set('contextSize', n)}
                >
                  {n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="ep-row">
            <label>
              Temperature
              <small>0 deterministic · 2 wild · 0.7–0.9 is the sweet spot for character writing.</small>
            </label>
            <div className="ep-slider-row">
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={draft.temperature}
                onChange={e => set('temperature', +e.target.value)}
                style={{ accentColor: 'var(--acc)' }}
              />
              <input
                className="ep-num"
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={draft.temperature}
                onChange={e => set('temperature', +e.target.value)}
              />
            </div>
          </div>

          {/* System prompt */}
          <div className="ep-row">
            <label>
              System prompt
              <small>Prepended to every call against this endpoint.</small>
            </label>
            <textarea
              className="ep-textarea"
              value={draft.systemPrompt}
              onChange={e => set('systemPrompt', e.target.value)}
              placeholder="You are an expert at…"
            />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <span className="helpr">
                {draft.systemPrompt.length} chars · ~{Math.round(draft.systemPrompt.length / 4)} tokens
              </span>
              <button className="btn ghost sm" onClick={() => set('systemPrompt', '')}>
                Clear
              </button>
            </div>
          </div>
        </div>

        <footer className="ep-fly-foot">
          {onDelete && (
            <button className="btn ghost" onClick={onDelete} style={{ color: 'var(--bad)' }}>
              <TrashIcon size={13} /> Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onSave(draft)}>
            <CheckIcon size={13} /> {isNew ? 'Create' : 'Save'}
          </button>
        </footer>
      </aside>
    </>
  );
};

/* ─── Prompt template editor ────────────────────────────── */

const FIELD_IDS = ['name', 'epithet', 'tags', 'appearance', 'personality', 'backstory', 'abilities', 'relationships', 'quotes', 'stats'];
const FIELD_LABELS: Record<string, string> = {
  name: 'Name', epithet: 'Title / epithet', tags: 'Tags', appearance: 'Appearance',
  personality: 'Personality', backstory: 'Backstory', abilities: 'Abilities & skills',
  relationships: 'Relationships', quotes: 'Example quotes', stats: 'Stat block',
};
const VARIABLES = ['crawl_context', 'crawl.title', 'crawl.url', 'character.name', 'custom'];
const VARIABLE_LABELS: Record<string, string> = {
  'crawl_context': 'Full crawl text',
  'crawl.title': 'Wiki page title',
  'crawl.url': 'Wiki page URL',
  'character.name': 'Character name',
  'custom': 'Custom instruction',
};

const PromptTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<prompts.TemplateSet | null>(null);
  const [activeField, setActiveField] = useState<string>('bulk');
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    GetPromptTemplates().then(t => {
      setTemplates(t);
      setDraft(t.systemPrompt);
    }).catch(() => {
      toast({ kind: 'bad', title: 'Load failed', body: 'Could not load prompt templates.' });
    });
  }, [toast]);

  const handleFieldSelect = (fieldId: string) => {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
    setActiveField(fieldId);
    if (!templates) return;
    if (fieldId === 'bulk') {
      setDraft(templates.systemPrompt);
    } else {
      setDraft(templates.fieldPrompts?.[fieldId] || '');
    }
    setDirty(false);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!templates) return;
    const next = prompts.TemplateSet.createFrom({
      systemPrompt: templates.systemPrompt,
      fieldPrompts: { ...templates.fieldPrompts },
    });
    if (activeField === 'bulk') {
      next.systemPrompt = draft;
    } else {
      next.fieldPrompts[activeField] = draft;
    }
    try {
      await SavePromptTemplates(next);
      setTemplates(next);
      setDirty(false);
      toast({ kind: 'ok', title: 'Templates saved', body: activeField === 'bulk' ? 'Bulk system prompt updated.' : `${FIELD_LABELS[activeField] || activeField} template updated.` });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Save failed', body: e?.message || 'Could not save prompt templates.' });
    }
  };

  const handleResetField = () => {
    if (!confirm('Reset to default? This cannot be undone.')) return;
    GetPromptTemplates().then(t => {
      if (activeField === 'bulk') {
        setDraft(t.systemPrompt);
      } else {
        setDraft(t.fieldPrompts?.[activeField] || '');
      }
      setDirty(true);
    }).catch(() => {
      toast({ kind: 'bad', title: 'Reset failed', body: 'Could not load defaults.' });
    });
  };

  const insertVariable = (v: string) => {
    setDraft(prev => prev + `{{${v}}}`);
    setDirty(true);
  };

  if (!templates) {
    return (
      <div className="settings-section">
        <h3>Prompt templates</h3>
        <div className="shimmer" style={{ width: 200, height: 16 }} />
      </div>
    );
  }

  const tokenEst = Math.round(draft.length / 4);
  const activeLabel = activeField === 'bulk' ? 'Bulk generation (system prompt)' : (FIELD_LABELS[activeField] || activeField);

  return (
    <div className="settings-section">
      <h3>Prompt templates</h3>
      <p className="desc">
        Customise the prompts sent to the LLM for bulk generation and per-field rerolls. Use variable chips to inject crawl context, character data, or custom instructions.
      </p>

      <div className="prompt-templates-editor">
        <nav className="prompt-field-nav">
          <button
            data-on={activeField === 'bulk' ? '1' : '0'}
            onClick={() => handleFieldSelect('bulk')}
          >
            Bulk system
          </button>
          {FIELD_IDS.map(id => (
            <button
              key={id}
              data-on={activeField === id ? '1' : '0'}
              onClick={() => handleFieldSelect(id)}
            >
              {FIELD_LABELS[id] || id}
            </button>
          ))}
        </nav>

        <div className="prompt-editor-body">
          <div className="prompt-editor-header">
            <span className="uplabel">{activeLabel}</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost sm" onClick={handleResetField}>
                Reset to default
              </button>
              <button className="btn primary sm" disabled={!dirty} onClick={handleSave}>
                {dirty ? <><CheckIcon size={12} /> Save</> : 'Saved'}
              </button>
            </div>
          </div>

          <textarea
            className="prompt-textarea"
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            placeholder="Write your prompt template…"
            spellCheck={false}
          />

          <div className="prompt-variables">
            <span className="uplabel">Insert variable:</span>
            <div className="var-chips">
              {VARIABLES.map(v => (
                <button key={v} className="var-chip" onClick={() => insertVariable(v)} title={VARIABLE_LABELS[v] || v}>
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="prompt-footer">
            <span>{draft.length} chars · ~{tokenEst} tokens</span>
            {dirty && <span className="hint" style={{ color: 'var(--acc)' }}>Unsaved changes</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Settings screen ───────────────────────────────────── */

const SettingsScreen: React.FC = () => {
  const [sect, setSect] = useState('llm');
  const [settingsState, setSettingsState] = useState<settings.Settings | null>(null);
  const [editing, setEditing] = useState<settings.LLMEndpoint | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [testingMap, setTestingMap] = useState<Record<number, boolean>>({});
  const [moreOpen, setMoreOpen] = useState<number | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    GetSettings().then(s => setSettingsState(s)).catch(() => setSettingsState(settings.Settings.createFrom({ endpoints: [] })));
  }, []);

  useEffect(() => {
    if (moreOpen == null) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const persist = async (next: settings.Settings) => {
    try {
      await SaveSettings(next);
      setSettingsState(next);
      toast({ kind: 'ok', title: 'Settings saved', body: 'Endpoints updated.' });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Save failed', body: e?.message || 'Could not write settings.' });
    }
  };

  const testEndpoint = async (e: settings.LLMEndpoint) => {
    if (testingMap[e.id]) return;
    setTestingMap(prev => ({ ...prev, [e.id]: true }));
    try {
      const res = await TestLLMEndpoint(e);
      const next = settings.Settings.createFrom({
        ...settingsState!,
        endpoints: settingsState!.endpoints.map(x =>
          x.id === e.id ? { ...x, ok: res.ok } : x
        ),
      });
      setSettingsState(next);
      if (res.ok) {
        toast({ kind: 'ok', title: `${e.name} responded`, body: `${res.latency_ms} ms · ${e.model} reachable.` });
      } else {
        toast({ kind: 'bad', title: `${e.name} test failed`, body: res.error || 'Unknown error.' });
      }
    } catch (err: any) {
      toast({ kind: 'bad', title: `${e.name} test failed`, body: err?.message || 'Unknown error.' });
    } finally {
      setTestingMap(prev => { const n = { ...prev }; delete n[e.id]; return n; });
    }
  };

  const saveEndpoint = (updated: settings.LLMEndpoint) => {
    if (!settingsState) return;
    const next = isNew
      ? settings.Settings.createFrom({ ...settingsState, endpoints: [...settingsState.endpoints, updated] })
      : settings.Settings.createFrom({ ...settingsState, endpoints: settingsState.endpoints.map(e => e.id === updated.id ? updated : e) });
    persist(next);
    setEditing(null);
  };

  const deleteEndpoint = (id: number) => {
    if (!settingsState) return;
    const removed = settingsState.endpoints.find(e => e.id === id);
    let next = settings.Settings.createFrom({ ...settingsState, endpoints: settingsState.endpoints.filter(e => e.id !== id) });
    if (removed?.isDefault && next.endpoints.length) {
      next = settings.Settings.createFrom({ ...next, endpoints: next.endpoints.map((e, i) => i === 0 ? { ...e, isDefault: true } : e) });
    }
    persist(next);
    setEditing(null);
  };

  const setDefault = (id: number) => {
    if (!settingsState) return;
    const next = settings.Settings.createFrom({
      ...settingsState,
      endpoints: settingsState.endpoints.map(e => ({ ...e, isDefault: e.id === id })),
    });
    persist(next);
    setMoreOpen(null);
  };

  const duplicateEndpoint = (e: settings.LLMEndpoint) => {
    if (!settingsState) return;
    const newId = Math.max(...settingsState.endpoints.map(x => x.id), 0) + 1;
    const copy = { ...e, id: newId, name: e.name + ' (copy)', isDefault: false, ok: false };
    const next = settings.Settings.createFrom({ ...settingsState, endpoints: [...settingsState.endpoints, copy] });
    persist(next);
    setMoreOpen(null);
  };

  const addNew = () => {
    const newId = settingsState ? Math.max(...settingsState.endpoints.map(e => e.id), 0) + 1 : 1;
    setEditing({
      id: newId,
      name: 'New endpoint',
      url: 'https://',
      model: '',
      key: undefined,
      isDefault: settingsState ? settingsState.endpoints.length === 0 : true,
      contextSize: 8192,
      temperature: 0.8,
      systemPrompt: 'You are formatting wiki content into a SillyTavern character card. Output only the requested field.',
      ok: false,
    });
    setIsNew(true);
  };

  if (!settingsState) {
    return (
      <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="col" style={{ alignItems: 'center', gap: 16 }}>
          <div className="shimmer" style={{ width: 120, height: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="ss-page-head">
        <div>
          <h1>Settings</h1>
        </div>
        <div className="ss-actions">
          <button
            className="btn ghost"
            onClick={() =>
              persist(settingsState).then(() =>
                toast({ kind: 'ok', title: 'Settings saved', body: 'Endpoints, prompts and defaults written to config directory.' })
              )
            }
          >
            <SaveIcon size={14} /> Save changes
          </button>
        </div>
      </header>

      <div className="ss-page-body scroll">
        <div className="settings-grid">
          <nav className="settings-nav">
            {SECTIONS.map(s => (
              <button key={s.id} data-on={sect === s.id ? '1' : '0'} onClick={() => setSect(s.id)}>
                <span>{s.label}</span>
                {s.id === 'llm' && settingsState.endpoints.some(e => e.ok) && <span className="dot ok" />}
                {s.id === 'llm' && !settingsState.endpoints.some(e => e.ok) && <span className="dot idle" />}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {sect === 'llm' && (
              <div className="settings-section">
                <h3>LLM endpoints</h3>
                <p className="desc">
                  Any OpenAI-compatible <code style={{ fontFamily: 'var(--f-mono)', background: 'var(--panel)', padding: '2px 5px', borderRadius: 3 }}>/v1/chat/completions</code> endpoint works — local (koboldcpp, ollama, vLLM, llama-server) or hosted. The default endpoint is used for all rerolls unless you override it per-field.
                </p>
                <div className="settings-form">
                  {settingsState.endpoints.map(e => (
                    <div key={e.id} className="endpoint-card">
                      <div className="h">
                        <span className="ic">{e.name[0]}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span>{e.name}</span>
                          <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
                            {e.model}
                          </span>
                        </div>
                        <span className="grow" />
                        {e.isDefault && (
                          <span className="pill" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)', background: 'var(--acc-soft)' }}>
                            default
                          </span>
                        )}
                        <span className={`pill ${e.ok ? 'ok' : 'idle'}`}>{e.ok ? '✓ connected' : '… untested'}</span>
                        <div className="ep-more-wrap" ref={moreOpen === e.id ? moreRef : null}>
                          <button
                            className="btn icon ghost"
                            style={{ width: 28, height: 28 }}
                            data-on={moreOpen === e.id ? '1' : '0'}
                            onClick={ev => {
                              ev.stopPropagation();
                              setMoreOpen(moreOpen === e.id ? null : e.id);
                            }}
                          >
                            <MoreIcon size={14} />
                          </button>
                          {moreOpen === e.id && (
                            <div className="ep-more-menu" onClick={ev => ev.stopPropagation()}>
                              <button className="ep-more-item" disabled={e.isDefault} onClick={() => setDefault(e.id)}>
                                <CheckIcon size={13} /> Set as default
                                {e.isDefault && <span className="hint">current</span>}
                              </button>
                              <button className="ep-more-item" onClick={() => duplicateEndpoint(e)}>
                                <CopyIcon size={13} /> Duplicate
                              </button>
                              <button
                                className="ep-more-item"
                                onClick={() => {
                                  setMoreOpen(null);
                                  toast({ kind: 'ok', title: 'Config copied to clipboard', body: 'Paste into a .json file or another machine.' });
                                }}
                              >
                                <DownloadIcon size={13} /> Export config
                              </button>
                              <div className="ep-more-sep" />
                              <button
                                className="ep-more-item danger"
                                onClick={() => {
                                  deleteEndpoint(e.id);
                                  setMoreOpen(null);
                                }}
                              >
                                <TrashIcon size={13} /> Delete endpoint
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="url">{e.url}</div>
                      <div className="row foot">
                        <span>{e.key ? `auth · ${e.key.slice(0, 6)}${'•'.repeat(8)}` : 'no auth'}</span>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn ghost sm" disabled={testingMap[e.id]} onClick={() => testEndpoint(e)}>
                            {testingMap[e.id] ? (
                              <>
                                <span className="dot warn" style={{ boxShadow: 'none', width: 6, height: 6 }} /> Testing…
                              </>
                            ) : (
                              'Test'
                            )}
                          </button>
                          <button
                            className="btn ghost sm"
                            onClick={() => {
                              setIsNew(false);
                              setEditing(e);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={addNew}>
                    <PlusIcon size={14} /> Add endpoint
                  </button>
                </div>

                <h3 style={{ marginTop: 24 }}>Generation defaults</h3>
                <div className="settings-form">
                  <div className="form-row">
                    <label>
                      Temperature <small>0 deterministic — 2 wild</small>
                    </label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input type="range" min={0} max={2} step={0.05} defaultValue={0.85} style={{ flex: 1, accentColor: 'var(--acc)' }} />
                      <input className="field" type="text" defaultValue="0.85" style={{ width: 70, textAlign: 'right', fontFamily: 'var(--f-mono)' }} />
                    </div>
                  </div>
                  <div className="form-row">
                    <label>
                      Max tokens <small>per field re-roll</small>
                    </label>
                    <input className="field" type="number" defaultValue={320} style={{ width: 120, fontFamily: 'var(--f-mono)' }} />
                  </div>
                  <div className="form-row">
                    <label>
                      System prompt template <small>injected at the top of every formatting call</small>
                    </label>
                    <textarea
                      className="field"
                      defaultValue={`You are formatting wiki content into a SillyTavern character card. Stay in third person present tense. Avoid plot spoilers post-act 1 unless tagged. Output only the requested field — no preamble.`}
                      style={{ minHeight: 110, fontFamily: 'var(--f-mono)', fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {sect === 'prompts' && (
              <PromptTemplateEditor />
            )}

            {(sect !== 'llm' && sect !== 'prompts') && (
              <div className="settings-section">
                <h3>{SECTIONS.find(s => s.id === sect)?.label}</h3>
                <p className="desc">Coming in a later phase.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EndpointFlyout
          endpoint={editing}
          isNew={isNew}
          onSave={saveEndpoint}
          onClose={() => setEditing(null)}
          onDelete={isNew ? undefined : () => deleteEndpoint(editing.id)}
        />
      )}
    </>
  );
};

export default SettingsScreen;
