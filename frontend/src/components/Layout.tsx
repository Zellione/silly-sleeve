import React, { useState, useEffect } from 'react';
import {
  DashboardIcon, GlobeIcon, PenIcon, BookIcon,
  ImageIcon, EyeIcon, DownloadIcon, CogIcon, SunIcon, MoonIcon,
} from '../icons';

/* ─── Types ─────────────────────────────────────────────── */

export type Route =
  | 'dashboard' | 'crawler' | 'editor' | 'lorebook'
  | 'projectImage' | 'image' | 'preview' | 'export' | 'settings';

interface NavItem {
  id: Route;
  label: string;
  icon: React.FC<any>;
  step?: number;
  sect?: string;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Projects', icon: DashboardIcon, sect: 'Project' },
  { id: 'crawler', label: 'Crawl', icon: GlobeIcon, step: 1, sect: 'Workflow' },
  { id: 'editor', label: 'Compose', icon: PenIcon, step: 2, sect: 'Workflow' },
  { id: 'lorebook', label: 'Lorebook', icon: BookIcon, step: 3, sect: 'Workflow' },
  { id: 'projectImage', label: 'Project image', icon: ImageIcon, step: 4, sect: 'Workflow' },
  { id: 'image', label: 'Portrait', icon: ImageIcon, step: 5, sect: 'Workflow' },
  { id: 'preview', label: 'Preview', icon: EyeIcon, step: 6, sect: 'Workflow' },
  { id: 'export', label: 'Export', icon: DownloadIcon, step: 7, sect: 'Workflow' },
];

const SETUP_NAV: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: CogIcon, sect: 'Setup' },
];

/* ─── Components ────────────────────────────────────────── */

export const TitleBar: React.FC<{ projectName?: string }> = ({ projectName }) => (
  <div className="ss-title">
    <div className="ss-traffic">
      <i/><i/><i/>
    </div>
    <span className="ss-title-c">
      <b>Silly Sleeve</b> {projectName ? `· ${projectName}` : ''}
    </span>
  </div>
);

export const Sidebar: React.FC<{
  current: Route;
  onNav: (r: Route) => void;
  showSteps?: boolean;
}> = ({ current, onNav, showSteps = true }) => {
  const renderItem = (n: NavItem) => {
    const Icon = n.icon;
    return (
      <button
        key={n.id}
        className="ss-nav-item"
        data-active={current === n.id ? '1' : '0'}
        onClick={() => onNav(n.id)}
      >
        <Icon size={16} />
        <span>{n.label}</span>
        {showSteps && n.step && <span className="ss-nav-num">{String(n.step).padStart(2, '0')}</span>}
      </button>
    );
  };

  const workflowItems = NAV.filter(n => n.sect === 'Workflow');
  const projectItems = NAV.filter(n => n.sect === 'Project');

  return (
    <aside className="ss-side">
      <div className="ss-brand">
        <div className="ss-brand-mark">S</div>
        <div className="ss-brand-text">
          <b>Silly Sleeve</b>
          <span>v0.1.0</span>
        </div>
      </div>

      <nav className="ss-nav">
        <div className="ss-nav-sect">Project</div>
        {projectItems.map(renderItem)}

        <div className="ss-nav-sect">Workflow</div>
        {workflowItems.map(renderItem)}

        <div className="ss-nav-sect">Setup</div>
        {SETUP_NAV.map(renderItem)}
      </nav>

      <div className="ss-side-bottom" />
    </aside>
  );
};

export const PageHead: React.FC<{
  step?: number;
  subtitle?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ step, subtitle, title, actions }) => (
  <header className="ss-page-head">
    <div>
      {step && (
        <div className="step-pill">
          <b>{String(step).padStart(2, '0')}</b> {subtitle}
        </div>
      )}
      <h1>{title}</h1>
    </div>
    <div className="ss-actions">{actions}</div>
  </header>
);

export const StatusBar: React.FC<{
  routeLabel: string;
  llmStatus?: 'ok' | 'warn' | 'bad' | 'idle';
  llmName?: string;
}> = ({ routeLabel, llmStatus = 'idle', llmName }) => (
  <div className="ss-status">
    <span className="item">
      <span className={`dot ${llmStatus}`} />
      <b>LLM</b> {llmName || '—'}
    </span>
    <span className="sep" />
    <span>{routeLabel}</span>
    <span className="grow" />
    <span>Silly Sleeve v0.1.0</span>
  </div>
);

export const ThemeToggle: React.FC = () => {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('ss-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('ss-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      className="btn icon ghost"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setDark(!dark)}
    >
      {dark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
    </button>
  );
};
