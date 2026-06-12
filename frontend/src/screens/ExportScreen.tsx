import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  CheckIcon, DownloadIcon, FolderIcon, ImageIcon, SaveIcon, BookIcon,
} from '../icons';
import {
  GetCharacters, GetLorebook, ExportCharactersBulk, ExportLorebook,
  PickExportFolder, PickSaveBundle, SaveProjectBundle,
} from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { compose, lorebook, cardexport } from '../../wailsjs/go/models';

interface FormatOption {
  id: string;
  name: string;
  sub: string;
  icon: React.FC<{ size?: number }>;
  ext: string;
}

const FORMATS: FormatOption[] = [
  { id: 'png-v2', name: 'Character PNG · v2 spec', sub: 'portrait + embedded JSON · SillyTavern-ready', icon: ImageIcon, ext: 'png' },
  { id: 'png-v3', name: 'Character PNG · v3 (CCv3)', sub: '+ embedded lorebook + asset library', icon: ImageIcon, ext: 'png' },
  { id: 'json', name: 'JSON only', sub: 'no portrait · clean for diffs', icon: SaveIcon, ext: 'json' },
  { id: 'bundle', name: 'Silly Sleeve bundle (.slv)', sub: 'everything · re-importable', icon: FolderIcon, ext: 'slv' },
];

type QueueStatus = 'queued' | 'writing' | 'done' | 'error';

const plural = (n: number): string => (n === 1 ? '' : 's');

const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  queued: 'queued',
  writing: 'writing…',
  done: 'done',
  error: 'failed',
};

// Split on runs of non-alphanumerics (a single bounded character class — linear,
// no catastrophic backtracking) then rejoin with dashes. `filter(Boolean)` drops
// the empty segments that leading/trailing separators produce, so this trims and
// collapses dashes without the ReDoS-prone `/^-+|-+$/g` trim regex (S5852).
const slugify = (name: string): string =>
  (name || 'character').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('-') || 'character';

const ExportScreen: React.FC = () => {
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [entries, setEntries] = useState<lorebook.Entry[]>([]);
  const [fmt, setFmt] = useState('png-v2');
  const [pickedChars, setPickedChars] = useState<number[]>([]);
  const [pickedEntries, setPickedEntries] = useState<number[]>([]);
  const [destination, setDestination] = useState('');
  const [exporting, setExporting] = useState(false);
  const [queue, setQueue] = useState<Record<number, QueueStatus>>({});

  // Embedding options
  const [embedLore, setEmbedLore] = useState(true);
  const [scopePerChar, setScopePerChar] = useState(true);
  const [includeGreetings, setIncludeGreetings] = useState(true);
  const [stripMeta, setStripMeta] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    GetCharacters().then(chars => {
      setCharacters(chars);
      setPickedChars(chars.map(c => c.id));
    }).catch(() => {});
    GetLorebook().then(es => {
      setEntries(es || []);
      setPickedEntries((es || []).map(e => e.uid));
    }).catch(() => {});
  }, []);

  // Drive the export queue panel from backend progress events.
  useEffect(() => {
    EventsOn('export:progress', (p: { charId: number; status: QueueStatus }) => {
      setQueue(prev => ({ ...prev, [p.charId]: p.status }));
    });
    return () => EventsOff('export:progress');
  }, []);

  const isPng = fmt === 'png-v2' || fmt === 'png-v3';
  const ext = FORMATS.find(f => f.id === fmt)?.ext ?? 'png';

  const toggleChar = (id: number) =>
    setPickedChars(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleEntry = (uid: number) =>
    setPickedEntries(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const handlePickFolder = useCallback(async () => {
    try {
      const folder = await PickExportFolder();
      if (folder) setDestination(folder);
    } catch {
      // user cancelled
    }
  }, []);

  const handleExportLorebook = useCallback(async () => {
    if (pickedEntries.length === 0 || !destination) return;
    try {
      await ExportLorebook(destination);
      toast({ kind: 'ok', title: 'Lorebook exported', body: `${pickedEntries.length} entries written to ${destination}.` });
    } catch {
      toast({ kind: 'bad', title: 'Lorebook export failed', body: 'Could not write world_info.json.' });
    }
  }, [pickedEntries.length, destination, toast]);

  const exportBundle = useCallback(async () => {
    try {
      const path = await PickSaveBundle();
      if (!path) return;
      setExporting(true);
      await SaveProjectBundle(path);
      toast({ kind: 'ok', title: 'Bundle saved', body: `Project written to ${path}.` });
    } catch {
      toast({ kind: 'bad', title: 'Bundle save failed', body: 'Could not write the .slv bundle.' });
    } finally {
      setExporting(false);
    }
  }, [toast]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    if (fmt === 'bundle') {
      await exportBundle();
      return;
    }
    if (pickedChars.length === 0 || !destination) return;

    const opts = cardexport.Options.createFrom({
      EmbedLorebook: embedLore,
      ScopePerChar: scopePerChar,
      IncludeGreetings: includeGreetings,
      StripMetadata: stripMeta,
    });

    setExporting(true);
    setQueue(Object.fromEntries(pickedChars.map(id => [id, 'queued' as QueueStatus])));
    try {
      const res = await ExportCharactersBulk(pickedChars, fmt, opts, destination);
      if (res.failed === 0) {
        toast({ kind: 'ok', title: 'Export complete', body: `${res.exported} character${plural(res.exported)} written to ${destination}.` });
      } else {
        toast({ kind: 'warn', title: 'Export partial', body: `${res.exported} exported, ${res.failed} failed.` });
      }
    } catch {
      toast({ kind: 'bad', title: 'Export failed', body: 'Could not write character cards.' });
    } finally {
      setExporting(false);
    }
  }, [exporting, fmt, pickedChars, destination, embedLore, scopePerChar, includeGreetings, stripMeta, exportBundle, toast]);

  const destReady = fmt === 'bundle' || (pickedChars.length > 0 && !!destination);

  let exportLabel: React.ReactNode;
  if (exporting) {
    exportLabel = 'Exporting…';
  } else if (fmt === 'bundle') {
    exportLabel = <><DownloadIcon size={14} /> Save bundle</>;
  } else {
    exportLabel = <><DownloadIcon size={14} /> Export {pickedChars.length} character{plural(pickedChars.length)}</>;
  }

  const treePaths = useMemo(
    () => pickedChars
      .map(id => characters.find(c => c.id === id))
      .filter((c): c is compose.Character => !!c)
      .map(c => ({ id: c.id, label: `  ├ ${slugify(c.name)}.${ext}` })),
    [pickedChars, characters, ext],
  );

  return (
    <>
      <PageHead step={7} subtitle="Ship the project"
        title={<>Export <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>everything</em></>}
        actions={
          <>
            <button className="btn ghost" disabled={pickedEntries.length === 0 || !destination} onClick={handleExportLorebook}>
              <BookIcon size={13} /> Export lorebook ({pickedEntries.length})
            </button>
            <button className="btn primary" onClick={handleExport} disabled={exporting || !destReady}>
              {exportLabel}
            </button>
          </>
        } />

      <div className="ss-page-body scroll">
        <div className="col" style={{ gap: 18 }}>
          {/* Characters picker */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0 }}>Characters</h4>
                <span className="uplabel" style={{ color: 'var(--ink-3)' }}>{pickedChars.length} of {characters.length} selected</span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn ghost sm" onClick={() => setPickedChars(characters.map(c => c.id))}>All</button>
                <button className="btn ghost sm" onClick={() => setPickedChars([])}>None</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {characters.map(c => {
                const on = pickedChars.includes(c.id);
                return (
                  <button key={c.id} className="btn ghost"
                    style={{
                      background: on ? 'var(--acc-soft)' : undefined,
                      borderColor: on ? 'var(--acc)' : undefined,
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    }}
                    onClick={() => toggleChar(c.id)}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: on ? 'var(--acc)' : 'var(--hair-strong)',
                      color: on ? 'var(--acc-fg)' : 'var(--ink-3)',
                      display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 600, flexShrink: 0,
                    }}>
                      {on ? <CheckIcon size={10} /> : c.name[0] || '?'}
                    </span>
                    <span style={{ fontWeight: 500 }}>{c.name || 'Untitled'}</span>
                    {c.epithet && <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{c.epithet}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lorebook entries picker */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0 }}>Lorebook entries</h4>
                <span className="uplabel" style={{ color: 'var(--ink-3)' }}>{pickedEntries.length} of {entries.length} selected</span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn ghost sm" onClick={() => setPickedEntries(entries.map(e => e.uid))}>All</button>
                <button className="btn ghost sm" onClick={() => setPickedEntries([])}>None</button>
              </div>
            </div>
            {entries.length === 0 ? (
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>No lorebook entries in this project.</span>
            ) : (
              <div className="col" style={{ gap: 4 }}>
                {entries.map(e => {
                  const on = pickedEntries.includes(e.uid);
                  return (
                    <button key={e.uid} className="btn ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', justifyContent: 'flex-start',
                        background: on ? 'var(--acc-soft)' : undefined, borderColor: on ? 'var(--acc)' : undefined,
                      }}
                      onClick={() => toggleEntry(e.uid)}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 5,
                        background: on ? 'var(--acc)' : 'var(--hair-strong)', color: 'var(--acc-fg)',
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}>
                        {on && <CheckIcon size={11} />}
                      </span>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                        {String(e.uid).padStart(2, '0')}
                      </span>
                      <span style={{ fontWeight: 500 }}>{e.comment || 'Untitled entry'}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                        P{e.position} · {e.order}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Format picker */}
          <div className="card">
            <h4 style={{ margin: '0 0 10px' }}>Export format</h4>
            <div className="col" style={{ gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f.id} className="btn ghost"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: fmt === f.id ? 'var(--acc-soft)' : undefined,
                    borderColor: fmt === f.id ? 'var(--acc)' : undefined,
                    justifyContent: 'flex-start', width: '100%',
                  }}
                  onClick={() => setFmt(f.id)}>
                  <f.icon size={18} />
                  <div style={{ textAlign: 'left' }}>
                    <b style={{ display: 'block' }}>{f.name}</b>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{f.sub}</span>
                  </div>
                </button>
              ))}
            </div>

            {isPng && (
              <>
                <div style={{ height: 1, background: 'var(--hair)', margin: '12px 0' }} />
                <div className="col" style={{ gap: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input type="checkbox" checked={embedLore} onChange={() => setEmbedLore(v => !v)} style={{ accentColor: 'var(--acc)' }} />
                    <span>Embed lorebook in each character (CCv3)</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input type="checkbox" checked={scopePerChar} onChange={() => setScopePerChar(v => !v)} style={{ accentColor: 'var(--acc)' }} />
                    <span>Scope to per-character links</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input type="checkbox" checked={includeGreetings} onChange={() => setIncludeGreetings(v => !v)} style={{ accentColor: 'var(--acc)' }} />
                    <span>Include greeting messages</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input type="checkbox" checked={stripMeta} onChange={() => setStripMeta(v => !v)} style={{ accentColor: 'var(--acc)' }} />
                    <span>Strip generation metadata</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Destination */}
          {fmt !== 'bundle' && (
            <div className="card">
              <h4 style={{ margin: '0 0 10px' }}>Destination</h4>
              <div className="row" style={{ gap: 8 }}>
                <input className="field"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Choose or type a folder path…"
                  style={{ fontFamily: 'var(--f-mono)', fontSize: 12, flex: 1 }} />
                <button className="btn ghost icon" onClick={handlePickFolder} title="Browse…">
                  <FolderIcon size={14} />
                </button>
              </div>
              {treePaths.length > 0 && (
                <div style={{ marginTop: 10, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>└─ characters/</span>
                  {treePaths.map(p => <span key={p.id}>{p.label}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Summary</h4>
            <div className="col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Characters</span><b>{pickedChars.length}</b>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Lore entries</span><b>{pickedEntries.length}</b>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Format</span><b className="mono" style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>{fmt}</b>
              </div>
            </div>
          </div>

          {/* Export queue */}
          {exporting && fmt !== 'bundle' && (
            <div className="card">
              <h4 style={{ margin: '0 0 8px' }}>Export queue</h4>
              <div className="col" style={{ gap: 6 }}>
                {pickedChars.map(id => {
                  const c = characters.find(x => x.id === id);
                  const status = queue[id] ?? 'queued';
                  return (
                    <div key={id} className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {status === 'done'
                          ? <CheckIcon size={11} />
                          : <span className={`dot ${status === 'writing' ? 'warn' : 'idle'}`} style={{ boxShadow: 'none' }} />}
                        {c?.name || 'Untitled'}
                      </span>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                        {QUEUE_STATUS_LABEL[status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ExportScreen;
