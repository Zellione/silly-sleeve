import React, { useState } from 'react';
import { KeyIcon, EyeIcon, XIcon } from '../icons';

export interface AuthTokenBlockProps {
  /** Whether auth is enabled (the secret input is shown). */
  enabled: boolean;
  onToggle: (on: boolean) => void;
  /** Current secret value (empty string when none). */
  value: string;
  onChange: (v: string) => void;
  /** Toggle-row heading, e.g. "Use API key" or "Use auth token". */
  toggleLabel: string;
  placeholder: string;
  /** Optional id for the secret input (to pair with an external <label htmlFor>). */
  inputId?: string;
  /** Noun used in the reveal-button tooltip ("key" → "Reveal key"). */
  secretNoun?: string;
}

/**
 * The shared "Use API key / auth token" toggle plus a reveal-able password
 * input, used by both the LLM endpoint flyout and the ComfyUI settings. Reveal
 * state is internal; the secret value and on/off toggle are controlled.
 */
export const AuthTokenBlock: React.FC<AuthTokenBlockProps> = ({
  enabled,
  onToggle,
  value,
  onChange,
  toggleLabel,
  placeholder,
  inputId,
  secretNoun = 'key',
}) => {
  const [reveal, setReveal] = useState(false);

  return (
    <div className="ep-auth-block">
      <div className="ep-toggle-row">
        <div>
          <b>{toggleLabel}</b>
          <small>Sent as <code>Authorization: Bearer …</code></small>
        </div>
        <button
          className="ep-switch"
          data-on={enabled ? '1' : '0'}
          onClick={() => onToggle(!enabled)}
          role="switch"
          aria-checked={enabled}
        >
          <i />
        </button>
      </div>
      {enabled && (
        <div className="ep-key-input">
          <KeyIcon size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          <input
            id={inputId}
            type={reveal ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
          <button
            className="ep-eye"
            onClick={() => setReveal(!reveal)}
            title={reveal ? `Hide ${secretNoun}` : `Reveal ${secretNoun}`}
          >
            {reveal ? <XIcon size={12} /> : <EyeIcon size={12} />}
          </button>
        </div>
      )}
    </div>
  );
};
