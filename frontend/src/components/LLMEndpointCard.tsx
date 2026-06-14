import React from 'react';
import { settings } from '../../wailsjs/go/models';
import { MoreIcon, CheckIcon, CopyIcon, DownloadIcon, TrashIcon } from '../icons';

export interface LLMEndpointCardProps {
  endpoint: settings.LLMEndpoint;
  /** Whether a connectivity test is in flight for this endpoint. */
  testing: boolean;
  /** Whether this card's overflow menu is open. */
  menuOpen: boolean;
  /** Ref attached to the menu wrapper while open (for outside-click handling). */
  menuRef: React.Ref<HTMLDivElement>;
  onToggleMenu: () => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onExportConfig: () => void;
  onDelete: () => void;
  onTest: () => void;
  onEdit: () => void;
}

/** A single LLM endpoint row in the Settings → LLM endpoints list. */
export const LLMEndpointCard: React.FC<LLMEndpointCardProps> = ({
  endpoint: e,
  testing,
  menuOpen,
  menuRef,
  onToggleMenu,
  onSetDefault,
  onDuplicate,
  onExportConfig,
  onDelete,
  onTest,
  onEdit,
}) => (
  <div className="endpoint-card">
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
      <div className="ep-more-wrap" ref={menuRef}>
        <button
          className="btn icon ghost"
          style={{ width: 28, height: 28 }}
          data-on={menuOpen ? '1' : '0'}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={ev => {
            ev.stopPropagation();
            onToggleMenu();
          }}
        >
          <MoreIcon size={14} />
        </button>
        {menuOpen && (
          <div className="ep-more-menu" role="menu">
            <button className="ep-more-item" role="menuitem" disabled={e.isDefault} onClick={onSetDefault}>
              <CheckIcon size={13} /> Set as default
              {e.isDefault && <span className="hint">current</span>}
            </button>
            <button className="ep-more-item" role="menuitem" onClick={onDuplicate}>
              <CopyIcon size={13} /> Duplicate
            </button>
            <button className="ep-more-item" role="menuitem" onClick={onExportConfig}>
              <DownloadIcon size={13} /> Export config
            </button>
            <div className="ep-more-sep" />
            <button className="ep-more-item danger" role="menuitem" onClick={onDelete}>
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
        <button className="btn ghost sm" disabled={testing} onClick={onTest}>
          {testing ? (
            <>
              <span className="dot warn" style={{ boxShadow: 'none', width: 6, height: 6 }} /> Testing…
            </>
          ) : (
            'Test'
          )}
        </button>
        <button className="btn ghost sm" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  </div>
);
