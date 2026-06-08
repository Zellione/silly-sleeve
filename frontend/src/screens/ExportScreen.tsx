import React, { useState, useEffect, useCallback } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  CheckIcon, DownloadIcon, FolderIcon, ImageIcon, SaveIcon,
} from '../icons';
import {
  GetCharacters, ExportCharacter, PickExportFolder,
} from '../../wailsjs/go/main/App';
import { compose } from '../../wailsjs/go/models';

interface FormatOption {
  id: string;
  name: string;
  sub: string;
  icon: React.FC<{ size?: number }>;
  enabled: boolean;
  tooltip?: string;
}

const FORMATS: FormatOption[] = [
  { id: 'json', name: 'JSON only', sub: 'no portrait · clean for diffs', icon: SaveIcon, enabled: true },
  { id: 'png-v2', name: 'Character PNG · v2 spec', sub: 'portrait + embedded JSON · SillyTavern-ready', icon: ImageIcon, enabled: false, tooltip: 'Coming in Phase 3' },
  { id: 'png-v3', name: 'Character PNG · v3 (CCv3)', sub: '+ embedded lorebook + asset library', icon: ImageIcon, enabled: false, tooltip: 'Coming in Phase 3' },
  { id: 'bundle', name: 'Silly Sleeve bundle (.slv)', sub: 'everything · re-importable', icon: FolderIcon, enabled: false, tooltip: 'Coming in Phase 2' },
];

const ExportScreen: React.FC = () => {
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [fmt, setFmt] = useState('json');
  const [pickedChars, setPickedChars] = useState<number[]>([]);
  const [destination, setDestination] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    GetCharacters().then(chars => {
      setCharacters(chars);
      setPickedChars(chars.map(c => c.id));
    }).catch(() => {});
  }, []);

  const toggleChar = (id: number) => {
    setPickedChars(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePickFolder = useCallback(async () => {
    try {
      const folder = await PickExportFolder();
      if (folder) setDestination(folder);
    } catch {
      // user cancelled
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (pickedChars.length === 0 || exporting) return;
    setExporting(true);
    let exported = 0;
    let errors = 0;
    for (const id of pickedChars) {
      try {
        await ExportCharacter(id, destination);
        exported++;
      } catch {
        errors++;
      }
    }
    setExporting(false);
    if (errors === 0) {
      toast({ kind: 'ok', title: 'Export complete', body: `${exported} character${exported !== 1 ? 's' : ''} written to ${destination}.` });
    } else {
      toast({ kind: 'warn', title: 'Export partial', body: `${exported} exported, ${errors} failed.` });
    }
  }, [pickedChars, destination, exporting, toast]);

  return (
    <>
      <PageHead step={7} subtitle="Ship the project"
        title={<>Export <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>character cards</em></>}
        actions={
            <button className="btn primary" onClick={handleExport}
              disabled={exporting || pickedChars.length === 0 || !destination}>
              {exporting ? 'Exporting…' : <><DownloadIcon size={14} /> Export {pickedChars.length} character{pickedChars.length !== 1 ? 's' : ''}</>}
            </button>
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

          {/* Format picker */}
          <div className="card">
            <h4 style={{ margin: '0 0 10px' }}>Export format</h4>
            <div className="col" style={{ gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f.id}
                  className="btn ghost"
                  disabled={!f.enabled}
                  title={f.tooltip}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: fmt === f.id ? 'var(--acc-soft)' : undefined,
                    borderColor: fmt === f.id ? 'var(--acc)' : undefined,
                    opacity: f.enabled ? 1 : 0.5, justifyContent: 'flex-start', width: '100%',
                    cursor: f.enabled ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => f.enabled && setFmt(f.id)}>
                  <f.icon size={18} />
                  <div style={{ textAlign: 'left' }}>
                    <b style={{ display: 'block' }}>{f.name}</b>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{f.tooltip || f.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Destination */}
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
          </div>

          {/* Summary */}
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Summary</h4>
            <div className="col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Characters</span><b>{pickedChars.length}</b>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Format</span><b className="mono" style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>{fmt}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExportScreen;
