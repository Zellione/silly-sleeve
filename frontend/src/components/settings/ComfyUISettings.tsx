import React, { useRef, useState } from 'react';
import {
  TrashIcon, LinkIcon, UploadIcon, FolderIcon,
} from '../../icons';
import { useToast } from '../ToastProvider';
import { AuthTokenBlock } from '../AuthTokenBlock';
import { ParseComfyWorkflowParams, TestComfyUIEndpoint } from '../../../wailsjs/go/app/App';
import { settings, comfy } from '../../../wailsjs/go/models';
import WorkflowEditor from '../WorkflowEditor';

export type ComfyUISettingsProps = Readonly<{
  settingsState: settings.Settings;
  persist: (next: settings.Settings) => Promise<void>;
}>;

export const ComfyUISettings: React.FC<ComfyUISettingsProps> = ({ settingsState, persist }) => {
  const [draftURL, setDraftURL] = useState(settingsState.comfy?.url || '');
  const [draftToken, setDraftToken] = useState(settingsState.comfy?.authToken || '');
  const [draftOutput, setDraftOutput] = useState(settingsState.comfy?.outputFolder || '');
  const [authOn, setAuthOn] = useState(settingsState.comfy?.authToken !== undefined && settingsState.comfy?.authToken !== null);
  const [testing, setTesting] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<comfy.ComfyWorkflow | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const workflows = settingsState.comfy?.workflows || [];

  const saveComfyConfig = async (overrides: Partial<settings.ComfyConfig>) => {
    const base = settingsState.comfy || settings.ComfyConfig.createFrom({});
    const next = settings.Settings.createFrom({
      ...settingsState,
      comfy: settings.ComfyConfig.createFrom({
        url: base.url || '',
        authToken: base.authToken,
        outputFolder: base.outputFolder || '',
        defaultWorkflow: base.defaultWorkflow || '',
        workflows: base.workflows || [],
        ...overrides,
      }),
    });
    await persist(next);
  };

  const handleSaveURL = () => saveComfyConfig({ url: draftURL });
  const handleSaveToken = () => {
    const token = authOn ? draftToken : undefined;
    saveComfyConfig({ authToken: token });
  };
  const handleSaveOutput = () => saveComfyConfig({ outputFolder: draftOutput });

  const handleTestConnection = async () => {
    if (!draftURL) {
      toast({ kind: 'warn', title: 'No URL set', body: 'Enter a ComfyUI server URL first.' });
      return;
    }
    setTesting(true);
    try {
      const url = draftURL.replace(/\/$/, '');
      // Tested through the Go backend: a fetch from the WebView is subject to
      // CORS, which ComfyUI does not allow by default, so a perfectly healthy
      // server still failed the old in-page check. The backend client is also
      // what generation actually uses, auth token included.
      const res = await TestComfyUIEndpoint(url, authOn ? draftToken : '');
      if (res.ok) {
        toast({ kind: 'ok', title: 'ComfyUI reachable', body: `${url} responded. Connection OK.` });
      } else {
        toast({ kind: 'bad', title: 'ComfyUI unreachable', body: res.error || 'Could not connect. Check the URL and make sure ComfyUI is running.' });
      }
    } catch (err) {
      toast({ kind: 'bad', title: 'ComfyUI unreachable', body: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleImportWorkflow = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      const baseName = file.name.replace(/\.json$/i, '');
      const id = `wf-${Date.now()}`;
      let params = comfy.WorkflowParams.createFrom({});
      try {
        params = await ParseComfyWorkflowParams(text);
      } catch {
        // params stay empty
      }
      const wf = comfy.ComfyWorkflow.createFrom({
        id,
        name: baseName,
        jsonData: text,
        params,
      });
      const next = settings.Settings.createFrom({
        ...settingsState,
        comfy: settings.ComfyConfig.createFrom({
          ...(settingsState.comfy || settings.ComfyConfig.createFrom({})),
          workflows: [...workflows, wf],
        }),
      });
      await persist(next);
      toast({ kind: 'ok', title: 'Workflow imported', body: `${baseName} added. Param extraction will run when you queue a generation.` });
    } catch {
      toast({ kind: 'bad', title: 'Import failed', body: 'Could not parse the workflow JSON file.' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteWorkflow = async (id: string) => {
    const next = settings.Settings.createFrom({
      ...settingsState,
      comfy: settings.ComfyConfig.createFrom({
        ...(settingsState.comfy || settings.ComfyConfig.createFrom({})),
        workflows: workflows.filter(w => w.id !== id),
        defaultWorkflow: settingsState.comfy?.defaultWorkflow === id ? '' : (settingsState.comfy?.defaultWorkflow || ''),
      }),
    });
    await persist(next);
    toast({ kind: 'ok', title: 'Workflow removed', body: 'The workflow has been deleted.' });
  };

  const handleSetDefault = async (id: string) => {
    await saveComfyConfig({ defaultWorkflow: id });
  };

  return (
    <div className="settings-section">
      <h3>ComfyUI</h3>
      <p className="desc">
        Connect to a running ComfyUI instance to generate character portraits and project cover art.
      </p>
      <div className="settings-form">
        {/* Server URL */}
        <div className="ep-row">
          <label htmlFor="settings-server-url">
            <span>Server URL</span>
            <small>Typically <code>http://127.0.0.1:8188</code>. Must include protocol and port.</small>
          </label>
          <div className="ep-url">
            <span className="ic"><LinkIcon size={12} /></span>
            <input
              id="settings-server-url"
              value={draftURL}
              onChange={e => setDraftURL(e.target.value)}
              placeholder="http://127.0.0.1:8188"
              spellCheck={false}
            />
            <button type="button" className="ep-test-btn" data-state={testing ? 'testing' : 'idle'} onClick={handleTestConnection} disabled={testing}>
              {testing ? 'Testing…' : 'Test'}
            </button>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn ghost sm" onClick={handleSaveURL}>Save URL</button>
          </div>
        </div>

        {/* Auth */}
        <div className="ep-row">
          <label htmlFor="settings-auth-token">
            <span>Authentication</span>
            <small>Toggle on if your ComfyUI instance requires an API token.</small>
          </label>
          <AuthTokenBlock
            enabled={authOn}
            onToggle={setAuthOn}
            value={draftToken}
            onChange={setDraftToken}
            toggleLabel="Use auth token"
            placeholder="Your ComfyUI auth token"
            inputId="settings-auth-token"
            secretNoun="token"
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn ghost sm" onClick={handleSaveToken}>Save auth</button>
          </div>
        </div>

        {/* Output folder */}
        <div className="ep-row">
          <label htmlFor="settings-output-folder">
            <span>Output folder</span>
            <small>Where ComfyUI saves generated images. Used to locate completed renders.</small>
          </label>
          <div className="row" style={{ gap: 6 }}>
            <input
              id="settings-output-folder"
              className="ep-input"
              value={draftOutput}
              onChange={e => setDraftOutput(e.target.value)}
              placeholder="/path/to/comfyui/output"
              style={{ flex: 1, fontFamily: 'var(--f-mono)' }}
            />
            <button type="button" className="btn ghost icon" title="Browse…"><FolderIcon size={14} /></button>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn ghost sm" onClick={handleSaveOutput}>Save folder</button>
          </div>
        </div>

        <div className="ep-divline" />

        {/* Workflows */}
        <div className="ep-row">
          <label htmlFor="settings-workflow-file">
            <span>Saved workflows</span>
            <small>Import ComfyUI workflow .json files. Parameters are auto-extracted when you queue a generation.</small>
          </label>
          <input
            id="settings-workflow-file"
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => { void handleFileSelected(e); }}
          />
          {workflows.length > 0 ? (
            <div className="col" style={{ gap: 6 }}>
              {workflows.map(wf => (
                <div key={wf.id} className="endpoint-card" style={{ padding: '10px 14px' }}>
                  <div className="h">
                    <span className="ic" style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>.json</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontWeight: 600 }}>{wf.name}</span>
                      <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {wf.params?.checkpoint || 'no checkpoint ·'} {wf.params?.width || '?'}×{wf.params?.height || '?'}
                      </span>
                    </div>
                    <span className="grow" />
                    {settingsState.comfy?.defaultWorkflow === wf.id && (
                      <span className="pill" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)', background: 'var(--acc-soft)' }}>default</span>
                    )}
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn ghost sm" onClick={() => setEditingWorkflow(wf)}>Edit</button>
                      {settingsState.comfy?.defaultWorkflow !== wf.id && (
                        <button type="button" className="btn ghost sm" onClick={() => handleSetDefault(wf.id)}>Set default</button>
                      )}
                      <button type="button" className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => handleDeleteWorkflow(wf.id)}>
                        <TrashIcon size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helpr" style={{ padding: '12px 0' }}>No workflows imported yet. Click below to add one.</div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn ghost" onClick={handleImportWorkflow}>
              <UploadIcon size={13} /> Import workflow .json
            </button>
          </div>
        </div>
      </div>
      {editingWorkflow && (
        <WorkflowEditor
          workflow={editingWorkflow}
          onClose={() => setEditingWorkflow(null)}
          onSaved={(templateText) => {
            if (!editingWorkflow) return;
            const updatedWorkflows = workflows.map(wf =>
              wf.id === editingWorkflow.id
                ? comfy.ComfyWorkflow.createFrom({ ...wf, template: templateText })
                : wf
            );
            persist(settings.Settings.createFrom({
              ...settingsState,
              comfy: settings.ComfyConfig.createFrom({
                ...(settingsState.comfy || settings.ComfyConfig.createFrom({})),
                workflows: updatedWorkflows,
              }),
            }));
          }}
          onSaveError={(msg) => toast({ kind: 'bad', title: 'Save failed', body: msg })}
        />
      )}
    </div>
  );
};
