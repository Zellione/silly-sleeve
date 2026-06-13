import React, { useCallback, useEffect, useState } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import { useConfirmDialog } from '../components/ConfirmDialog';
import {
  SearchIcon, GlobeIcon, UploadIcon, PlusIcon, LinkIcon, SparksIcon,
  FolderIcon, TrashIcon,
} from '../icons';
import { formatRelative } from '../utils/relativeTime';
import { arrayBufferToDataURL } from '../utils/image';
import {
  ListProjects, SetProjectStatus, RemoveProject,
  GetProjectThumbnail, PickOpenBundle, OpenProjectBundle,
} from '../../wailsjs/go/main/App';
import { library } from '../../wailsjs/go/models';

type Filter = 'all' | 'draft' | 'ready' | 'archived';
const STATUSES: Array<'draft' | 'ready' | 'archived'> = ['draft', 'ready', 'archived'];

export interface DashboardScreenProps {
  onOpenProject: (path: string) => void;
  onNewProject: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ onOpenProject, onNewProject }) => {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [projects, setProjects] = useState<library.Entry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    ListProjects()
      .then(list => setProjects(list ?? []))
      .catch(() => { /* dashboard shows the empty state on load failure */ });
  }, []);

  const count = (s: Filter) => projects.filter(p => s === 'all' || p.status === s).length;

  const filtered = projects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleOpen = useCallback(async (path: string) => {
    try {
      await OpenProjectBundle(path);
      onOpenProject(path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ kind: 'bad', title: 'Open failed', body: msg });
    }
  }, [onOpenProject, toast]);

  const handlePickOpen = useCallback(async () => {
    try {
      const path = await PickOpenBundle();
      if (!path) return;
      await handleOpen(path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'Cancelled') toast({ kind: 'bad', title: 'Open failed', body: msg });
    }
  }, [handleOpen, toast]);

  const cycleStatus = useCallback(async (p: library.Entry, ev: React.MouseEvent) => {
    ev.stopPropagation();
    const next = STATUSES[(STATUSES.indexOf(p.status as 'draft') + 1) % STATUSES.length];
    try {
      await SetProjectStatus(p.path, next);
      setProjects(prev => prev.map(x => x.path === p.path ? { ...x, status: next } as library.Entry : x));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ kind: 'bad', title: 'Status change failed', body: msg });
    }
  }, [toast]);

  const handleRemove = useCallback(async (p: library.Entry, ev: React.MouseEvent) => {
    ev.stopPropagation();
    // The shared ConfirmDialog is OK/Cancel only, so 6.1 removes from the
    // library index without deleting the .slv file (deleteFile=false). A
    // delete-file affordance would need a richer dialog — deferred.
    const ok = await confirm(`Remove "${p.name}" from your library? The .slv file stays on disk.`);
    if (!ok) return;
    try {
      await RemoveProject(p.path, false);
      setProjects(prev => prev.filter(x => x.path !== p.path));
      toast({ kind: 'ok', title: 'Project removed', body: 'Removed from library.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ kind: 'bad', title: 'Remove failed', body: msg });
    }
  }, [confirm, toast]);

  return (
    <>
      <PageHead
        subtitle="Manage your character projects"
        title={<>Your <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>projects</em></>}
        actions={
          <>
            <button className="btn ghost" disabled title="Coming in 6.6">
              <UploadIcon size={14} /> Import .png
            </button>
            <button className="btn ghost" onClick={handlePickOpen}>
              <FolderIcon size={14} /> Open project
            </button>
            <button className="btn primary" onClick={onNewProject}>
              <PlusIcon size={14} /> New project
            </button>
          </>
        } />
      <div className="ss-page-body scroll">
        <div className="dash-filters">
          {(['all', 'draft', 'ready', 'archived'] as Filter[]).map(f => (
            <button key={f} className="chip" data-on={filter === f ? '1' : '0'} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'draft' ? 'Drafts' : f === 'ready' ? 'Ready' : 'Archived'}
              <span className="count">{count(f)}</span>
            </button>
          ))}
          <div className="search">
            <SearchIcon size={14} />
            <input placeholder="Filter by name…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="emoji"><SparksIcon size={36} /></div>
            <h2>No characters yet. Start with a wiki page you love.</h2>
            <p>Paste a Fandom URL on the Crawl step and Silly Sleeve will pull lore, infobox, quotes and trivia — ready for the LLM to reformat into a character card.</p>
            <div className="row">
              <button className="btn primary" onClick={onNewProject}><GlobeIcon size={14} /> Crawl a wiki page</button>
            </div>
          </div>
        ) : (
          <div className="grid-cards">
            {filtered.map(p => (
              <ProjectCard
                key={p.path}
                p={p}
                onOpen={() => void handleOpen(p.path)}
                onCycleStatus={(ev) => void cycleStatus(p, ev)}
                onRemove={(ev) => void handleRemove(p, ev)}
              />
            ))}
            <button
              className="proj-card"
              onClick={onNewProject}
              style={{ borderStyle: 'dashed', background: 'transparent', alignItems: 'center', justifyContent: 'center', minHeight: 320, cursor: 'pointer' }}
              type="button"
              aria-label="Create new character project"
            >
              <div className="col" style={{ alignItems: 'center', textAlign: 'center', padding: 24, gap: 14 }}>
                <div style={{ width: 48, height: 48, border: '1px dashed var(--hair-strong)', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                  <PlusIcon size={22} />
                </div>
                <div className="serif-i" style={{ fontSize: 22 }}>New character</div>
                <div className="helpr">From a wiki URL or scratch</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

const ProjectCard: React.FC<{
  p: library.Entry;
  onOpen: () => void;
  onCycleStatus: (ev: React.MouseEvent) => void;
  onRemove: (ev: React.MouseEvent) => void;
}> = ({ p, onOpen, onCycleStatus, onRemove }) => {
  const [thumb, setThumb] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (p.hasThumbnail) {
      GetProjectThumbnail(p.path).then(bytes => {
        if (cancelled || !bytes || bytes.length === 0) return;
        setThumb(arrayBufferToDataURL(bytes));
      }).catch(() => { /* leave placeholder */ });
    }
    return () => { cancelled = true; };
  }, [p.path, p.hasThumbnail]);

  const tags = p.tags ?? [];
  return (
    <button className="proj-card" onClick={onOpen} type="button" aria-label={`Open project: ${p.name}`}>
      <div className={`proj-thumb ${thumb ? '' : 'empty'}`}>
        {thumb && <img src={thumb} alt="" />}
      </div>
      <div className="proj-meta">
        <div className="proj-card-head">
          <button className="proj-status" data-status={p.status} onClick={onCycleStatus} title="Click to change status">
            {p.status || 'draft'}
          </button>
          <button className="proj-status" onClick={onRemove} title="Remove from library" aria-label="Remove project">
            <TrashIcon size={12} />
          </button>
        </div>
        <h3><span className="serif-i">{p.name}</span></h3>
        {p.sourceShort && <div className="src"><LinkIcon size={12} /> {p.sourceShort}</div>}
        <div className="tags">
          {tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
          {tags.length > 3 && <span className="tag">+{tags.length - 3}</span>}
        </div>
        <div className="ft">
          <span>{p.tokens} tokens</span>
          <span><b>·</b> {formatRelative(p.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
};

export default DashboardScreen;
