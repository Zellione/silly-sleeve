import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/ToastProvider';
import { useConfirmDialog } from '../components/ConfirmDialog';
import {
  SearchIcon, GlobeIcon, PlusIcon, LinkIcon, SparksIcon,
  FolderIcon, TrashIcon,
} from '../icons';
import { formatRelative } from '../utils/relativeTime';
import { arrayBufferToDataURL } from '../utils/image';
import {
  ListProjects, SetProjectStatus, RemoveProject,
  GetProjectThumbnail, PickOpenBundle, OpenProjectBundle,
} from '../../wailsjs/go/app/App';
import { library } from '../../wailsjs/go/models';

type Filter = 'all' | 'draft' | 'ready' | 'archived';
const STATUSES: Array<'draft' | 'ready' | 'archived'> = ['draft', 'ready', 'archived'];
const FILTER_LABELS: Record<Filter, string> = {
  all: 'All', draft: 'Drafts', ready: 'Ready', archived: 'Archived',
};

export interface DashboardScreenProps {
  onOpenProject: (path: string, name?: string) => void;
  onNewProject: (name: string) => void;
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
      const manifest = await OpenProjectBundle(path);
      onOpenProject(path, manifest?.name);
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
    <div className="v2-pre scroll">
      <div className="brand">
        <div className="mark">SS</div>
        <b>Silly Sleeve</b>
      </div>
      <div className="sub">Pick a project to continue, or start a new one from a wiki crawl.</div>

      <div className="v2-pre-toolbar">
        <div className="dash-filters">
          {(['all', 'draft', 'ready', 'archived'] as Filter[]).map(f => (
            <button type="button" key={f} className="chip" data-on={filter === f ? '1' : '0'} onClick={() => setFilter(f)}>
              {FILTER_LABELS[f]}
              <span className="count">{count(f)}</span>
            </button>
          ))}
          <div className="search">
            <SearchIcon size={14} />
            <input placeholder="Filter by name…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button type="button" className="btn ghost" onClick={handlePickOpen}>
            <FolderIcon size={14} /> Open project
          </button>
        </div>
      </div>

      {filtered.length === 0 && projects.length === 0 ? (
        <div className="empty">
          <div className="emoji"><SparksIcon size={36} /></div>
          <h2>No characters yet. Start with a wiki page you love.</h2>
          <p>Paste a Fandom URL on the Crawl step and Silly Sleeve will pull lore, infobox, quotes and trivia — ready for the LLM to reformat into a character card.</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => onNewProject('')}><GlobeIcon size={14} /> Crawl a wiki page</button>
          </div>
        </div>
      ) : (
        <div className="grid">
          {filtered.map(p => (
            <ProjectCard
              key={p.path}
              p={p}
              onOpen={() => handleOpen(p.path)}
              onCycleStatus={(ev) => cycleStatus(p, ev)}
              onRemove={(ev) => handleRemove(p, ev)}
            />
          ))}
          <NewProjectCard onNew={onNewProject} />
        </div>
      )}
      <div className="foot">silly sleeve · character workshop</div>
    </div>
  );
};

const NewProjectCard: React.FC<{ onNew: (name: string) => void }> = ({ onNew }) => {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus the revealed name input — the user just asked for it by clicking
  // the card, so this is intent-driven (autoFocus is flagged by jsx-a11y).
  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    onNew(n);
  };

  if (!naming) {
    return (
      <button type="button" className="proj-card new" onClick={() => setNaming(true)} aria-label="Create new character project">
        <span className="plus"><PlusIcon size={18} /></span>
        <b>New project</b>
        <span className="hint">starts on the crawl tab</span>
      </button>
    );
  }
  return (
    <div className="proj-card new" data-naming="1">
      <div className="form">
        <label htmlFor="new-project-name">Project name</label>
        <input id="new-project-name" className="field" ref={inputRef} value={name}
          placeholder="e.g. Witcher · Kaer Morhen…"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') create();
            if (e.key === 'Escape') { setNaming(false); setName(''); }
          }} />
        <div className="row">
          <button type="button" className="btn primary" disabled={!name.trim()} onClick={create}
            style={{ flex: 1, justifyContent: 'center' }}>
            <PlusIcon size={13} /> Create
          </button>
          <button type="button" className="btn ghost" onClick={() => { setNaming(false); setName(''); }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
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
          <button type="button" className="proj-status" data-status={p.status} onClick={onCycleStatus} title="Click to change status">
            {p.status || 'draft'}
          </button>
          <button type="button" className="proj-status" onClick={onRemove} title="Remove from library" aria-label="Remove project">
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
