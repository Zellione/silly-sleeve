import React, { useState, useEffect, useCallback } from 'react';
import { PageHead, type Route } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import { useConfirmDialog } from '../components/ConfirmDialog';
import {
  GlobeIcon, CheckIcon, DownIcon, CopyIcon, ArrowIcon, SparksIcon, LinkIcon, PenIcon,
  TrashIcon, RerollIcon,
} from '../icons';
import {
  GetCrawlState, SaveCrawlState, SendCrawlResult, GetCharacters, UpdateCrawlSummary,
  RemoveCrawlResult, RefetchCrawlResult,
} from '../../wailsjs/go/app/App';
import { SectionContent } from '../components/SectionContent';
import { Infobox } from '../components/Infobox';
import { logError } from '../utils/log';
import { errorMessage } from '../utils/errorMessage';
import { pageSlug } from '../utils/pageSlug';
import { app, compose, crawler } from '../../wailsjs/go/models';

type Sub = 'chars' | 'lore';
type RoleValue = 'character' | 'lorebook';

const normalizeRole = (v: string | undefined): RoleValue =>
  v === 'character' ? 'character' : 'lorebook';

/**
 * Serialises a result's sections into editable text: "## Heading" lines start
 * sections, blank lines separate them. crawler.ParseSummaryText is the exact
 * inverse on the backend.
 */
const summaryText = (r: crawler.CrawlResult): string =>
  (r.sections ?? [])
    .map(s => (s.heading ? `## ${s.heading}\n` : '') + s.body)
    .join('\n\n');

/** Label on the card head's link pill: where this page already went, if anywhere. */
const sentLabel = (isSent: boolean, link: compose.Character | null, isChar: boolean): string => {
  if (!isSent) return 'unlinked';
  if (link) return `→ ${link.name || 'Untitled'}`;
  return isChar ? 'character' : 'staged';
};

const SummaryBody: React.FC<{
  r: crawler.CrawlResult;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
}> = ({ r, editing, draft, onDraft }) => (
  <div className="body">
    {editing ? (
      <textarea value={draft} spellCheck={false}
        aria-label="Summary text"
        title="Lines starting with '## ' become section headings"
        onChange={e => onDraft(e.target.value)} />
    ) : (
      <>
        {r.infobox && r.infobox.length > 0 && <Infobox entries={r.infobox} />}
        {r.sections && <SectionContent sections={r.sections} />}
      </>
    )}
  </div>
);

interface SummariesScreenProps {
  onNav: (r: Route) => void;
}

export const SummariesScreen: React.FC<SummariesScreenProps> = ({ onNav }) => {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [sub, setSub] = useState<Sub>('chars');
  const [openUrl, setOpenUrl] = useState<string | null>(null); // at most one expanded
  const [st, setSt] = useState<app.CrawlState | null>(null);
  const [characters, setCharacters] = useState<compose.Character[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  const refreshCharacters = useCallback(() => {
    GetCharacters()
      .then(cs => setCharacters(cs ?? []))
      .catch(e => logError('SummariesScreen.getCharacters', e));
  }, []);

  useEffect(() => {
    GetCrawlState()
      .then(setSt)
      .catch(e => logError('SummariesScreen.getCrawlState', e));
    refreshCharacters();
  }, [refreshCharacters]);

  const results = st?.set?.results ?? [];

  /**
   * The character this page belongs to, if any — the permanent link back.
   * A sourceUrl match is authoritative (stamped by Send-to-character); the
   * name fallback mirrors the backend's character dedupe (trimmed,
   * case-insensitive) and catches characters composed in the editor, which
   * never get a sourceUrl.
   */
  const linkedChar = useCallback(
    (r: crawler.CrawlResult): compose.Character | null => {
      const bySource = characters.find(c => c.sourceUrl === r.url);
      if (bySource) return bySource;
      const title = r.title.trim().toLowerCase();
      if (!title) return null;
      return characters.find(c => (c.name ?? '').trim().toLowerCase() === title) ?? null;
    },
    [characters],
  );

  // What a page IS beats what the crawl screen planned for it: a linked
  // character, then the role it was actually sent as, win over the crawl
  // screen's role dropdown.
  const roleOf = useCallback(
    (r: crawler.CrawlResult): RoleValue => {
      if (linkedChar(r)) return 'character';
      const sentRole = st?.sent?.[r.url];
      if (sentRole) return normalizeRole(sentRole);
      return normalizeRole(st?.roles?.[r.url]);
    },
    [st, linkedChar],
  );
  const charResults = results.filter(r => roleOf(r) === 'character');
  const loreResults = results.filter(r => roleOf(r) === 'lorebook');
  const list = sub === 'chars' ? charResults : loreResults;

  const persistState = useCallback((
    prev: app.CrawlState, roles: Record<string, string>, sent: Record<string, string>,
  ) => {
    SaveCrawlState(new app.CrawlState({
      url: prev.url,
      followLinks: prev.followLinks,
      include: prev.include,
      selectors: prev.selectors,
      roles,
      sent,
    })).catch(() => { /* re-saved on the crawl screen's next commit */ });
  }, []);

  const handleSend = useCallback(async (r: crawler.CrawlResult) => {
    if (!st) return;
    const role = roleOf(r);
    setSending(r.url);
    try {
      let outcome = await SendCrawlResult(r.url, role, false);
      if (outcome.status === 'needs_confirm') {
        const question = role === 'character'
          ? `A character named "${outcome.name}" already exists. Overwrite it?`
          : `"${outcome.name}" has already been sent to the lorebook. Send it again? Any candidates still awaiting review will be discarded.`;
        const ok = await confirm(question);
        if (!ok) return;
        outcome = await SendCrawlResult(r.url, role, true);
      }
      if (outcome.status === 'missing') {
        toast({ kind: 'bad', title: 'Send failed', body: 'That page is no longer in the crawl.' });
        return;
      }
      const sent = { ...st.sent, [r.url]: role };
      setSt(app.CrawlState.createFrom({ ...st, sent }));
      persistState(st, st.roles ?? {}, sent);
      if (role === 'lorebook') {
        toast({
          kind: 'ok',
          title: 'Staged for extraction',
          body: `"${r.title}" is ready to extract in the Lorebook tab.`,
        });
      } else {
        const verb = outcome.status === 'overwritten' ? 'Overwrote' : 'Sent to';
        toast({ kind: 'ok', title: `${verb} character`, body: `"${r.title}" → Character` });
        // The send created or updated a character carrying this page as its
        // sourceUrl — refetch so the card shows the link.
        refreshCharacters();
      }
    } catch {
      toast({ kind: 'bad', title: 'Send failed', body: 'Could not send the page to the project.' });
    } finally {
      setSending(null);
    }
  }, [st, roleOf, confirm, toast, persistState, refreshCharacters]);

  const handleDelete = useCallback(async (r: crawler.CrawlResult) => {
    if (!st) return;
    const ok = await confirm(
      `Delete "${r.title}" and its summary from the crawl? Any staged lorebook candidates from this page are discarded too.`,
    );
    if (!ok) return;
    try {
      const updated = await RemoveCrawlResult(r.url);
      const roles = { ...st.roles };
      delete roles[r.url];
      const sent = { ...st.sent };
      delete sent[r.url];
      setSt(app.CrawlState.createFrom({ ...st, set: updated, roles, sent }));
      setOpenUrl(null);
      persistState(st, roles, sent);
      toast({ kind: 'ok', title: 'Page deleted', body: `"${r.title}" was removed from the crawl.` });
    } catch {
      toast({ kind: 'bad', title: 'Delete failed', body: 'Could not remove the page from the crawl.' });
    }
  }, [st, confirm, toast, persistState]);

  const [refetching, setRefetching] = useState<string | null>(null);

  const handleRefetch = useCallback(async (r: crawler.CrawlResult) => {
    const ok = await confirm(
      `Refetch "${r.title}" from the wiki? This overwrites the stored summary, including any manual edits.`,
    );
    if (!ok) return;
    setRefetching(r.url);
    try {
      const updated = await RefetchCrawlResult(r.url);
      setSt(prev => {
        if (!prev?.set) return prev;
        const results = prev.set.results.map(x => (x.url === r.url ? updated : x));
        return app.CrawlState.createFrom({ ...prev, set: { ...prev.set, results } });
      });
      toast({ kind: 'ok', title: 'Page refetched', body: `"${r.title}" was re-crawled from the wiki.` });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Refetch failed', body: errorMessage(e, 'Could not refetch the page.') });
    } finally {
      setRefetching(null);
    }
  }, [confirm, toast]);

  const handleCopy = useCallback(async (r: crawler.CrawlResult) => {
    try {
      await navigator.clipboard.writeText(summaryText(r));
      toast({ kind: 'info', title: 'Copied', body: 'Summary copied to the clipboard.' });
    } catch {
      toast({ kind: 'bad', title: 'Copy failed', body: 'Clipboard is not available.' });
    }
  }, [toast]);

  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (r: crawler.CrawlResult) => {
    setDraft(summaryText(r));
    setEditingUrl(r.url);
  };

  const saveEdit = useCallback(async (r: crawler.CrawlResult) => {
    try {
      const updated = await UpdateCrawlSummary(r.url, draft);
      setSt(prev => {
        if (!prev?.set) return prev;
        const results = prev.set.results.map(x => (x.url === r.url ? updated : x));
        return app.CrawlState.createFrom({ ...prev, set: { ...prev.set, results } });
      });
      setEditingUrl(null);
      toast({
        kind: 'ok', title: 'Summary saved',
        body: 'Stored with the project — later sends and re-rolls read this version.',
      });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Save failed', body: errorMessage(e, 'Could not save the summary.') });
    }
  }, [draft, toast]);

  return (
    <>
      <PageHead
        title="Summaries"
        subtitle="The summaries the crawl produces, persisted per project with their source URL. Send one to draft a character or stage a lorebook extraction."
        actions={
          <button type="button" className="btn ghost" onClick={() => onNav('crawler')}>
            <GlobeIcon size={14} /> Crawl more
          </button>
        } />
      <div className="ss-page-body scroll">
        <div className="sum-wrap">
          <div className="sum-toolbar">
            <div className="v2-subseg">
              <button type="button" data-on={sub === 'chars' ? '1' : '0'}
                onClick={() => { setSub('chars'); setOpenUrl(null); setEditingUrl(null); }}>
                Character summaries <span className="n">{charResults.length}</span>
              </button>
              <button type="button" data-on={sub === 'lore' ? '1' : '0'}
                onClick={() => { setSub('lore'); setOpenUrl(null); setEditingUrl(null); }}>
                Lorebook summaries <span className="n">{loreResults.length}</span>
              </button>
            </div>
            <span className="grow" />
            <span className="uplabel">
              {sub === 'chars' ? 'send → drafts the character card' : 'send → stages an extraction'}
            </span>
          </div>

          <div className="sum-note">
            <SparksIcon size={15} style={{ color: 'var(--acc-ink)', flexShrink: 0, marginTop: 1 }} />
            <span>
              {sub === 'chars'
                ? <><b>Send to character</b> asks the LLM to fill the card fields from this page. Each field can be re-rolled or edited by hand in the Characters tab.</>
                : <><b>Send to lorebook</b> stages the page for extraction — the LLM proposes atomic entries you review and approve in the Lorebook tab.</>}
            </span>
          </div>

          {list.length === 0 && (
            <div className="empty" style={{ padding: '48px 20px' }}>
              <h2>Nothing crawled for this list yet.</h2>
              <p>Crawl a wiki page and assign it the {sub === 'chars' ? 'character' : 'lorebook'} role — its summary will appear here.</p>
              <div className="row">
                <button type="button" className="btn primary" onClick={() => onNav('crawler')}>
                  <GlobeIcon size={14} /> Go to Crawl
                </button>
              </div>
            </div>
          )}

          {list.map(r => {
            const link = linkedChar(r);
            const isSent = Boolean(st?.sent?.[r.url]) || Boolean(link);
            const open = openUrl === r.url;
            const isChar = roleOf(r) === 'character';
            const editing = editingUrl === r.url;
            return (
              <div key={r.url} className="sum-card" data-open={open ? '1' : '0'}>
                <button type="button" className="head"
                  onClick={() => { setOpenUrl(open ? null : r.url); setEditingUrl(null); }}>
                  <span className={`dot ${isSent ? 'ok' : 'idle'}`} />
                  <b>{r.title}</b>
                  <span>· {pageSlug(r.url)}</span>
                  <span className="grow" />
                  <span className="sum-link" data-on={isSent ? '1' : '0'}>
                    {isSent && <CheckIcon size={10} />} {sentLabel(isSent, link, isChar)}
                  </span>
                  <span>{r.wordCount.toLocaleString()} words</span>
                  <span className="chev"><DownIcon size={13} /></span>
                </button>
                {open && (
                  <>
                    <SummaryBody r={r} editing={editing} draft={draft} onDraft={setDraft} />
                    <div className="foot">
                      <span className="meta">
                        <span className="url" title={r.url}>
                          <LinkIcon size={11} style={{ verticalAlign: -2, marginRight: 5 }} />
                          {r.url}
                        </span>
                        <span>~{Math.round(r.wordCount * 1.35).toLocaleString()} tokens</span>
                      </span>
                      <span className="grow" />
                      {editing ? (
                        <>
                          <button type="button" className="btn ghost sm" onClick={() => setEditingUrl(null)}>
                            Cancel
                          </button>
                          <button type="button" className="btn primary sm" onClick={() => saveEdit(r)}>
                            <CheckIcon size={12} /> Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn ghost icon" title="Copy summary" onClick={() => handleCopy(r)}>
                            <CopyIcon size={14} />
                          </button>
                          <button type="button" className="btn ghost icon" title="Delete page" onClick={() => handleDelete(r)}>
                            <TrashIcon size={14} />
                          </button>
                          <button type="button" className="btn ghost sm" disabled={refetching === r.url} onClick={() => handleRefetch(r)}>
                            <RerollIcon size={12} /> Refetch
                          </button>
                          <button type="button" className="btn ghost sm" onClick={() => startEdit(r)}>
                            <PenIcon size={12} /> Edit
                          </button>
                          {isSent && (
                            <button type="button" className="btn ghost sm" onClick={() => onNav(isChar ? 'characters' : 'lorebook')}>
                              Open {isChar ? 'character' : 'lorebook'} <ArrowIcon size={11} />
                            </button>
                          )}
                          <button type="button" className="btn primary sm" disabled={sending === r.url} onClick={() => handleSend(r)}>
                            <SparksIcon size={12} /> {isSent ? 'Re-send' : 'Send'} to {isChar ? 'character' : 'lorebook'}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SummariesScreen;
