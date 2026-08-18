import React, { useState, useEffect } from 'react';
import { CogIcon, SunIcon, MoonIcon, SaveIcon } from '../icons';
import { TABS } from './tabs';
import { getStoredDark, applyTheme } from '../utils/theme';

/* ─── Types ─────────────────────────────────────────────── */

export type Route =
  | 'dashboard' | 'crawler' | 'summaries' | 'characters' | 'lorebook'
  | 'images' | 'preview' | 'export' | 'settings';

/* ─── Components ────────────────────────────────────────── */

export const TopBar: React.FC<{
  current: Route;
  onNav: (r: Route) => void;
  projectName?: string;
  onSave?: () => void;
}> = ({ current, onNav, projectName, onSave }) => (
  <div className="v2-top">
    <button type="button" className="v2-brand" title="All projects"
      onClick={() => onNav('dashboard')}
    >
      <span className="mark">SS</span>
      <span className="pj">
        <b>{projectName || 'No project open'}</b>
        <span>character workshop</span>
      </span>
    </button>
    <div className="v2-tabs" role="tablist">
      {TABS.map(t => (
        <button type="button"
          key={t.id}
          role="tab"
          className="v2-tab"
          aria-selected={current === t.id}
          data-on={current === t.id ? '1' : '0'}
          onClick={() => onNav(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
    <div className="v2-right">
      {onSave && (
        <button type="button" className="v2-savebtn" title="Save project" onClick={onSave}>
          <SaveIcon size={14} /> Save
        </button>
      )}
      <ThemeToggle />
      <button type="button"
        className="v2-iconbtn"
        title="Settings"
        data-on={current === 'settings' ? '1' : '0'}
        onClick={() => onNav('settings')}
      >
        <CogIcon size={15} />
      </button>
    </div>
  </div>
);

export const PageHead: React.FC<{
  subtitle?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ subtitle, title, actions }) => (
  <header className="ss-page-head">
    <div>
      <h1>{title}</h1>
      {subtitle && <div className="v2-sub">{subtitle}</div>}
    </div>
    <div className="ss-actions">{actions}</div>
  </header>
);

export const StatusBar: React.FC<{
  routeLabel: string;
  llmStatus?: 'ok' | 'warn' | 'bad' | 'idle';
  llmName?: string;
  autoSaveMode?: string;
}> = ({ routeLabel, llmStatus = 'idle', llmName, autoSaveMode }) => (
  <div className="ss-status">
    <span className="item">
      <span className={`dot ${llmStatus}`} />
      <b>LLM</b> {llmName || '—'}
    </span>
    <span className="sep" />
    <span>{routeLabel}</span>
    <span className="grow" />
    {autoSaveMode && autoSaveMode !== 'off' && (
      <>
        <span className="item" style={{ color: 'var(--acc)' }}>
          Auto-save: {autoSaveMode}
        </span>
        <span className="sep" />
      </>
    )}
    <span>Silly Sleeve v0.1.0</span>
  </div>
);

export const ThemeToggle: React.FC = () => {
  const [dark, setDark] = useState(getStoredDark);

  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  return (
    <button type="button"
      className="v2-iconbtn"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setDark(!dark)}
    >
      {dark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
    </button>
  );
};
