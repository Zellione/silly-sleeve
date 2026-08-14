import React, { useState } from 'react';
import {
  CheckIcon, XIcon, TrashIcon, LinkIcon,
} from '../../icons';
import { useToast } from '../ToastProvider';
import { AuthTokenBlock } from '../AuthTokenBlock';
import { TestLLMEndpoint } from '../../../wailsjs/go/app/App';
import { settings } from '../../../wailsjs/go/models';

export type EndpointFlyoutProps = Readonly<{
  endpoint: settings.LLMEndpoint;
  isNew: boolean;
  onSave: (ep: settings.LLMEndpoint) => void;
  onClose: () => void;
  onDelete?: () => void;
}>;

export const EndpointFlyout: React.FC<EndpointFlyoutProps> = ({
  endpoint, isNew, onSave, onClose, onDelete,
}) => {
  const [draft, setDraft] = useState<settings.LLMEndpoint>({ ...endpoint });
  const [testing, setTesting] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const { toast } = useToast();

  const set = <K extends keyof settings.LLMEndpoint>(k: K, v: settings.LLMEndpoint[K]) =>
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
      <button type="button" className="ep-flyout-bg" aria-label="Close endpoint editor" onClick={onClose} />
      <dialog
        className="ep-flyout"
        open
        aria-modal="true"
        aria-label={isNew ? 'New endpoint' : 'Edit endpoint'}
      >
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
            <label htmlFor="ep-url-input">
              <span>Base URL</span>
              <small>OpenAI-compatible endpoint — should end in <code>/v1</code>.</small>
            </label>
            <div className="ep-url">
              <span className="ic"><LinkIcon size={12} /></span>
              <input
                id="ep-url-input"
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
            <span className="ep-label">
              Authentication
              <small>Toggle on for hosted endpoints that require an API key.</small>
            </span>
            <AuthTokenBlock
              enabled={authOn}
              onToggle={toggleAuth}
              value={draft.key || ''}
              onChange={v => set('key', v)}
              toggleLabel="Use API key"
              placeholder="sk-… or msk-… or your provider's token"
              secretNoun="key"
            />
          </div>

          {/* Model */}
          <div className="ep-row">
            <label htmlFor="ep-model-input">
              <span>Model</span>
              <small>Identifier passed in the <code>model</code> param.</small>
            </label>
            <input
              id="ep-model-input"
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
            <label htmlFor="ep-ctx-range">
              <span>Context size</span>
              <small>Max tokens the model can hold in one call.</small>
            </label>
            <div className="ep-slider-row">
              <input
                id="ep-ctx-range"
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
                aria-label="Context size in tokens"
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
            <label htmlFor="ep-temp-range">
              <span>Temperature</span>
              <small>0 deterministic · 2 wild · 0.7–0.9 is the sweet spot for character writing.</small>
            </label>
            <div className="ep-slider-row">
              <input
                id="ep-temp-range"
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
                aria-label="Temperature value"
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
            <label htmlFor="ep-sysprompt">
              <span>System prompt</span>
              <small>Prepended to every call against this endpoint.</small>
            </label>
            <textarea
              id="ep-sysprompt"
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
      </dialog>
    </>
  );
};
