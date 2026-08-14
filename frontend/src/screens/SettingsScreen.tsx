import React, { useState, useEffect, useRef } from 'react';
import {
  SaveIcon, PlusIcon,
} from '../icons';
import { useToast } from '../components/ToastProvider';
import { LLMEndpointCard } from '../components/LLMEndpointCard';
import { GenerationDefaultsForm } from '../components/GenerationDefaultsForm';
import { PerFieldDefaults } from '../components/PerFieldDefaults';
import { Dropdown } from '../components/Dropdown';
import { FontScaleControl } from '../components/FontScaleControl';
import { AccentControl } from '../components/AccentControl';
import { SidebarStyleControl } from '../components/SidebarStyleControl';
import { StepBadgesControl } from '../components/StepBadgesControl';
import { EndpointFlyout } from '../components/settings/EndpointFlyout';
import { ComfyUISettings } from '../components/settings/ComfyUISettings';
import { CrawlerSettings } from '../components/settings/CrawlerSettings';
import { PromptTemplateEditor } from '../components/settings/PromptTemplateEditor';
import { GetSettings, SaveSettings, TestLLMEndpoint } from '../../wailsjs/go/app/App';
import { settings } from '../../wailsjs/go/models';

/* ─── Section nav ───────────────────────────────────────── */

const SECTIONS = [
  { id: 'llm', label: 'LLM endpoints' },
  { id: 'comfy', label: 'ComfyUI' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'auto-save', label: 'Auto-save' },
  { id: 'crawler', label: 'Wiki crawler' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'about', label: 'About' },
];

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
    const newId = nextEndpointId(settingsState.endpoints);
    const copy = { ...e, id: newId, name: e.name + ' (copy)', isDefault: false, ok: false };
    const next = settings.Settings.createFrom({ ...settingsState, endpoints: [...settingsState.endpoints, copy] });
    persist(next);
    setMoreOpen(null);
  };

  const setFieldDefaults = (map: Record<string, number>) => {
    if (!settingsState) return;
    persist(settings.Settings.createFrom({ ...settingsState, fieldEndpoints: map }));
  };

  const nextEndpointId = (eps: settings.LLMEndpoint[]) =>
    eps.reduce((max, e) => Math.max(max, e.id), 0) + 1;

  const addNew = () => {
    const newId = nextEndpointId(settingsState?.endpoints ?? []);
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

  const handleAutoSaveMode = (mode: string) => {
    if (!settingsState) return;
    const next = settings.Settings.createFrom({
      ...settingsState,
      autoSaveMode: mode,
      autoSaveInterval: settingsState.autoSaveInterval || 30,
    });
    SaveSettings(next).then(() => {
      setSettingsState(next);
      toast({ kind: 'ok', title: 'Auto-save updated', body: `Mode set to "${mode}".` });
    }).catch((e: any) => {
      toast({ kind: 'bad', title: 'Save failed', body: e?.message || 'Could not update auto-save.' });
    });
  };

  const handleAutoSaveInterval = (interval: number) => {
    if (!settingsState) return;
    const next = settings.Settings.createFrom({
      ...settingsState,
      autoSaveMode: 'timed',
      autoSaveInterval: interval,
    });
    SaveSettings(next).then(() => {
      setSettingsState(next);
      toast({ kind: 'ok', title: 'Auto-save updated', body: `Interval set to ${interval}s.` });
    }).catch((e: any) => {
      toast({ kind: 'bad', title: 'Save failed', body: e?.message || 'Could not update auto-save.' });
    });
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
            type="button"
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
        <div className={`settings-grid${sect === 'prompts' ? ' fill' : ''}`}>
          <nav className="settings-nav">
            {SECTIONS.map(s => (
              <button type="button" key={s.id} data-on={sect === s.id ? '1' : '0'} onClick={() => setSect(s.id)}>
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
                    <LLMEndpointCard
                      key={e.id}
                      endpoint={e}
                      testing={!!testingMap[e.id]}
                      menuOpen={moreOpen === e.id}
                      menuRef={moreOpen === e.id ? moreRef : null}
                      onToggleMenu={() => setMoreOpen(moreOpen === e.id ? null : e.id)}
                      onSetDefault={() => setDefault(e.id)}
                      onDuplicate={() => duplicateEndpoint(e)}
                      onExportConfig={() => {
                        setMoreOpen(null);
                        toast({ kind: 'ok', title: 'Config copied to clipboard', body: 'Paste into a .json file or another machine.' });
                      }}
                      onDelete={() => {
                        deleteEndpoint(e.id);
                        setMoreOpen(null);
                      }}
                      onTest={() => testEndpoint(e)}
                      onEdit={() => {
                        setIsNew(false);
                        setEditing(e);
                      }}
                    />
                  ))}
                  <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={addNew}>
                    <PlusIcon size={14} /> Add endpoint
                  </button>
                </div>

                {settingsState && settingsState.endpoints.length > 0 && (
                  <div className="settings-block" style={{ marginTop: 18 }}>
                    <h3>Per-field defaults</h3>
                    <p className="desc">
                      The default endpoint is used for every slot unless you pick another here.
                      Projects can override these per field in the editor.
                    </p>
                    <PerFieldDefaults
                      endpoints={settingsState.endpoints}
                      value={settingsState.fieldEndpoints || {}}
                      onChange={setFieldDefaults}
                    />
                  </div>
                )}

                <GenerationDefaultsForm />
              </div>
            )}

            {sect === 'comfy' && (
              <ComfyUISettings settingsState={settingsState} persist={persist} />
            )}

            {sect === 'prompts' && (
              <PromptTemplateEditor />
            )}

            {sect === 'auto-save' && (
              <div className="settings-section">
                <h3>Auto-save</h3>
                <p className="desc">
                  Automatically save your project bundle as you work. Only active after your first manual &ldquo;Save project&rdquo;.
                </p>
                <div className="settings-form">
                  <div className="form-row">
                    <label htmlFor="auto-save-mode">Mode</label>
                    <Dropdown
                      id="auto-save-mode"
                      aria-label="Mode"
                      style={{ width: '100%' }}
                      value={settingsState.autoSaveMode || 'off'}
                      onChange={handleAutoSaveMode}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'onChange', label: 'On change' },
                        { value: 'onBlur', label: 'On blur' },
                        { value: 'timed', label: 'Timed' },
                      ]}
                    />
                  </div>
                  {((settingsState.autoSaveMode || 'off') === 'timed') && (
                    <div className="form-row">
                      <label htmlFor="auto-save-interval">
                        Interval <small>seconds (min 5)</small>
                      </label>
                      <input
                        id="auto-save-interval"
                        className="field"
                        type="number"
                        min={5}
                        value={settingsState.autoSaveInterval || 30}
                        onChange={e => handleAutoSaveInterval(Math.max(5, Number(e.target.value) || 30))}
                        style={{ width: 120, fontFamily: 'var(--f-mono)' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {sect === 'crawler' && (
              <CrawlerSettings settingsState={settingsState} persist={persist} />
            )}

            {sect === 'appearance' && (
              <div className="settings-section">
                <h3>Appearance</h3>
                <p className="desc">
                  Scale the entire interface up or down. Your choice is saved and
                  re-applied automatically the next time you open Silly Sleeve.
                </p>
                <div className="settings-form">
                  <div className="form-row">
                    <span className="form-label">Font scale</span>
                    <FontScaleControl />
                  </div>
                  <div className="form-row">
                    <span className="form-label">Accent color</span>
                    <AccentControl />
                  </div>
                  <div className="form-row">
                    <span className="form-label">Sidebar style</span>
                    <SidebarStyleControl />
                  </div>
                  <div className="form-row">
                    <span className="form-label">Step badges</span>
                    <StepBadgesControl />
                  </div>
                </div>
              </div>
            )}

            {(sect !== 'llm' && sect !== 'comfy' && sect !== 'prompts' && sect !== 'auto-save' && sect !== 'crawler' && sect !== 'appearance') && (
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
