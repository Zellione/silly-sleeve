// Shared Silly Sleeve components: title bar, sidebar, status bar, modal.

const ssStyles = `
/* ─── App shell ──────────────────────────────────────────── */
.ss-app {
  height: 100vh;
  display: grid;
  grid-template-rows: 32px 1fr 24px;
  background: var(--bg);
  color: var(--ink);
}

/* Titlebar (mock window chrome) */
.ss-title {
  display: flex; align-items: center;
  padding: 0 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--hair);
  font: 500 11.5px/1 var(--f-sans);
  color: var(--ink-2);
  -webkit-app-region: drag;
  gap: 8px;
  position: relative;
}
.ss-traffic { display: flex; gap: 7px; }
.ss-traffic > i {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--hair-strong);
  display: inline-block;
}
.ss-traffic > i:nth-child(1) { background: #ed6a5f; }
.ss-traffic > i:nth-child(2) { background: #f4be4f; }
.ss-traffic > i:nth-child(3) { background: #61c554; }
.ss-title .ss-title-c {
  position: absolute; left: 50%; transform: translateX(-50%);
  font-family: var(--f-mono); font-size: 11px; letter-spacing: 0.08em;
  color: var(--ink-3); text-transform: uppercase;
}
.ss-title .ss-title-c b { color: var(--ink-2); font-weight: 600; letter-spacing: 0; text-transform: none; font-family: var(--f-sans); margin-right: 8px; }

/* Main = sidebar + content */
.ss-main {
  display: grid;
  grid-template-columns: var(--sidebar-w, 240px) 1fr;
  min-height: 0;
}
.ss-app[data-sidebar="rail"] { --sidebar-w: 72px; }
.ss-app[data-sidebar="wide"] { --sidebar-w: 240px; }
.ss-app[data-sidebar="compact"] { --sidebar-w: 180px; }

/* Sidebar */
.ss-side {
  background: var(--panel);
  border-right: 1px solid var(--hair);
  display: flex; flex-direction: column;
  min-width: 0;
  padding: 14px 10px 10px;
  gap: 14px;
}
.ss-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 8px 0;
}
.ss-brand-mark {
  width: 30px; height: 30px;
  background: var(--ink); color: var(--bg);
  border-radius: 6px;
  display: grid; place-items: center;
  font: 700 13px/1 var(--f-display); font-style: italic;
  flex-shrink: 0;
  box-shadow: var(--shadow);
}
.ss-brand-mark[data-acc="1"] { background: var(--acc); color: var(--acc-fg); }
.ss-brand-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: hidden; }
.ss-brand-text b {
  font: 400 18px/1 var(--f-display); font-style: italic;
  white-space: nowrap;
}
.ss-brand-text span {
  font: 500 9.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--ink-3);
}
.ss-app[data-sidebar="rail"] .ss-brand-text { display: none; }
.ss-app[data-sidebar="rail"] .ss-brand { justify-content: center; padding: 4px 0 0; }

.ss-nav { display: flex; flex-direction: column; gap: 2px; }
.ss-nav-sect {
  padding: 12px 8px 4px;
  font: 600 9px/1 var(--f-mono);
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--ink-3);
}
.ss-app[data-sidebar="rail"] .ss-nav-sect { display: none; }

.ss-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px;
  border: 0;
  background: transparent;
  color: var(--ink-2);
  font: 500 12.5px/1 var(--f-sans);
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  position: relative;
  min-width: 0;
  white-space: nowrap;
}
.ss-nav-item:hover { background: var(--hair); color: var(--ink); }
.ss-nav-item[data-active="1"] {
  background: var(--ink);
  color: var(--bg);
}
.ss-nav-item[data-active="1"] .ss-nav-num { color: var(--bg); opacity: 0.5; }
.ss-nav-item .ss-nav-num {
  font: 500 9.5px/1 var(--f-mono);
  color: var(--ink-3);
  margin-left: auto;
  letter-spacing: 0.08em;
}
.ss-app[data-sidebar="rail"] .ss-nav-item {
  padding: 11px 0;
  justify-content: center;
}
.ss-app[data-sidebar="rail"] .ss-nav-item span,
.ss-app[data-sidebar="rail"] .ss-nav-num { display: none; }
.ss-app[data-sidebar="rail"] .ss-nav-item[data-active="1"]::before {
  content: ""; position: absolute; left: -10px; top: 7px; bottom: 7px;
  width: 3px; background: var(--acc); border-radius: 0 2px 2px 0;
}

.ss-side-bottom { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }

.ss-project-pill {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 5px;
  min-width: 0;
}
.ss-project-pill > .av {
  width: 26px; height: 26px; border-radius: 4px;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 5px, var(--hair) 5px 6px);
  flex-shrink: 0;
}
.ss-project-pill > div {
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
}
.ss-project-pill b { font: 600 12px/1.2 var(--f-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-project-pill span { font: 500 9.5px/1 var(--f-mono); color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; }
.ss-app[data-sidebar="rail"] .ss-project-pill { padding: 5px; justify-content: center; }
.ss-app[data-sidebar="rail"] .ss-project-pill > div { display: none; }

/* Content area */
.ss-content {
  min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
  background: var(--bg);
}

/* Page header (sticky inside content) */
.ss-page-head {
  display: flex; align-items: flex-end;
  justify-content: space-between;
  padding: 26px 32px 18px;
  border-bottom: 1px solid var(--hair);
  background: var(--bg);
  gap: 24px;
}
.ss-page-head h1 {
  font: 400 38px/1 var(--f-display); font-style: italic;
  margin: 0;
  letter-spacing: -0.01em;
}
.ss-page-head .step-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--ink-3);
  margin-bottom: 8px;
}
.ss-page-head .step-pill b { color: var(--acc); font-weight: 600; font-family: var(--f-mono); }
.ss-page-head .ss-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.ss-page-body { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 32px 40px; }
.ss-page-body.no-pad { padding: 0; }

/* Status bar */
.ss-status {
  display: flex; align-items: center; gap: 14px;
  padding: 0 14px;
  background: var(--panel);
  border-top: 1px solid var(--hair);
  font: 500 10.5px/1 var(--f-mono);
  letter-spacing: 0.06em;
  color: var(--ink-3);
}
.ss-status > .sep { width: 1px; height: 12px; background: var(--hair); }
.ss-status > .grow { flex: 1; }
.ss-status .item { display: inline-flex; align-items: center; gap: 6px; }
.ss-status b { color: var(--ink-2); font-weight: 600; }

/* Modal */
.ss-modal-bg {
  position: fixed; inset: 0;
  background: oklch(0.18 0.01 60 / 0.4);
  backdrop-filter: blur(6px);
  display: grid; place-items: center;
  z-index: 100;
  padding: 40px;
}
.ss-modal {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 8px;
  width: 100%; max-width: 480px;
  box-shadow: 0 24px 60px -10px #0006;
  display: flex; flex-direction: column;
  max-height: 80vh; overflow: hidden;
}
.ss-modal h2 {
  font: 400 26px/1 var(--f-display); font-style: italic;
  margin: 0; padding: 22px 24px 6px;
}
.ss-modal .body { padding: 8px 24px 16px; color: var(--ink-2); line-height: 1.5; flex: 1; overflow-y: auto; }
.ss-modal .actions {
  padding: 14px 24px;
  border-top: 1px solid var(--hair);
  display: flex; justify-content: flex-end; gap: 8px;
}

/* ─── Character strip (cross-screen) ─────────────────────── */
.ss-char-strip {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 32px;
  background: var(--panel);
  border-bottom: 1px solid var(--hair);
  overflow-x: auto;
  scrollbar-width: thin;
}
.ss-char-strip > .uplabel {
  flex-shrink: 0;
  margin-right: 6px;
}
.ss-char-tab {
  appearance: none;
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 12px 7px 7px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 999px;
  cursor: pointer;
  color: var(--ink-2);
  font: 500 12px/1 var(--f-sans);
  flex-shrink: 0;
  transition: border-color .12s, background .12s;
}
.ss-char-tab:hover { border-color: var(--hair-strong); color: var(--ink); }
.ss-char-tab[data-on="1"] {
  background: var(--ink); color: var(--bg);
  border-color: var(--ink);
}
.ss-char-tab .av {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--acc); color: var(--acc-fg);
  display: grid; place-items: center;
  font: 600 11px/1 var(--f-display);
  font-style: italic;
  flex-shrink: 0;
}
.ss-char-tab[data-on="1"] .av { background: var(--bg); color: var(--ink); }
.ss-char-tab .nm { font-weight: 600; }
.ss-char-tab .ep {
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.08em;
  opacity: 0.55;
  border-left: 1px solid currentColor;
  padding-left: 8px;
}
.ss-char-tab[data-on="1"] .ep { opacity: 0.55; }
.ss-char-add {
  appearance: none;
  padding: 7px 12px;
  border: 1px dashed var(--hair-strong);
  background: transparent;
  border-radius: 999px;
  color: var(--ink-2);
  font: 500 11px/1 var(--f-sans);
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  flex-shrink: 0;
}
.ss-char-add:hover { border-color: var(--acc); color: var(--acc); }
.ss-char-strip > .row.right { margin-left: auto; flex-shrink: 0; padding-left: 14px; gap: 8px; }

/* ─── Save chip in sidebar ───────────────────────────────── */
.ss-save-row {
  display: flex; gap: 6px;
}
.ss-save-btn {
  appearance: none;
  display: flex; align-items: center; gap: 8px;
  padding: 9px 10px;
  background: var(--acc);
  color: var(--acc-fg);
  border: 0;
  border-radius: 5px;
  font: 600 12px/1 var(--f-sans);
  cursor: pointer;
  flex: 1;
  justify-content: center;
  transition: opacity .12s, transform .06s;
}
.ss-save-btn:hover { opacity: 0.9; }
.ss-save-btn:active { transform: translateY(1px); }
.ss-save-btn[data-state="saved"] {
  background: transparent;
  color: var(--ink-3);
  border: 1px solid var(--hair);
}
.ss-save-btn[data-state="saving"] {
  background: var(--panel-2);
  color: var(--ink-2);
  border: 1px solid var(--hair-strong);
}
.ss-save-secondary {
  appearance: none;
  width: 36px;
  background: transparent;
  border: 1px solid var(--hair);
  border-radius: 5px;
  color: var(--ink-2);
  cursor: pointer;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.ss-save-secondary:hover { background: var(--hair); color: var(--ink); }
.ss-app[data-sidebar="rail"] .ss-save-btn span { display: none; }
.ss-app[data-sidebar="rail"] .ss-save-btn { padding: 9px; }
.ss-app[data-sidebar="rail"] .ss-save-secondary { display: none; }

/* ─── Save popout menu ────────────────────────────────────── */
.ss-save-row { position: relative; }
.ss-save-secondary[data-on="1"] { background: var(--hair); color: var(--ink); }
.ss-save-menu {
  position: absolute;
  left: 0; right: 0;
  bottom: calc(100% + 8px);
  background: var(--panel);
  border: 1px solid var(--hair-strong);
  border-radius: 6px;
  padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 -16px 40px -16px #000a, 0 -2px 6px -1px #0003;
  z-index: 50;
  animation: ss-save-menu-in .14s cubic-bezier(.2,.7,.3,1);
  min-width: 240px;
}
.ss-app[data-sidebar="rail"] .ss-save-menu {
  left: 0;
  right: auto;
  min-width: 260px;
}
@keyframes ss-save-menu-in {
  from { transform: translateY(4px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
.ss-save-menu-h {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 2px 6px;
  border-bottom: 1px solid var(--hair);
}
.ss-save-menu-h .uplabel {
  font: 600 11px/1 var(--f-sans);
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
}
.ss-save-switch {
  position: relative;
  width: 30px; height: 17px;
  border: 0; padding: 0;
  border-radius: 999px;
  background: var(--hair-strong);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
.ss-save-switch[data-on="1"] { background: var(--acc); }
.ss-save-switch i {
  position: absolute; top: 2px; left: 2px;
  width: 13px; height: 13px; border-radius: 50%;
  background: #fff;
  transition: transform .15s;
  box-shadow: 0 1px 2px #0003;
}
.ss-save-switch[data-on="1"] i { transform: translateX(13px); }

.ss-save-menu-row {
  display: flex; flex-direction: column; gap: 5px;
}
.ss-save-menu-row label {
  font: 500 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--ink-3);
}
.ss-save-menu-row select {
  appearance: none;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 8px 28px 8px 10px;
  font: 500 12px/1 var(--f-sans);
  color: var(--ink);
  outline: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%238a8175' d='M0 0h10L5 6z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.ss-save-menu-row select:focus { border-color: var(--acc-line); }

.ss-save-menu-status {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  font: 400 11px/1.4 var(--f-sans);
  color: var(--ink-2);
}
.ss-save-menu-status .dot { margin-top: 4px; }
.ss-save-menu-status b { color: var(--ink); font-weight: 600; }
.ss-save-menu-status kbd {
  font: 500 9.5px/1 var(--f-mono);
  padding: 2px 4px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-bottom-width: 2px;
  border-radius: 2px;
  color: var(--ink-2);
}

.ss-save-menu-sep {
  height: 1px;
  background: var(--hair);
  margin: 2px -12px;
}

.ss-save-menu-item {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 4px;
  padding: 8px 10px;
  font: 500 12px/1 var(--f-sans);
  color: var(--ink);
  cursor: pointer;
  display: flex; align-items: center; gap: 9px;
  text-align: left;
}
.ss-save-menu-item:hover { background: var(--hair); }
.ss-save-menu-item svg { color: var(--ink-3); flex-shrink: 0; }

/* ─── Toasts ─────────────────────────────────────────────── */
.ss-toast-stack {
  position: fixed;
  right: 20px; bottom: 36px;
  z-index: 200;
  display: flex; flex-direction: column-reverse;
  gap: 10px;
  pointer-events: none;
  max-width: 360px;
}
.ss-toast {
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: flex-start;
  background: var(--panel);
  border: 1px solid var(--hair);
  border-left: 3px solid var(--ink-3);
  border-radius: 6px;
  padding: 13px 14px 12px;
  box-shadow: 0 16px 40px -16px #000a, 0 2px 6px -1px #0003;
  position: relative;
  overflow: hidden;
  animation: ss-toast-in .26s cubic-bezier(.2,.7,.3,1);
  min-width: 260px;
}
@keyframes ss-toast-in {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.ss-toast[data-kind="ok"]   { border-left-color: var(--ok); }
.ss-toast[data-kind="bad"]  { border-left-color: var(--bad); }
.ss-toast[data-kind="warn"] { border-left-color: var(--warn); }
.ss-toast[data-kind="info"] { border-left-color: var(--acc); }
.ss-toast-ic {
  width: 26px; height: 26px;
  border-radius: 50%;
  display: grid; place-items: center;
  color: #fff;
  flex-shrink: 0;
  margin-top: 2px;
}
.ss-toast[data-kind="ok"]   .ss-toast-ic { background: var(--ok); }
.ss-toast[data-kind="bad"]  .ss-toast-ic { background: var(--bad); }
.ss-toast[data-kind="warn"] .ss-toast-ic { background: var(--warn); color: #1c1813; }
.ss-toast[data-kind="info"] .ss-toast-ic { background: var(--acc); color: var(--acc-fg); }
.ss-toast-body {
  display: flex; flex-direction: column; gap: 3px;
  min-width: 0;
}
.ss-toast-body b {
  font: 600 12.5px/1.3 var(--f-sans);
  color: var(--ink);
}
.ss-toast-body span {
  font: 400 11.5px/1.45 var(--f-sans);
  color: var(--ink-2);
}
.ss-toast-x {
  appearance: none; border: 0; background: transparent;
  color: var(--ink-3);
  width: 22px; height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: grid; place-items: center;
  margin-top: 2px;
}
.ss-toast-x:hover { background: var(--hair); color: var(--ink); }
.ss-toast-progress {
  position: absolute; left: 0; bottom: 0;
  height: 2px;
  background: var(--ink-3);
  opacity: 0.35;
  animation: ss-toast-bar 4.2s linear forwards;
  border-radius: 0 0 6px 6px;
}
.ss-toast[data-kind="ok"]   .ss-toast-progress { background: var(--ok); }
.ss-toast[data-kind="bad"]  .ss-toast-progress { background: var(--bad); }
.ss-toast[data-kind="warn"] .ss-toast-progress { background: var(--warn); }
.ss-toast[data-kind="info"] .ss-toast-progress { background: var(--acc); }
@keyframes ss-toast-bar { from { width: 100%; } to { width: 0%; } }

/* tooltips/help text */
.helpr { color: var(--ink-3); font-size: 11.5px; line-height: 1.5; }
`;


function injectStyles() {
  if (document.getElementById('ss-styles')) return;
  const s = document.createElement('style');
  s.id = 'ss-styles';
  s.textContent = ssStyles;
  document.head.appendChild(s);
}

// ─── Sidebar ───────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',    label: 'Projects',      icon: 'Dashboard', step: null },
  { id: 'crawler',      label: 'Crawl',         icon: 'Globe',     step: 1 },
  { id: 'editor',       label: 'Compose',       icon: 'Pen',       step: 2 },
  { id: 'lorebook',     label: 'Lorebook',      icon: 'Book',      step: 3 },
  { id: 'projectImage', label: 'Project image', icon: 'Folder',    step: 4 },
  { id: 'image',        label: 'Portrait',      icon: 'Image',     step: 5 },
  { id: 'preview',      label: 'Preview',       icon: 'Eye',       step: 6 },
  { id: 'export',       label: 'Export',        icon: 'Download',  step: 7 },
  { id: 'settings',     label: 'Settings',      icon: 'Cog',       step: null },
];

function Sidebar({ current, onNav, project, showStepBadges }) {
  const main = NAV.filter(n => n.step != null);
  const tools = NAV.filter(n => n.step == null && n.id !== 'dashboard');
  return (
    <aside className="ss-side">
      <div className="ss-brand">
        <div className="ss-brand-mark" data-acc="1">S</div>
        <div className="ss-brand-text">
          <b>Silly Sleeve</b>
          <span>v0.4 · workshop</span>
        </div>
      </div>

      <div className="ss-nav">
        <button className="ss-nav-item" data-active={current === 'dashboard' ? '1' : '0'} onClick={() => onNav('dashboard')}>
          {React.createElement(I.Dashboard, { size: 16 })}
          <span>Projects</span>
        </button>
      </div>

      <div className="ss-nav">
        <div className="ss-nav-sect">Workflow</div>
        {main.map(n => (
          <button key={n.id} className="ss-nav-item"
                  data-active={current === n.id ? '1' : '0'}
                  onClick={() => onNav(n.id)}>
            {React.createElement(I[n.icon], { size: 16 })}
            <span>{n.label}</span>
            {showStepBadges && <span className="ss-nav-num">0{n.step}</span>}
          </button>
        ))}
      </div>

      <div className="ss-nav">
        <div className="ss-nav-sect">Setup</div>
        {tools.map(n => (
          <button key={n.id} className="ss-nav-item"
                  data-active={current === n.id ? '1' : '0'}
                  onClick={() => onNav(n.id)}>
            {React.createElement(I[n.icon], { size: 16 })}
            <span>{n.label}</span>
          </button>
        ))}
      </div>

      <div className="ss-side-bottom">
        <div className="ss-project-pill">
          <div className="av"/>
          <div>
            <b>{project?.name || 'Untitled'}</b>
            <span>{project?.unsaved ? 'unsaved •' : 'saved'} {project?.updated || 'now'}</span>
          </div>
        </div>
        <SaveButton unsaved={project?.unsaved} onSave={project?.onSave}/>
      </div>
    </aside>
  );
}

// ─── Save button ──────────────────────────────────────────
function SaveButton({ unsaved, onSave }) {
  const [state, setState] = React.useState('idle'); // idle | saving | saved
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [autoSave, setAutoSave] = React.useState(true);
  const [freq, setFreq] = React.useState('60');
  const menuRef = React.useRef(null);

  // Close on outside click / Esc
  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const click = () => {
    if (state === 'saving') return;
    setState('saving');
    setTimeout(() => {
      setState('saved');
      onSave && onSave();
      window.toast && window.toast({
        kind: 'ok', title: 'Project saved',
        body: 'All character drafts, lorebook entries and prompts written to disk.',
      });
      setTimeout(() => setState('idle'), 1400);
    }, 700);
  };
  const label = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : (unsaved ? 'Save project' : 'Saved');
  const dataState = state === 'idle' && !unsaved ? 'saved' : state;

  const freqOptions = [
    { v: '15',  label: 'every 15 seconds' },
    { v: '30',  label: 'every 30 seconds' },
    { v: '60',  label: 'every minute' },
    { v: '300', label: 'every 5 minutes' },
    { v: '900', label: 'every 15 minutes' },
    { v: 'change', label: 'on every change' },
    { v: 'blur', label: 'when window loses focus' },
  ];
  const freqLabel = freqOptions.find(f => f.v === freq)?.label || 'every minute';

  return (
    <div className="ss-save-row" ref={menuRef}>
      <button className="ss-save-btn" data-state={dataState} onClick={click} title="Save project · ⌘S">
        {React.createElement(state === 'saved' ? I.Check : I.Save, { size: 13 })}
        <span>{label}</span>
      </button>
      <button className="ss-save-secondary" title="Save options"
              data-on={menuOpen ? '1' : '0'}
              onClick={() => setMenuOpen(!menuOpen)}>
        <I.Down size={13} style={{transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s'}}/>
      </button>
      {menuOpen && (
        <div className="ss-save-menu" onClick={e => e.stopPropagation()}>
          <div className="ss-save-menu-h">
            <span className="uplabel">Auto-save</span>
            <button className="ss-save-switch" data-on={autoSave ? '1' : '0'}
                    onClick={() => setAutoSave(!autoSave)}><i/></button>
          </div>
          {autoSave && (
            <>
              <div className="ss-save-menu-row">
                <label>Frequency</label>
                <select value={freq} onChange={e => setFreq(e.target.value)}>
                  {freqOptions.map(o => (
                    <option key={o.v} value={o.v}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="ss-save-menu-status">
                <span className="dot ok"/>
                <span>Saves <b>{freqLabel}</b> while the project has changes.</span>
              </div>
            </>
          )}
          {!autoSave && (
            <div className="ss-save-menu-status">
              <span className="dot idle"/>
              <span>Save manually with the button above or <kbd>⌘</kbd> <kbd>S</kbd>.</span>
            </div>
          )}
          <div className="ss-save-menu-sep"/>
          <button className="ss-save-menu-item" onClick={() => {
            setMenuOpen(false);
            window.toast && window.toast({
              kind: 'ok', title: 'Snapshot created',
              body: 'A timestamped copy of the project is preserved in History.',
            });
          }}>
            <I.Copy size={13}/> Save as snapshot…
          </button>
          <button className="ss-save-menu-item" onClick={() => {
            setMenuOpen(false);
            window.toast && window.toast({
              kind: 'ok', title: 'Revert ready',
              body: 'Last saved state restored. You can re-apply changes from History.',
            });
          }}>
            <I.Reroll size={13}/> Revert to last save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Character strip (cross-screen tabs) ─────────────────
function CharacterStrip({ characters, activeId, onSelect, onAdd, showAdd = false, right }) {
  return (
    <div className="ss-char-strip scroll">
      <span className="uplabel">Characters · {characters.length}</span>
      {characters.map(c => (
        <button key={c.id} className="ss-char-tab"
                data-on={c.id === activeId ? '1' : '0'}
                onClick={() => onSelect(c.id)}>
          <span className="av">{c.initial || c.name[0]}</span>
          <span className="nm">{c.name}</span>
          {c.epithet && <span className="ep">{c.epithet}</span>}
        </button>
      ))}
      {showAdd && (
        <button className="ss-char-add" onClick={onAdd}>
          <I.Plus size={11}/> Add character
        </button>
      )}
      {right && <div className="row right">{right}</div>}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────
function PageHead({ step, title, subtitle, actions }) {
  return (
    <header className="ss-page-head">
      <div>
        {step && (
          <div className="step-pill">
            <b>Step {String(step).padStart(2, '0')}</b>
            <span>·</span>
            <span>{subtitle}</span>
          </div>
        )}
        <h1>{title}</h1>
      </div>
      <div className="ss-actions">{actions}</div>
    </header>
  );
}

// ─── Title bar (window chrome) ────────────────────────────
function TitleBar({ project }) {
  return (
    <div className="ss-title">
      <div className="ss-traffic"><i/><i/><i/></div>
      <div className="ss-title-c">
        <b>{project?.name || 'Untitled'}</b>
        Silly Sleeve · Character Workshop
      </div>
    </div>
  );
}

// ─── Status bar (footer) ──────────────────────────────────
function StatusBar({ project, llm, comfy, route }) {
  return (
    <div className="ss-status">
      <span className="item"><span className={`dot ${llm.status}`}/><b>LLM</b> {llm.name}</span>
      <span className="sep"/>
      <span className="item"><span className={`dot ${comfy.status}`}/><b>ComfyUI</b> {comfy.name}</span>
      <span className="sep"/>
      <span className="item">{project?.tokens || 0} tokens</span>
      <span className="grow"/>
      <span className="item">{route}</span>
      <span className="sep"/>
      <span className="item">⇧⌘P · command</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────
function Modal({ title, children, onClose, footer }) {
  return (
    <div className="ss-modal-bg" onClick={onClose}>
      <div className="ss-modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="body">{children}</div>
        <div className="actions">{footer}</div>
      </div>
    </div>
  );
}

Object.assign(window, { injectStyles, Sidebar, PageHead, TitleBar, StatusBar, Modal, NAV, CharacterStrip, SaveButton, ToastProvider });

// ─── Global toast system ──────────────────────────────────
// Mounted once at App level; any component can call window.toast({...}).
function ToastProvider() {
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    window.toast = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts(prev => [...prev, { kind: 'ok', ...t, id }]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)),
                 t.duration ?? 4200);
    };
    return () => { delete window.toast; };
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div className="ss-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className="ss-toast" data-kind={t.kind}>
          <div className="ss-toast-ic">
            {t.kind === 'ok'   && React.createElement(I.Check, { size: 14 })}
            {t.kind === 'bad'  && React.createElement(I.X, { size: 14 })}
            {t.kind === 'warn' && React.createElement(I.Bolt, { size: 14 })}
            {t.kind === 'info' && React.createElement(I.Save, { size: 14 })}
          </div>
          <div className="ss-toast-body">
            <b>{t.title}</b>
            {t.body && <span>{t.body}</span>}
          </div>
          <button className="ss-toast-x"
                  onClick={() => setToasts(s => s.filter(x => x.id !== t.id))}>
            <I.X size={12}/>
          </button>
          <div className="ss-toast-progress"/>
        </div>
      ))}
    </div>
  );
}
