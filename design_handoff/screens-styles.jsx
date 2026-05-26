// ─────────────────────────────────────────────────────────────
// Silly Sleeve screens.  Workflow:  Projects → Crawl → Compose
// → Portrait → Preview ;  plus Settings.
// ─────────────────────────────────────────────────────────────

const screenStyles = `
/* shared blocks ------------------------------------------------ */
.row { display: flex; gap: 12px; align-items: center; }
.col { display: flex; flex-direction: column; gap: 12px; }

.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

/* === DASHBOARD === */
.proj-card {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  overflow: hidden;
  display: flex; flex-direction: column;
  cursor: pointer;
  transition: transform .12s, border-color .12s, box-shadow .12s;
}
.proj-card:hover { transform: translateY(-2px); border-color: var(--hair-strong); box-shadow: 0 8px 24px -12px #0002; }
.proj-thumb {
  aspect-ratio: 4/3;
  position: relative;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 9px, var(--hair) 9px 10px);
  display: flex; align-items: flex-end; justify-content: space-between;
  padding: 10px;
  font-family: var(--f-mono); font-size: 10px; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.1em;
}
.proj-thumb > .badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 7px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  font: 500 9.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-2);
}
.proj-thumb.empty::after {
  content: "no portrait yet";
  position: absolute; inset: 0;
  display: grid; place-items: center;
  font: 500 10px/1 var(--f-mono);
  color: var(--ink-3);
  letter-spacing: 0.16em; text-transform: uppercase;
}
.proj-meta { padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.proj-meta h3 {
  margin: 0; font: 400 22px/1 var(--f-display); font-style: italic;
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 8px;
}
.proj-meta h3 .pid { font: 500 9.5px/1 var(--f-mono); color: var(--ink-3); letter-spacing: 0.1em; }
.proj-meta .src {
  display: flex; align-items: center; gap: 6px;
  font: 500 11px/1 var(--f-mono); color: var(--ink-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proj-meta .tags { display: flex; flex-wrap: wrap; gap: 4px; }
.proj-meta .ft {
  display: flex; justify-content: space-between;
  font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  padding-top: 8px; border-top: 1px solid var(--hair);
}
.proj-meta .ft b { color: var(--ink); font-weight: 600; }

.dash-filters {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 22px;
  font: 500 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
}
.dash-filters .chip {
  padding: 7px 11px;
  border: 1px solid var(--hair);
  border-radius: 999px;
  background: transparent; color: var(--ink-2);
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.dash-filters .chip:hover { border-color: var(--hair-strong); }
.dash-filters .chip[data-on="1"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.dash-filters .chip span.count {
  font-size: 9.5px; padding: 2px 5px; border-radius: 999px;
  background: var(--hair); color: var(--ink-3);
}
.dash-filters .chip[data-on="1"] span.count { background: rgba(255,255,255,.15); color: var(--bg); }
.dash-filters .search {
  margin-left: auto; position: relative;
}
.dash-filters .search input {
  appearance: none;
  background: var(--panel); border: 1px solid var(--hair);
  border-radius: 999px; padding: 8px 12px 8px 32px;
  font: 12px/1 var(--f-sans); color: var(--ink);
  width: 220px; outline: none;
}
.dash-filters .search input:focus { border-color: var(--acc-line); }
.dash-filters .search > svg { position: absolute; left: 10px; top: 8px; color: var(--ink-3); }

/* empty state */
.empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 18px;
  padding: 80px 20px;
  text-align: center;
}
.empty .emoji {
  width: 88px; height: 88px;
  background-color: var(--panel);
  background-image: repeating-linear-gradient(135deg, transparent 0 11px, var(--hair) 11px 12px);
  border-radius: 50%;
  border: 1px solid var(--hair);
  display: grid; place-items: center;
  color: var(--ink-3);
}
.empty h2 {
  font: 400 38px/1.05 var(--f-display); font-style: italic;
  margin: 0; max-width: 480px;
}
.empty p { max-width: 460px; color: var(--ink-3); line-height: 1.55; margin: 0; }

/* === CRAWLER === */
.crawler-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.crawl-input {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 8px;
  padding: 18px;
  display: flex; flex-direction: column; gap: 14px;
}
.crawl-input .url-bar {
  display: flex; gap: 0;
  background: var(--bg); border: 1px solid var(--hair-strong);
  border-radius: 6px;
  overflow: hidden;
}
.crawl-input .url-bar .scheme {
  font: 500 11px/1 var(--f-mono);
  display: flex; align-items: center;
  padding: 0 10px;
  color: var(--ink-3);
  border-right: 1px solid var(--hair);
  background: var(--panel-2);
}
.crawl-input .url-bar input {
  flex: 1; min-width: 0;
  appearance: none; border: 0; outline: none; background: transparent;
  padding: 14px 14px; font: 500 14px/1 var(--f-mono);
  color: var(--ink);
}
.crawl-input .recent {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.crawl-input .recent .chip {
  font: 500 11px/1 var(--f-mono);
  padding: 6px 10px;
  background: var(--bg); border: 1px solid var(--hair);
  border-radius: 999px;
  color: var(--ink-2);
  cursor: pointer;
}
.crawl-input .recent .chip:hover { border-color: var(--acc-line); color: var(--acc); }

.crawl-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.crawl-opt {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.crawl-opt b { font-size: 12px; }
.crawl-opt small { color: var(--ink-3); font-size: 11px; line-height: 1.4; }
.crawl-opt > .row { justify-content: space-between; }

.crawl-preview {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 8px;
  overflow: hidden;
  height: 540px;
  display: flex; flex-direction: column;
}
.crawl-preview .head {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hair);
  font: 500 11px/1 var(--f-mono);
  color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.1em;
}
.crawl-preview .head b { color: var(--ink); font-weight: 600; }
.crawl-preview .body {
  flex: 1; overflow-y: auto;
  padding: 16px 18px;
  font: 13px/1.6 var(--f-sans);
  color: var(--ink-2);
}
.crawl-preview .body h4 {
  font: 400 22px/1.1 var(--f-display); font-style: italic;
  margin: 24px 0 8px;
  color: var(--ink);
}
.crawl-preview .body h4:first-child { margin-top: 0; }
.crawl-preview .body .section-tag {
  display: inline-block;
  font: 600 9px/1 var(--f-mono);
  padding: 3px 6px; border-radius: 3px;
  background: var(--acc-soft); color: var(--acc);
  letter-spacing: 0.1em; text-transform: uppercase;
  margin-right: 8px; vertical-align: 2px;
}
.crawl-preview .body p { margin: 0 0 10px; }
.crawl-preview .body p .pick {
  background: var(--acc-soft);
  border-bottom: 1px dashed var(--acc-line);
  padding: 1px 3px;
  border-radius: 2px;
  cursor: pointer;
}
.crawl-preview .body .infobox {
  display: grid; grid-template-columns: 110px 1fr;
  gap: 4px 14px;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  font: 12px/1.5 var(--f-mono);
  margin: 0 0 16px;
}
.crawl-preview .body .infobox dt {
  color: var(--ink-3); font-weight: 500;
  text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em;
  padding-top: 3px;
}
.crawl-preview .body .infobox dd { margin: 0; color: var(--ink); }
.crawl-preview .foot {
  display: flex; gap: 10px; align-items: center;
  padding: 12px 14px;
  border-top: 1px solid var(--hair);
  background: var(--panel-2);
}
.crawl-preview .foot .meta {
  font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  display: flex; gap: 14px;
}

/* === EDITOR === */
.editor-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.editor-source {
  position: sticky; top: 0;
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  max-height: calc(100vh - 200px);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.editor-source .h {
  padding: 12px 14px; border-bottom: 1px solid var(--hair);
  display: flex; justify-content: space-between; align-items: center;
}
.editor-source .h b {
  font: 500 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}
.editor-source .h b em { color: var(--ink); font-style: normal; }
.editor-source .b {
  padding: 14px;
  font: 12.5px/1.6 var(--f-sans);
  color: var(--ink-2);
  overflow-y: auto;
}
.editor-source .b p { margin: 0 0 8px; }
.editor-source .b mark {
  background: var(--acc-soft); color: var(--ink);
  padding: 1px 2px; border-radius: 2px;
}
.editor-source .f {
  padding: 10px 14px; border-top: 1px solid var(--hair);
  display: flex; justify-content: space-between; align-items: center;
  font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}

.field-card {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  padding: 14px 16px 16px;
  display: flex; flex-direction: column; gap: 10px;
  position: relative;
  transition: border-color .15s;
}
.field-card[data-locked="1"] { background: var(--panel-2); }
.field-card[data-locked="1"] textarea, .field-card[data-locked="1"] input { background: transparent; }
.field-card[data-state="rolling"] {
  border-color: var(--acc-line);
}
.field-card[data-state="rolling"]::after {
  content: "";
  position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
  background: var(--acc);
  animation: shimmer 1.4s linear infinite;
  background: linear-gradient(90deg, transparent 0, var(--acc) 50%, transparent 100%);
  background-size: 300px 100%;
}
.field-card .fc-head {
  display: flex; align-items: center; gap: 10px;
}
.field-card .fc-head .num {
  font: 600 10px/1 var(--f-mono);
  color: var(--ink-3);
  letter-spacing: 0.1em;
  width: 22px;
}
.field-card .fc-head h4 {
  font: 600 13px/1 var(--f-sans);
  margin: 0;
  letter-spacing: 0.01em;
}
.field-card .fc-head .req {
  font: 500 9px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  padding: 3px 6px; border-radius: 3px;
  border: 1px solid var(--hair);
  margin-left: 4px;
}
.field-card .fc-head .req[data-r="1"] { color: var(--acc); border-color: var(--acc-line); background: var(--acc-soft); }
.field-card .fc-head .grow { flex: 1; }
.field-card .fc-head .tools { display: flex; gap: 4px; }
.field-card .fc-head .tool {
  appearance: none; border: 0; background: transparent;
  color: var(--ink-3); width: 28px; height: 28px;
  border-radius: 4px; cursor: pointer;
  display: grid; place-items: center;
}
.field-card .fc-head .tool:hover { background: var(--hair); color: var(--ink); }
.field-card .fc-head .tool[data-active="1"] { color: var(--acc); background: var(--acc-soft); }
.field-card .fc-foot {
  display: flex; justify-content: space-between; align-items: center;
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}
.field-card .fc-foot .row { gap: 8px; }
.field-card .fc-foot .hist {
  display: inline-flex; align-items: center; gap: 4px;
  cursor: pointer;
  padding: 4px 6px; margin: -4px -6px;
  border-radius: 3px;
}
.field-card .fc-foot .hist:hover { background: var(--hair); color: var(--ink-2); }
.field-card .fc-reroll-prompt {
  background: var(--bg); border: 1px solid var(--hair);
  border-radius: 4px; padding: 10px;
  display: flex; gap: 8px; align-items: flex-start;
}
.field-card .fc-reroll-prompt textarea {
  flex: 1; min-height: 36px; max-height: 80px;
  border: 0; background: transparent; outline: none; resize: none;
  font: 12px/1.4 var(--f-mono); color: var(--ink);
}
.field-card .fc-reroll-prompt textarea::placeholder { color: var(--ink-3); }

/* tags input */
.tags-input {
  display: flex; flex-wrap: wrap; gap: 5px;
  padding: 10px 12px;
  background: var(--panel-2); border: 1px solid var(--hair);
  border-radius: 4px;
  min-height: 44px; align-items: center;
}
.tags-input input {
  flex: 1; min-width: 120px;
  border: 0; outline: none; background: transparent;
  font: 13px/1 var(--f-sans);
  padding: 4px 0;
}

/* stat grid */
.stat-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stat-row {
  display: grid; grid-template-columns: 1fr auto 80px auto;
  gap: 6px; align-items: center;
}
.stat-row input.key {
  background: transparent; border: 0; outline: none;
  font: 500 12px/1 var(--f-mono); padding: 8px 10px;
  border-bottom: 1px solid var(--hair); color: var(--ink-2);
}
.stat-row input.val {
  background: var(--panel-2); border: 1px solid var(--hair);
  border-radius: 4px; outline: none;
  font: 600 12px/1 var(--f-mono); padding: 8px 10px;
  text-align: right;
}
.stat-row .x {
  color: var(--ink-3); cursor: pointer;
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: 3px;
}
.stat-row .x:hover { color: var(--ink); background: var(--hair); }

/* quote rows */
.quote-row {
  display: grid; grid-template-columns: 1fr 24px;
  gap: 6px; align-items: start;
  padding: 8px 10px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 4px;
}
.quote-row textarea {
  border: 0; outline: none; background: transparent;
  font: italic 13px/1.5 var(--f-display);
  resize: none;
  color: var(--ink);
}

/* === IMAGE GEN === */
.img-grid {
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(0, 1fr) minmax(240px, 280px);
  gap: 18px;
  height: calc(100vh - 175px);
}
@media (max-width: 1180px) {
  .img-grid {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    grid-template-rows: 1fr auto;
    height: auto;
  }
  .img-grid > .img-col:nth-child(3) {
    grid-column: 1 / -1;
    height: 360px;
  }
  .img-grid > .img-col:nth-child(3) .b {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 18px;
  }
}
.img-col {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  display: flex; flex-direction: column;
  min-height: 0;
}
.img-col .h {
  padding: 12px 14px; border-bottom: 1px solid var(--hair);
  display: flex; justify-content: space-between; align-items: center;
}
.img-col .h b {
  font: 500 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}
.img-col .b {
  flex: 1; overflow-y: auto; padding: 14px;
  display: flex; flex-direction: column; gap: 14px;
}
.img-col .f {
  padding: 12px 14px; border-top: 1px solid var(--hair);
  display: flex; gap: 8px;
}
.kv {
  display: grid; grid-template-columns: 1fr auto;
  gap: 4px 10px;
  align-items: center;
}
.kv label { font-size: 11.5px; color: var(--ink-2); }
.kv input[type="number"], .kv input[type="text"] {
  width: 90px; padding: 6px 8px;
  background: var(--bg); border: 1px solid var(--hair); border-radius: 3px;
  font: 12px/1 var(--f-mono); outline: none; text-align: right;
}
.kv select {
  width: 100%; padding: 6px 8px;
  background: var(--bg); border: 1px solid var(--hair); border-radius: 3px;
  font: 12px/1 var(--f-sans); outline: none;
}

.img-tabs {
  display: flex; padding: 4px;
  background: var(--bg); border: 1px solid var(--hair);
  border-radius: 5px;
}
.img-tabs button {
  flex: 1;
  appearance: none; border: 0; background: transparent;
  padding: 6px 0;
  font: 500 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3); cursor: pointer;
  border-radius: 3px;
}
.img-tabs button[data-on="1"] {
  background: var(--panel); color: var(--ink);
  box-shadow: 0 1px 2px #0001;
}

.workflow-pill {
  display: flex; align-items: center; gap: 10px;
  padding: 10px;
  background: var(--bg);
  border: 1px solid var(--hair-strong);
  border-radius: 4px;
}
.workflow-pill .ic {
  width: 32px; height: 32px;
  background: var(--ink); color: var(--bg);
  border-radius: 4px;
  display: grid; place-items: center;
}
.workflow-pill div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.workflow-pill b { font-size: 12px; }
.workflow-pill span { font: 500 10px/1 var(--f-mono); color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; }

.img-canvas {
  flex: 1; min-height: 0;
  display: grid; place-items: center;
  background:
    repeating-conic-gradient(var(--panel-2) 0 25%, var(--bg) 0 50%) 50%/22px 22px;
  position: relative;
}
.img-canvas .placeholder {
  width: 60%; max-width: 360px;
  aspect-ratio: 3/4;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 11px, var(--hair) 11px 12px);
  border: 1px solid var(--hair);
  border-radius: 4px;
  display: grid; place-items: center;
  color: var(--ink-3); font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
}
.img-canvas .generating {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  flex-direction: column;
}
.img-canvas .progress-disc {
  width: 88px; height: 88px;
  border-radius: 50%;
  border: 3px solid var(--hair);
  border-top-color: var(--acc);
  animation: spin 1.1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.img-canvas .gen-meta {
  position: absolute; bottom: 16px; left: 16px;
  font: 500 10px/1.4 var(--f-mono);
  color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.1em;
}

.gallery {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.gallery .thumb {
  aspect-ratio: 3/4;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 9px, var(--hair) 9px 10px);
  border: 1px solid var(--hair);
  border-radius: 4px;
  position: relative;
  cursor: pointer;
}
.gallery .thumb[data-on="1"] { border: 2px solid var(--acc); }
.gallery .thumb .meta {
  position: absolute; bottom: 4px; left: 4px;
  font: 500 9px/1 var(--f-mono); color: var(--ink-3);
}

/* === SETTINGS === */
.settings-grid { display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: start; }
.settings-nav { display: flex; flex-direction: column; gap: 2px; }
.settings-nav button {
  appearance: none; border: 0; background: transparent;
  text-align: left; padding: 10px 12px;
  border-radius: 4px;
  font: 500 12.5px/1 var(--f-sans); color: var(--ink-2);
  cursor: pointer;
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.settings-nav button:hover { background: var(--hair); color: var(--ink); }
.settings-nav button[data-on="1"] { background: var(--ink); color: var(--bg); }
.settings-nav button[data-on="1"] .dot { box-shadow: none; }

.settings-content { display: flex; flex-direction: column; gap: 24px; }
.settings-section h3 {
  font: 400 22px/1 var(--f-display); font-style: italic;
  margin: 0 0 4px;
}
.settings-section .desc {
  color: var(--ink-3); font-size: 12px; line-height: 1.5;
  margin-bottom: 14px;
}
.settings-form {
  background: var(--panel); border: 1px solid var(--hair);
  border-radius: 6px;
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px;
}
.form-row {
  display: grid; grid-template-columns: 160px 1fr;
  gap: 16px; align-items: start;
}
.form-row label {
  font: 600 12px/1.5 var(--f-sans);
  padding-top: 9px;
  display: flex; flex-direction: column; gap: 2px;
}
.form-row label small {
  font: 400 11px/1.4 var(--f-sans);
  color: var(--ink-3);
}

.endpoint-card {
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 5px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.endpoint-card .h {
  display: flex; align-items: center; gap: 10px;
  font: 600 12px/1 var(--f-sans);
}
.endpoint-card .h .ic {
  width: 24px; height: 24px;
  background: var(--ink); color: var(--bg);
  border-radius: 4px; display: grid; place-items: center;
  font: 700 11px/1 var(--f-display); font-style: italic;
}
.endpoint-card .h .grow { flex: 1; }
.endpoint-card .h .pill {
  font: 600 9.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  padding: 3px 6px; border-radius: 3px;
  background: var(--bg); border: 1px solid var(--hair);
  color: var(--ink-3);
}
.endpoint-card .h .pill.ok { background: oklch(0.62 0.14 150 / 0.12); color: var(--ok); border-color: oklch(0.62 0.14 150 / 0.3); }
.endpoint-card .h .pill.idle { color: var(--ink-3); }

/* ─── More-menu popover (endpoint cards) ─────────────────── */
.ep-more-wrap { position: relative; flex-shrink: 0; }
.ep-more-wrap > button[data-on="1"] { background: var(--hair); color: var(--ink); }
.ep-more-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  background: var(--panel);
  border: 1px solid var(--hair-strong);
  border-radius: 6px;
  padding: 5px;
  display: flex; flex-direction: column;
  gap: 1px;
  box-shadow: 0 12px 32px -12px #000a, 0 2px 6px -1px #0003;
  z-index: 60;
  animation: ep-more-in .14s cubic-bezier(.2,.7,.3,1);
}
@keyframes ep-more-in {
  from { transform: translateY(-4px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.ep-more-item {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 8px 10px;
  border-radius: 4px;
  font: 500 12px/1 var(--f-sans);
  color: var(--ink);
  cursor: pointer;
  display: flex; align-items: center; gap: 9px;
  text-align: left;
  width: 100%;
}
.ep-more-item:hover { background: var(--hair); }
.ep-more-item:disabled {
  color: var(--ink-3);
  cursor: not-allowed;
}
.ep-more-item:disabled:hover { background: transparent; }
.ep-more-item svg { color: var(--ink-3); flex-shrink: 0; }
.ep-more-item .hint {
  margin-left: auto;
  font: 500 9.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  padding: 3px 5px;
  border-radius: 2px;
  background: var(--bg);
}
.ep-more-item.danger { color: var(--bad); }
.ep-more-item.danger svg { color: var(--bad); }
.ep-more-item.danger:hover { background: oklch(0.58 0.18 25 / 0.1); }
.ep-more-sep {
  height: 1px;
  background: var(--hair);
  margin: 4px -1px;
}
.endpoint-card .url {
  font: 500 11.5px/1.4 var(--f-mono);
  color: var(--ink-2);
  word-break: break-all;
}
.endpoint-card .row.foot {
  font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  justify-content: space-between;
}

/* === EXPORT / PREVIEW === */
.export-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1100px) {
  .export-grid { grid-template-columns: minmax(0, 1fr); }
  .export-side { position: static !important; }
}
.character-card {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 10px;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  min-height: 480px;
  box-shadow: 0 12px 40px -20px #0004;
}
@media (max-width: 760px) {
  .character-card {
    grid-template-columns: 1fr;
    grid-template-rows: 280px auto;
  }
  .character-card .portrait { border-right: 0; border-bottom: 1px solid var(--hair); }
}
.character-card .portrait {
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 11px, var(--hair) 11px 12px);
  position: relative;
  border-right: 1px solid var(--hair);
}
.character-card .portrait .id {
  position: absolute; top: 14px; left: 14px;
  font: 500 9.5px/1.5 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--ink-3);
}
.character-card .portrait .id b { display: block; color: var(--ink-2); font-weight: 600; letter-spacing: 0.08em; }
.character-card .portrait .tags {
  position: absolute; bottom: 14px; left: 14px; right: 14px;
  display: flex; flex-wrap: wrap; gap: 4px;
}
.character-card .body {
  padding: 24px 28px;
  display: flex; flex-direction: column; gap: 20px;
  min-width: 0;
}
.character-card .title-block {
  display: flex; flex-direction: column; gap: 4px;
  padding-bottom: 14px; border-bottom: 1px solid var(--hair);
}
.character-card .title-block .epithet {
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.18em;
  color: var(--acc);
}
.character-card .title-block h2 {
  font: 400 42px/1 var(--f-display); font-style: italic;
  margin: 0; letter-spacing: -0.01em;
}
.character-card .field { padding: 0; background: transparent; border: 0; }
.character-card .field-title {
  font: 600 9.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--ink-3);
  margin: 0 0 6px;
}
.character-card .field-body {
  font: 13px/1.6 var(--f-sans); color: var(--ink-2);
}
.character-card .stat-mini {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}
.character-card .stat-mini > div {
  background: var(--bg); border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 2px;
}
.character-card .stat-mini b { font: 600 16px/1 var(--f-mono); color: var(--ink); }
.character-card .stat-mini span { font: 500 9px/1 var(--f-mono); text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-3); }

.export-side {
  display: flex; flex-direction: column; gap: 16px;
  position: sticky; top: 0;
}
.export-side .card {
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.export-side h4 {
  font: 600 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  margin: 0; color: var(--ink-3);
}
.export-fmt {
  display: flex; flex-direction: column; gap: 6px;
}
.export-fmt button {
  appearance: none;
  text-align: left;
  padding: 10px 12px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 4px;
  cursor: pointer;
  display: flex; align-items: center; gap: 10px;
  color: var(--ink);
}
.export-fmt button:hover { border-color: var(--hair-strong); }
.export-fmt button[data-on="1"] {
  border-color: var(--acc);
  background: var(--acc-soft);
}
.export-fmt button > div { display: flex; flex-direction: column; gap: 1px; }
.export-fmt button b { font-size: 12px; }
.export-fmt button span { font: 500 10px/1.3 var(--f-mono); color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; }

.lorebook-row {
  display: grid; grid-template-columns: 1fr auto;
  gap: 8px; align-items: center;
  padding: 9px 12px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 4px;
}
.lorebook-row b { font: 600 12px/1.2 var(--f-sans); }
.lorebook-row .kw { font: 500 10px/1 var(--f-mono); color: var(--ink-3); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.08em; }
.lorebook-row .pri { font: 600 11px/1 var(--f-mono); color: var(--acc); }

/* === SETTINGS · strip list (modern checkbox rows) === */
.strip-list {
  display: flex; flex-direction: column;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 6px;
  overflow: hidden;
}
.strip-item {
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--hair);
  padding: 11px 14px;
  display: grid;
  grid-template-columns: 22px 1fr auto;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  color: var(--ink);
  text-align: left;
  transition: background .12s;
}
.strip-item:last-child { border-bottom: 0; }
.strip-item:hover { background: var(--bg); }
.strip-item .check {
  width: 18px; height: 18px;
  border: 1.5px solid var(--hair-strong);
  border-radius: 4px;
  display: grid; place-items: center;
  flex-shrink: 0;
  transition: all .12s;
}
.strip-item .check.on {
  background: var(--acc);
  border-color: var(--acc);
  color: var(--acc-fg);
}
.strip-item .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.strip-item .info b {
  font: 600 12.5px/1.3 var(--f-sans);
  color: var(--ink);
}
.strip-item .info span {
  font: 400 11.5px/1.4 var(--f-sans);
  color: var(--ink-3);
}
.strip-item .state {
  font: 500 10px/1 var(--f-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
  padding: 5px 8px;
  border: 1px solid var(--hair);
  border-radius: 3px;
  background: var(--panel);
  flex-shrink: 0;
}
.strip-item[data-on="1"] .state {
  color: var(--acc);
  border-color: var(--acc-line);
  background: var(--acc-soft);
}

/* === EXPORT HUB === */
.exp-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1100px) {
  .exp-grid { grid-template-columns: minmax(0, 1fr); }
}

.exp-pane {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  padding: 16px 18px 18px;
}
.exp-pane-h {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 12px; margin-bottom: 14px;
}
.exp-pane-h h3 {
  font: 400 22px/1 var(--f-display); font-style: italic;
  margin: 0 0 2px;
}

.exp-char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.exp-char {
  appearance: none;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 5px;
  padding: 10px;
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  color: var(--ink);
  transition: border-color .12s, background .12s;
}
.exp-char:hover { border-color: var(--hair-strong); }
.exp-char[data-on="1"] {
  border-color: var(--acc);
  background: var(--acc-soft);
}
.exp-char .thumb {
  position: relative;
  width: 56px; height: 56px;
  border-radius: 4px;
  background-color: var(--panel-2);
  background-image: repeating-linear-gradient(135deg, transparent 0 7px, var(--hair) 7px 8px);
  display: grid; place-items: center;
}
.exp-char .thumb .av {
  font: 600 22px/1 var(--f-display); font-style: italic;
  color: var(--ink-2);
}
.exp-char .thumb .check {
  position: absolute; top: -5px; right: -5px;
  width: 18px; height: 18px;
  background: var(--acc); color: var(--acc-fg);
  border-radius: 50%; display: grid; place-items: center;
  border: 2px solid var(--panel);
  opacity: 0; transition: opacity .12s;
}
.exp-char[data-on="1"] .thumb .check { opacity: 1; }
.exp-char .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.exp-char .info b { font: 600 13px/1.2 var(--f-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exp-char .info .ep {
  font: italic 12px/1.2 var(--f-display);
  color: var(--ink-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.exp-char .info .meta {
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ink-3);
  display: flex; gap: 5px;
  margin-top: 4px;
}

.exp-lore-list { display: flex; flex-direction: column; gap: 4px; }
.exp-lore {
  appearance: none;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 20px 28px 1fr auto;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  color: var(--ink);
  transition: border-color .12s, background .12s;
}
.exp-lore:hover { border-color: var(--hair-strong); }
.exp-lore[data-on="1"] {
  border-color: var(--acc);
  background: var(--acc-soft);
}
.exp-lore .check {
  width: 18px; height: 18px;
  border: 1.5px solid var(--hair-strong);
  border-radius: 4px;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.exp-lore .check.on { background: var(--acc); border-color: var(--acc); color: var(--acc-fg); }
.exp-lore .uid {
  font: 600 10px/1 var(--f-mono);
  color: var(--ink-3);
  letter-spacing: 0.08em;
  text-align: center;
  padding-right: 4px;
  border-right: 1px solid var(--hair);
}
.exp-lore .info { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.exp-lore .info b { font: 600 12.5px/1.2 var(--f-sans); }
.exp-lore .info .links { display: flex; flex-wrap: wrap; gap: 4px; }
.exp-lore .info .link {
  display: inline-flex; align-items: center; gap: 5px;
  font: 500 10.5px/1 var(--f-mono);
  padding: 3px 7px 3px 3px;
  background: var(--panel-2); border: 1px solid var(--hair);
  border-radius: 999px;
  color: var(--ink-2);
}
.exp-lore .info .link .av {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--acc); color: var(--acc-fg);
  display: grid; place-items: center;
  font: 600 9px/1 var(--f-display); font-style: italic;
}
.exp-lore .info .link.orphan {
  background: transparent;
  border-style: dashed;
  padding: 3px 8px;
  font-style: italic;
}
.exp-lore .ord {
  font: 500 10px/1 var(--f-mono);
  color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.1em;
}

.exp-side {
  display: flex; flex-direction: column; gap: 14px;
  position: sticky; top: 0;
}
.exp-side .card { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.exp-side h4 {
  font: 600 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  margin: 0; color: var(--ink-3);
}
.exp-dest-paths {
  background: var(--bg); border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 3px;
  font: 500 10.5px/1.5 var(--f-mono);
  color: var(--ink-2);
  overflow-x: auto;
}
.exp-summary {
  display: flex; flex-direction: column; gap: 4px;
  margin-top: 4px;
}
.exp-summary > div {
  display: flex; justify-content: space-between;
  font-size: 11.5px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--hair);
}
.exp-summary > div:last-child { border-bottom: 0; }
.exp-summary > div span { color: var(--ink-3); }
.exp-summary > div b { font-weight: 600; }
.exp-queue {
  display: flex; flex-direction: column; gap: 5px;
  margin-top: 10px;
}
`;

function injectScreenStyles() {
  if (document.getElementById('ss-screen-styles')) return;
  const s = document.createElement('style');
  s.id = 'ss-screen-styles';
  s.textContent = screenStyles;
  document.head.appendChild(s);
}

Object.assign(window, { injectScreenStyles });
