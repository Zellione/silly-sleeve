import React from 'react';

const DEFAULT_SYSTEM_PROMPT =
  'You are formatting wiki content into a SillyTavern character card. Stay in third person present tense. Avoid plot spoilers post-act 1 unless tagged. Output only the requested field — no preamble.';

/**
 * The Settings → "Generation defaults" block (temperature, max tokens, system
 * prompt template). Currently presentational with uncontrolled defaults; lift
 * to controlled inputs here when these values get wired to settings.
 */
export const GenerationDefaultsForm: React.FC = () => (
  <>
    <h3 style={{ marginTop: 24 }}>Generation defaults</h3>
    <div className="settings-form">
      <div className="form-row">
        <label htmlFor="gen-temperature">
          Temperature <small>0 deterministic — 2 wild</small>
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input id="gen-temperature" type="range" min={0} max={2} step={0.05} defaultValue={0.85} style={{ flex: 1, accentColor: 'var(--acc)' }} />
          <input className="field" type="text" aria-label="Temperature value" defaultValue="0.85" style={{ width: 70, textAlign: 'right', fontFamily: 'var(--f-mono)' }} />
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="gen-max-tokens">
          Max tokens <small>per field re-roll</small>
        </label>
        <input id="gen-max-tokens" className="field" type="number" defaultValue={320} style={{ width: 120, fontFamily: 'var(--f-mono)' }} />
      </div>
      <div className="form-row">
        <label htmlFor="gen-system-prompt">
          System prompt template <small>injected at the top of every formatting call</small>
        </label>
        <textarea
          id="gen-system-prompt"
          className="field"
          defaultValue={DEFAULT_SYSTEM_PROMPT}
          style={{ minHeight: 110, fontFamily: 'var(--f-mono)', fontSize: 12 }}
        />
      </div>
    </div>
  </>
);
