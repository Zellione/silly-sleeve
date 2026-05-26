// ─── Lorebook editor screen ───────────────────────────────
// SillyTavern-compatible lorebook entry editing. Two-pane:
// entries list (left) + entry detail editor (right).

const LB_STYLES = `
.lb-grid {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 18px;
  height: calc(100vh - 175px);
}
@media (max-width: 980px) {
  .lb-grid { grid-template-columns: 1fr; height: auto; }
}

/* === ENTRIES LIST === */
.lb-list {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  display: flex; flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.lb-list .lh {
  padding: 12px 14px;
  border-bottom: 1px solid var(--hair);
  display: flex; flex-direction: column; gap: 10px;
}
.lb-list .lh .row { justify-content: space-between; }
.lb-list .lh .name {
  font: 400 22px/1 var(--f-display); font-style: italic;
  margin: 0;
}
.lb-list .lh .meta {
  font: 500 10px/1.5 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}
.lb-list .lh .meta b { color: var(--ink-2); font-weight: 600; }
.lb-list .lh input.search {
  appearance: none;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 8px 10px 8px 30px;
  font: 12px/1 var(--f-sans);
  outline: none;
  width: 100%;
}
.lb-list .lh input.search:focus { border-color: var(--acc-line); }
.lb-list .lh .sr {
  position: relative;
}
.lb-list .lh .sr > svg {
  position: absolute; top: 8px; left: 9px;
  color: var(--ink-3);
}
.lb-entries {
  flex: 1; overflow-y: auto;
  padding: 8px;
  display: flex; flex-direction: column; gap: 4px;
}
.lb-entry {
  display: grid;
  grid-template-columns: 16px 30px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 9px 10px 9px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  color: var(--ink);
  font-family: var(--f-sans);
}
.lb-entry:hover { background: var(--bg); border-color: var(--hair); }
.lb-entry[data-on="1"] {
  background: var(--bg);
  border-color: var(--hair-strong);
  box-shadow: inset 3px 0 0 var(--acc);
}
.lb-entry[data-disabled="1"] { opacity: 0.45; }
.lb-entry .grip { color: var(--ink-3); cursor: grab; opacity: 0.4; }
.lb-entry .uid {
  font: 600 9.5px/1 var(--f-mono);
  color: var(--ink-3);
  letter-spacing: 0.08em;
  text-align: right;
  padding-right: 4px;
  border-right: 1px solid var(--hair);
}
.lb-entry .body { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.lb-entry .body b {
  font: 600 12.5px/1.2 var(--f-sans);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.lb-entry .body .keys {
  display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden;
}
.lb-entry .body .keys .k {
  font: 500 10px/1 var(--f-mono);
  padding: 3px 6px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 3px;
  white-space: nowrap;
  color: var(--ink-2);
}
.lb-entry .body .keys .k:first-child { background: var(--acc-soft); border-color: var(--acc-line); color: var(--acc); }
.lb-entry .body .keys .ko {
  font: 500 10px/1 var(--f-mono); color: var(--ink-3);
  align-self: center;
}
.lb-entry .meta {
  display: flex; flex-direction: column; gap: 3px; align-items: flex-end;
  font: 500 9.5px/1 var(--f-mono);
  color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.lb-entry .meta .ord { color: var(--ink-2); font-weight: 600; }
.lb-entry .meta .pos {
  padding: 2px 5px; border-radius: 3px;
  background: var(--panel-2); border: 1px solid var(--hair);
}
.lb-entry .meta .pos.constant { background: var(--acc-soft); color: var(--acc); border-color: var(--acc-line); }
.lb-entry .meta .pos.vec { color: oklch(0.55 0.18 280); }

/* character chips on entry list */
.lb-entry-chars {
  display: flex; gap: 3px; margin-top: 4px;
}
.lb-entry-chars .av {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--acc); color: var(--acc-fg);
  display: grid; place-items: center;
  font: 600 8.5px/1 var(--f-display); font-style: italic;
  border: 1px solid var(--panel);
}
.lb-entry-chars .global {
  font: 500 9px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  background: var(--panel-2);
  padding: 3px 5px;
  border-radius: 2px;
  border: 1px dashed var(--hair-strong);
}

/* linked-characters picker in detail */
.lb-char-picker {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.lb-char-chip {
  appearance: none;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px 5px 5px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 999px;
  cursor: pointer;
  color: var(--ink-2);
  font: 500 12px/1 var(--f-sans);
  transition: all .12s;
}
.lb-char-chip:hover { border-color: var(--hair-strong); }
.lb-char-chip[data-on="1"] {
  background: var(--acc); color: var(--acc-fg);
  border-color: var(--acc);
}
.lb-char-chip .av {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--acc); color: var(--acc-fg);
  display: grid; place-items: center;
  font: 600 11px/1 var(--f-display); font-style: italic;
  border: 1px solid var(--panel);
}
.lb-char-chip[data-on="1"] .av {
  background: var(--bg); color: var(--ink);
  border-color: transparent;
}
.lb-char-chip .ep {
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.08em;
  opacity: 0.55;
  padding-left: 8px;
  border-left: 1px solid currentColor;
}
.lb-global-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px dashed var(--hair-strong);
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--ink-2);
}
.lb-global-toggle.on {
  background: var(--acc-soft);
  border-color: var(--acc);
  border-style: solid;
  color: var(--ink);
}
.lb-list .lf {
  padding: 10px;
  border-top: 1px solid var(--hair);
  display: flex; gap: 6px;
}
.lb-list .lf .btn { flex: 1; justify-content: center; }

/* === DETAIL EDITOR === */
.lb-detail {
  background: var(--panel);
  border: 1px solid var(--hair);
  border-radius: 6px;
  display: flex; flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.lb-detail .dh {
  padding: 14px 20px;
  border-bottom: 1px solid var(--hair);
  display: flex; align-items: center; gap: 12px;
}
.lb-detail .dh .id-pill {
  font: 600 10px/1 var(--f-mono);
  padding: 4px 7px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 3px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
}
.lb-detail .dh input.title {
  flex: 1; min-width: 0;
  appearance: none;
  background: transparent;
  border: 0; outline: none;
  font: 400 24px/1 var(--f-display); font-style: italic;
  color: var(--ink);
  padding: 4px 0;
}
.lb-detail .dh input.title::placeholder { color: var(--ink-3); }
.lb-detail .dh .grow { flex: 1; }
.lb-detail .dh .tools { display: flex; gap: 6px; }
.lb-detail .db {
  flex: 1; overflow-y: auto;
  padding: 18px 20px 28px;
  display: flex; flex-direction: column; gap: 18px;
}

.lb-sect {
  display: flex; flex-direction: column; gap: 10px;
}
.lb-sect-h {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 2px;
}
.lb-sect-h h4 {
  margin: 0;
  font: 600 11px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--ink-3);
}
.lb-sect-h hr {
  flex: 1; border: 0; border-top: 1px solid var(--hair); margin: 0;
}

.lb-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.lb-row > label {
  padding-top: 9px;
  font: 600 11.5px/1.4 var(--f-sans);
  display: flex; flex-direction: column; gap: 3px;
}
.lb-row > label small {
  font: 400 10.5px/1.4 var(--f-sans);
  color: var(--ink-3);
  text-transform: none; letter-spacing: 0;
}

.lb-keys {
  display: flex; flex-wrap: wrap; gap: 5px;
  padding: 8px 10px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 4px;
  min-height: 40px; align-items: center;
}
.lb-keys input {
  flex: 1; min-width: 120px;
  border: 0; outline: none; background: transparent;
  font: 12.5px/1 var(--f-sans);
  padding: 4px 0;
}
.lb-keys.empty { background: transparent; border-style: dashed; }
.lb-key {
  display: inline-flex; align-items: center; gap: 5px;
  font: 500 11px/1 var(--f-mono);
  padding: 4px 6px 4px 8px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 3px;
  color: var(--ink-2);
}
.lb-key.primary { background: var(--acc-soft); border-color: var(--acc-line); color: var(--acc); }
.lb-key .x { color: inherit; opacity: 0.55; cursor: pointer; font: 600 12px/1 var(--f-mono); }
.lb-key .x:hover { opacity: 1; }

.lb-content {
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.lb-content .ch {
  padding: 6px 10px;
  border-bottom: 1px solid var(--hair);
  display: flex; align-items: center; gap: 10px;
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}
.lb-content .ch .grow { flex: 1; }
.lb-content textarea {
  appearance: none;
  background: transparent;
  border: 0; outline: none; resize: vertical;
  padding: 12px 14px;
  font: 13px/1.6 var(--f-sans);
  color: var(--ink);
  min-height: 180px;
}
.lb-content .cf {
  padding: 6px 10px;
  border-top: 1px solid var(--hair);
  display: flex; align-items: center; gap: 10px;
  font: 500 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
  background: var(--panel-2);
}
.lb-content .cf .grow { flex: 1; }
.lb-content .cf b { color: var(--ink-2); font-weight: 600; }

.lb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lb-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
@media (max-width: 800px) { .lb-grid-2, .lb-grid-3 { grid-template-columns: 1fr; } }

.lb-mini {
  display: flex; flex-direction: column; gap: 6px;
}
.lb-mini label {
  font: 600 10px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--ink-3);
}
.lb-mini input[type="number"], .lb-mini select, .lb-mini input[type="text"] {
  appearance: none;
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 8px 10px;
  font: 500 12px/1 var(--f-mono);
  color: var(--ink);
  outline: none;
}
.lb-mini select { font-family: var(--f-sans); }
.lb-mini .help { font: 400 10.5px/1.4 var(--f-sans); color: var(--ink-3); }

/* segmented selector (for selectiveLogic etc.) */
.lb-seg {
  display: flex;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 3px;
  gap: 2px;
}
.lb-seg button {
  flex: 1;
  appearance: none; border: 0; background: transparent;
  font: 500 11px/1 var(--f-sans);
  color: var(--ink-2); cursor: pointer;
  padding: 7px 6px;
  border-radius: 3px;
  display: flex; align-items: center; justify-content: center; gap: 4px;
}
.lb-seg button[data-on="1"] {
  background: var(--ink);
  color: var(--bg);
}
.lb-seg button .k {
  font: 500 9px/1 var(--f-mono);
  opacity: 0.6;
  margin-left: 2px;
}

/* toggle row */
.lb-toggle-row {
  display: grid; grid-template-columns: 1fr auto; gap: 10px;
  align-items: center; padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
}
.lb-toggle-row > div { display: flex; flex-direction: column; gap: 2px; }
.lb-toggle-row > div > b { font: 600 12px/1.2 var(--f-sans); }
.lb-toggle-row > div > small { font: 400 11px/1.4 var(--f-sans); color: var(--ink-3); }
.lb-toggle-row > button {
  position: relative;
  width: 32px; height: 18px;
  border: 0; padding: 0;
  border-radius: 999px;
  background: var(--hair-strong);
  cursor: pointer;
  flex-shrink: 0;
}
.lb-toggle-row > button[data-on="1"] { background: var(--acc); }
.lb-toggle-row > button i {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff;
  transition: transform .15s;
}
.lb-toggle-row > button[data-on="1"] i { transform: translateX(14px); }

/* position cards */
.lb-positions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
@media (max-width: 980px) { .lb-positions { grid-template-columns: repeat(3, 1fr); } }
.lb-pos {
  appearance: none;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 8px 10px;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 3px;
  color: var(--ink-2);
}
.lb-pos:hover { border-color: var(--hair-strong); }
.lb-pos[data-on="1"] {
  background: var(--acc-soft);
  border-color: var(--acc);
  color: var(--ink);
}
.lb-pos > b { font: 600 11.5px/1.2 var(--f-sans); display: flex; align-items: center; gap: 6px; }
.lb-pos > b .ix {
  font: 600 9px/1 var(--f-mono);
  background: var(--panel-2);
  padding: 2px 4px; border-radius: 2px;
  color: var(--ink-3);
}
.lb-pos[data-on="1"] > b .ix { background: var(--acc); color: var(--acc-fg); }
.lb-pos > small { font: 400 10.5px/1.4 var(--f-sans); color: var(--ink-3); }

/* probability slider */
.prob-bar {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 10px 12px;
}
.prob-bar input[type="range"] { flex: 1; accent-color: var(--acc); }
.prob-bar .val { font: 600 12px/1 var(--f-mono); width: 48px; text-align: right; }
.prob-bar .val::after { content: "%"; color: var(--ink-3); margin-left: 1px; }

/* import/export bar */
.lb-meta-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 14px;
  background: var(--panel-2);
  border-top: 1px solid var(--hair);
  font: 500 10.5px/1 var(--f-mono);
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-3);
}
.lb-meta-bar .grow { flex: 1; }
.lb-meta-bar b { color: var(--ink-2); font-weight: 600; }
`;

function injectLbStyles() {
  if (document.getElementById('lb-styles')) return;
  const s = document.createElement('style');
  s.id = 'lb-styles';
  s.textContent = LB_STYLES;
  document.head.appendChild(s);
}

// ─── Mock entries ─────────────────────────────────────────
const POSITIONS = [
  { i: 0, name: 'Before Char Defs',     hint: 'Top of context — system frame' },
  { i: 1, name: 'After Char Defs',      hint: 'Just after the character card' },
  { i: 2, name: 'Before Example Msgs',  hint: 'Ahead of <START> examples' },
  { i: 3, name: 'After Example Msgs',   hint: 'After <START> examples' },
  { i: 4, name: '@ Depth (in chat)',    hint: 'Injected N messages back · uses depth' },
  { i: 5, name: 'Before Author Note',   hint: 'Just above the author note' },
  { i: 6, name: 'After Author Note',    hint: 'Below the author note' },
];

const SEL_LOGIC = [
  { v: 0, label: 'AND ANY' },
  { v: 1, label: 'NOT ALL' },
  { v: 2, label: 'NOT ANY' },
  { v: 3, label: 'AND ALL' },
];

const SEED_ENTRIES = [
  {
    uid: 0, comment: 'The Harpers — Faction', key: ['Harpers', 'Harper', 'master harper', 'silver harp'],
    keysecondary: ['network', 'spy'],
    content: `[Faction] The Harpers are a secretive network of spies, scholars and minstrels dedicated to preserving balance across Faerûn. [allegiance: neutral good; founded: -1500 DR; symbol: silver harp between crescent moons]. They prefer ballads and tavern gossip to open war; an active cell operates in Baldur's Gate, fronted by the Elfsong tavern. Members carry a token harp pin worn under the collar.`,
    constant: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 100, position: 0, disable: false, probability: 100, useProbability: true,
    depth: 4, sticky: 0, vectorized: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    characters: ['C1', 'C3'],
  },
  {
    uid: 1, comment: 'The Elfsong tavern', key: ['Elfsong', 'tavern', 'Olly'],
    keysecondary: [],
    content: `[Location] The Elfsong is a three-storey tavern on the dockside of Baldur's Gate, named for the disembodied elven voice that sings every night at midnight (origin unknown — local rumour says a murdered chorister). [size: 40 patrons; owner: Alan Alyth; haunted: yes]. Harpers use the back booths as a dead-drop. Elara performs here twice a week.`,
    constant: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 80, position: 1, disable: false, probability: 100, useProbability: true,
    depth: 4, sticky: 0, vectorized: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    characters: ['C1', 'C2'],
  },
  {
    uid: 2, comment: 'Reithwin & the Shadow-curse', key: ['Reithwin', 'shadow-curse', 'Kethric', 'Moonrise'],
    keysecondary: ['curse', 'thorm'],
    content: `[Region · cursed] Reithwin Town in the Shadow-cursed Lands was Elara's birthplace, lost to a magical darkness perpetrated by General Kethric Thorm of the Absolute. [status: ruined; population: ~0 living; visibility: torch-radius only]. The trauma surfaces if travel north of Baldur's Gate is mentioned.`,
    constant: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 60, position: 4, disable: false, probability: 80, useProbability: true,
    depth: 3, sticky: 0, vectorized: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    characters: ['C1'],
  },
  {
    uid: 3, comment: 'Songthorn (rapier)', key: ['Songthorn', 'rapier', 'her sword', 'her weapon'],
    keysecondary: [],
    content: `[Item] Songthorn is a slender duelling rapier with a basket hilt of black-iron wire and a fingerlength resonator-rune set into the pommel. [damage: 1d8 piercing; bonus: +1; property: chimes once when drawn]. Gifted by her Harper handler, the chime serves as a Harper recognition signal.`,
    constant: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 40, position: 1, disable: false, probability: 100, useProbability: false,
    depth: 4, sticky: 0, vectorized: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: true,
    characters: ['C1'],
  },
  {
    uid: 4, comment: 'World — Faerûn baseline', key: ['Faerûn', 'Sword Coast', 'Toril'],
    keysecondary: [],
    content: `[World] Forgotten Realms · 1492 DR. Sword Coast region. Magic is public and regulated by the Watchful Order; gods walk in legend more than fact. Coin is electrum.`,
    constant: true, selective: false, selectiveLogic: 0, addMemo: true,
    order: 200, position: 0, disable: false, probability: 100, useProbability: true,
    depth: 4, sticky: 0, vectorized: false, ignoreBudget: true, excludeRecursion: false, preventRecursion: false,
    characters: ['C1', 'C2', 'C3'],
  },
  {
    uid: 5, comment: 'Elfsong — disembodied voice (vec)', key: ['voice', 'singing', 'midnight'],
    keysecondary: [],
    content: `[Vector entry] The midnight elfsong sings in a dead dialect of Sylvan; modern listeners recall it as a lullaby their grandparents knew. The verses change nightly.`,
    constant: false, selective: false, selectiveLogic: 0, addMemo: true,
    order: 50, position: 4, disable: true, probability: 100, useProbability: true,
    depth: 4, sticky: 2, vectorized: true, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    characters: [],
  },
];

// ─── helpers ──────────────────────────────────────────────
function TokenInput({ value, onChange, accentFirst = false, placeholder }) {
  const [draft, setDraft] = React.useState('');
  const submit = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className={'lb-keys' + (value.length === 0 && !draft ? ' empty' : '')}>
      {value.map((k, i) => (
        <span key={k + i} className={'lb-key' + (accentFirst && i === 0 ? ' primary' : '')}>
          {k}
          <span className="x" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</span>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); submit(); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        placeholder={value.length ? 'Add another…' : (placeholder || 'Type and press Enter…')}
      />
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button data-on={value ? '1' : '0'} onClick={() => onChange(!value)}>
      <i/>
    </button>
  );
}

function ToggleRow({ label, hint, value, onChange }) {
  return (
    <div className="lb-toggle-row">
      <div><b>{label}</b><small>{hint}</small></div>
      <Toggle value={value} onChange={onChange}/>
    </div>
  );
}

// ─── Detail editor ────────────────────────────────────────
function LbDetail({ entry, onChange, characters = [] }) {
  if (!entry) return (
    <div className="lb-detail" style={{display:'grid', placeItems:'center', color:'var(--ink-3)'}}>
      <div className="col" style={{alignItems:'center', textAlign:'center', gap:8}}>
        <I.Book size={36} style={{opacity:0.4}}/>
        <div className="serif-i" style={{fontSize:24, color:'var(--ink-2)'}}>Pick an entry to edit</div>
        <div className="helpr">Or add a new one with the button below.</div>
      </div>
    </div>
  );

  const set = (k, v) => onChange({ ...entry, [k]: v });
  const tokenCount = Math.round(entry.content.length / 4);
  const linkedChars = entry.characters || [];
  const isGlobal = linkedChars.length === 0;
  const toggleChar = (id) => {
    const next = linkedChars.includes(id)
      ? linkedChars.filter(x => x !== id)
      : [...linkedChars, id];
    set('characters', next);
  };

  return (
    <div className="lb-detail">
      <div className="dh">
        <span className="id-pill">UID · {String(entry.uid).padStart(3, '0')}</span>
        <input className="title" value={entry.comment} onChange={e => set('comment', e.target.value)}
               placeholder="Entry name…" />
        <div className="tools">
          <button className="btn ghost icon" title="Duplicate"><I.Copy size={14}/></button>
          <button className="btn ghost icon" title="Test trigger"><I.Bolt size={14}/></button>
          <button className="btn ghost icon" title="Re-roll with AI"><I.Reroll size={14}/></button>
          <button className="btn ghost icon" title="Delete"><I.Trash size={14}/></button>
        </div>
      </div>

      <div className="db scroll">
        {/* === KEYS === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Triggers</h4><hr/></div>

          <div className="lb-row">
            <label>Primary keys
              <small>Any match activates this entry.</small>
            </label>
            <TokenInput value={entry.key} onChange={v => set('key', v)} accentFirst
                        placeholder='e.g. "Harpers", "silver harp"…'/>
          </div>

          <div className="lb-row">
            <label>Secondary keys
              <small>Combined with primary via the logic below.</small>
            </label>
            <TokenInput value={entry.keysecondary} onChange={v => set('keysecondary', v)}
                        placeholder="Optional…"/>
          </div>

          <div className="lb-row">
            <label>Selective logic
              <small>How primary &amp; secondary keys combine.</small>
            </label>
            <div className="lb-grid-2">
              <div className="lb-seg">
                {SEL_LOGIC.map(o => (
                  <button key={o.v} data-on={entry.selectiveLogic === o.v ? '1' : '0'}
                          onClick={() => set('selectiveLogic', o.v)}>
                    {o.label} <span className="k">{o.v}</span>
                  </button>
                ))}
              </div>
              <ToggleRow label="Selective" hint="Require secondary keys"
                         value={entry.selective} onChange={v => set('selective', v)}/>
            </div>
          </div>
        </div>

        {/* === LINKED CHARACTERS === */}
        {characters.length > 0 && (
          <div className="lb-sect">
            <div className="lb-sect-h"><h4>Linked characters</h4><hr/></div>
            <div className="lb-row">
              <label>Scope
                <small>Pick which characters this entry attaches to on export. If none, it's a project-wide entry.</small>
              </label>
              <div className="col" style={{gap:10}}>
                <button
                  className={'lb-global-toggle' + (isGlobal ? ' on' : '')}
                  onClick={() => set('characters', isGlobal ? [characters[0].id] : [])}
                  style={{cursor:'pointer', background: isGlobal ? 'var(--acc-soft)' : 'transparent'}}>
                  {isGlobal ? <I.Check size={13} style={{color:'var(--acc)'}}/> : <I.X size={13}/>}
                  <span><b>{isGlobal ? 'Project-wide' : 'Per-character'}</b> · {isGlobal
                    ? 'every exported character carries this entry'
                    : `linked to ${linkedChars.length} of ${characters.length}`}</span>
                </button>
                {!isGlobal && (
                  <div className="lb-char-picker">
                    {characters.map(c => {
                      const on = linkedChars.includes(c.id);
                      return (
                        <button key={c.id} className="lb-char-chip"
                                data-on={on ? '1' : '0'}
                                onClick={() => toggleChar(c.id)}>
                          <span className="av">{c.initial}</span>
                          <span>{c.name}</span>
                          {c.epithet && <span className="ep">{c.epithet}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === CONTENT === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Content</h4><hr/></div>
          <div className="lb-content">
            <div className="ch">
              <I.Pen size={11}/> <span>Injected verbatim when triggered</span>
              <span className="grow"/>
              <button className="btn ghost sm"><I.Reroll size={11}/> Re-roll</button>
            </div>
            <textarea value={entry.content} onChange={e => set('content', e.target.value)} spellCheck={false}/>
            <div className="cf">
              <span><b>{entry.content.length.toLocaleString()}</b> chars</span>
              <span><b>~{tokenCount.toLocaleString()}</b> tokens</span>
              <span className="grow"/>
              <span>Markdown · macros</span>
            </div>
          </div>
        </div>

        {/* === POSITION === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Position in context</h4><hr/></div>
          <div className="lb-positions">
            {POSITIONS.map(p => (
              <button key={p.i} className="lb-pos" data-on={entry.position === p.i ? '1' : '0'}
                      onClick={() => set('position', p.i)}>
                <b><span className="ix">{p.i}</span>{p.name}</b>
                <small>{p.hint}</small>
              </button>
            ))}
          </div>
          {entry.position === 4 && (
            <div className="lb-row">
              <label>Depth
                <small>Injected N messages back into chat history.</small>
              </label>
              <div className="lb-mini" style={{maxWidth:200}}>
                <input type="number" min={0} max={64} value={entry.depth}
                       onChange={e => set('depth', +e.target.value)}/>
              </div>
            </div>
          )}
        </div>

        {/* === ACTIVATION === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Activation</h4><hr/></div>

          <div className="lb-grid-3">
            <div className="lb-mini">
              <label>Order</label>
              <input type="number" value={entry.order} onChange={e => set('order', +e.target.value)}/>
              <span className="help">Higher = inserted first.</span>
            </div>
            <div className="lb-mini">
              <label>Sticky</label>
              <input type="number" min={0} value={entry.sticky} onChange={e => set('sticky', +e.target.value)}/>
              <span className="help">Stay active N messages after trigger.</span>
            </div>
            <div className="lb-mini">
              <label>UID</label>
              <input type="number" value={entry.uid} disabled style={{opacity:0.6}}/>
              <span className="help">Auto-assigned on save.</span>
            </div>
          </div>

          <div className="lb-row">
            <label>Probability
              <small>Chance the entry fires when keys match.</small>
            </label>
            <div className="col" style={{gap:8}}>
              <div className="prob-bar">
                <input type="range" min={0} max={100} value={entry.probability}
                       disabled={!entry.useProbability}
                       onChange={e => set('probability', +e.target.value)}/>
                <span className="val">{entry.probability}</span>
              </div>
              <ToggleRow label="Use probability" hint="Off = always fire when keys match (100%)"
                         value={entry.useProbability} onChange={v => set('useProbability', v)}/>
            </div>
          </div>
        </div>

        {/* === BEHAVIOR === */}
        <div className="lb-sect">
          <div className="lb-sect-h"><h4>Behavior</h4><hr/></div>
          <div className="lb-grid-2">
            <ToggleRow label="Constant ⚓" hint="Always active — ignores keys"
                       value={entry.constant} onChange={v => set('constant', v)}/>
            <ToggleRow label="Vectorized 🔍" hint="Trigger via semantic match"
                       value={entry.vectorized} onChange={v => set('vectorized', v)}/>
            <ToggleRow label="Add as memo" hint="Show in the chat memo panel"
                       value={entry.addMemo} onChange={v => set('addMemo', v)}/>
            <ToggleRow label="Ignore budget" hint="Always inject, even past token limit"
                       value={entry.ignoreBudget} onChange={v => set('ignoreBudget', v)}/>
            <ToggleRow label="Exclude from recursion" hint="This entry's content won't trigger others"
                       value={entry.excludeRecursion} onChange={v => set('excludeRecursion', v)}/>
            <ToggleRow label="Prevent further recursion" hint="Stop chain when this fires"
                       value={entry.preventRecursion} onChange={v => set('preventRecursion', v)}/>
            <ToggleRow label="Disabled" hint="Skip during context build"
                       value={entry.disable} onChange={v => set('disable', v)}/>
          </div>
        </div>

      </div>

      <div className="lb-meta-bar">
        <span><b>Pos</b> {POSITIONS[entry.position]?.name || '—'}</span>
        <span><b>Order</b> {entry.order}</span>
        <span><b>P</b> {entry.useProbability ? entry.probability + '%' : '∞'}</span>
        {entry.constant && <span style={{color:'var(--acc)'}}>⚓ constant</span>}
        {entry.vectorized && <span style={{color:'oklch(0.55 0.18 280)'}}>🔍 vector</span>}
        {entry.disable && <span style={{color:'var(--bad)'}}>✕ disabled</span>}
        <span className="grow"/>
        <span><b>Last saved</b> just now</span>
      </div>
    </div>
  );
}

// ─── Lorebook screen ──────────────────────────────────────
function Lorebook({ onContinue, characters = [] }) {
  React.useEffect(injectLbStyles, []);
  const [entries, setEntries] = React.useState(SEED_ENTRIES);
  const [selectedUid, setSelectedUid] = React.useState(0);
  const [search, setSearch] = React.useState('');

  const filtered = entries.filter(e =>
    !search ||
    e.comment.toLowerCase().includes(search.toLowerCase()) ||
    e.key.some(k => k.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = entries.find(e => e.uid === selectedUid);
  const updateSelected = (updated) => {
    setEntries(entries.map(e => e.uid === updated.uid ? updated : e));
  };

  const addEntry = () => {
    const uid = Math.max(...entries.map(e => e.uid), -1) + 1;
    const fresh = {
      uid, comment: 'New entry', key: [], keysecondary: [], content: '',
      constant: false, selective: false, selectiveLogic: 0, addMemo: true,
      order: 100, position: 0, disable: false, probability: 100, useProbability: true,
      depth: 4, sticky: 0, vectorized: false, ignoreBudget: false,
      excludeRecursion: false, preventRecursion: false,
      characters: [],
    };
    setEntries([...entries, fresh]);
    setSelectedUid(uid);
  };

  const active = entries.filter(e => !e.disable).length;
  const totalTokens = entries.reduce((s, e) => s + Math.round(e.content.length / 4), 0);

  return (
    <>
      <PageHead step={3} subtitle="Build the world around them"
        title={<>Author the <em style={{fontStyle:'normal',color:'var(--acc)'}}>lorebook</em></>}
        actions={
          <>
            <button className="btn ghost"><I.Upload size={13}/> Import .json</button>
            <button className="btn primary" onClick={onContinue}>Continue to Portrait <I.Arrow size={14}/></button>
          </>
        } />
      <div className="ss-page-body scroll">
        <div className="lb-grid">
          {/* LEFT — list */}
          <div className="lb-list">
            <div className="lh">
              <div className="row">
                <h3 className="name">Elara's lorebook</h3>
                <button className="btn ghost icon" title="Book settings"><I.Cog size={14}/></button>
              </div>
              <div className="meta">
                <b>{entries.length}</b> entries · <b>{active}</b> active · ~<b>{totalTokens.toLocaleString()}</b> tokens
              </div>
              <div className="sr">
                <I.Search size={13}/>
                <input className="search" placeholder="Search by name or trigger key…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
            </div>

            <div className="lb-entries scroll">
              {filtered.sort((a, b) => b.order - a.order).map(e => (
                <button key={e.uid} className="lb-entry"
                        data-on={selectedUid === e.uid ? '1' : '0'}
                        data-disabled={e.disable ? '1' : '0'}
                        onClick={() => setSelectedUid(e.uid)}>
                  <span className="grip"><I.Drag size={12}/></span>
                  <span className="uid">{String(e.uid).padStart(2, '0')}</span>
                  <div className="body">
                    <b>{e.comment || 'Untitled'}</b>
                    <div className="keys">
                      {e.key.slice(0, 3).map((k, i) => <span key={i} className="k">{k}</span>)}
                      {e.key.length > 3 && <span className="ko">+{e.key.length - 3}</span>}
                      {e.key.length === 0 && <span className="ko">no keys</span>}
                    </div>
                    {characters.length > 0 && (
                      <div className="lb-entry-chars">
                        {e.characters.length === 0 ? (
                          <span className="global">global</span>
                        ) : (
                          e.characters.map(cid => {
                            const c = characters.find(x => x.id === cid);
                            return c ? <span key={cid} className="av" title={c.name}>{c.initial}</span> : null;
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <div className="meta">
                    <span className="ord">{e.order}</span>
                    <span className={'pos' + (e.constant ? ' constant' : '') + (e.vectorized ? ' vec' : '')}>
                      {e.constant ? '⚓' : e.vectorized ? '🔍' : `P${e.position}`}
                    </span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{padding:'30px 12px', textAlign:'center', color:'var(--ink-3)', fontSize:12}}>
                  No entries match "{search}".
                </div>
              )}
            </div>

            <div className="lf">
              <button className="btn primary" onClick={addEntry}><I.Plus size={13}/> New entry</button>
              <button className="btn ghost icon" title="Sort by order"><I.Filter size={14}/></button>
            </div>
          </div>

          {/* RIGHT — detail */}
          <LbDetail entry={selected} onChange={updateSelected} characters={characters}/>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Lorebook });
