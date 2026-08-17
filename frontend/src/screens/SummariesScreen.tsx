import React, { useState, useEffect, useCallback } from 'react';
import { PageHead, type Route } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import { useConfirmDialog } from '../components/ConfirmDialog';
import {
  GlobeIcon, CheckIcon, DownIcon, CopyIcon, ArrowIcon, SparksIcon, LinkIcon,
} from '../icons';
import { GetCrawlState, SaveCrawlState, SendCrawlResult, GetCharacters } from '../../wailsjs/go/app/App';
import { SectionContent } from '../components/SectionContent';
import { Infobox } from '../components/Infobox';
import { logError } from '../utils/log';
import { pageSlug } from '../utils/pageSlug';
import { app, compose, crawler } from '../../wailsjs/go/models';

type Sub = 'chars' | 'lore';
type RoleValue = 'character' | 'lorebook';

const normalizeRole = (v: string | undefined): RoleValue =>
  v === 'character' ? 'character' : 'lorebook';

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

  /** The character this page created, if any — the permanent link back. */
  const linkedChar = useCallback(
    (url: string): compose.Character | null =>
      characters.find(c => c.sourceUrl === url) ?? null,
    [characters],
  );

  // What a page IS beats what the crawl screen planned for it: a character
  // linked by sourceUrl, or the role it was actually sent as, wins over the
  // crawl screen's role dropdown.
  const roleOf = useCallback(
    (url: string): RoleValue => {
      if (linkedChar(url)) return 'character';
      const sentRole = st?.sent?.[url];
      if (sentRole) return normalizeRole(sentRole);
      return normalizeRole(st?.roles?.[url]);
    },
    [st, linkedChar],
  );
  const charResults = results.filter(r => roleOf(r.url) === 'character');
  const loreResults = results.filter(r => roleOf(r.url) === 'lorebook');
  const list = sub === 'chars' ? charResults : loreResults;

  const persistSent = useCallback((prev: app.CrawlState, sent: Record<string, string>) => {
    SaveCrawlState(new app.CrawlState({
      url: prev.url,
      followLinks: prev.followLinks,
      include: prev.include,
      selectors: prev.selectors,
      roles: prev.roles,
      sent,
    })).catch(() => { /* re-saved on the crawl screen's next commit */ });
  }, []);

  const handleSend = useCallback(async (r: crawler.CrawlResult) => {
    if (!st) return;
    const role = roleOf(r.url);
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
      const sent = { ...(st.sent ?? {}), [r.url]: role };
      setSt(app.CrawlState.createFrom({ ...st, sent }));
      persistSent(st, sent);
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
  }, [st, roleOf, confirm, toast, persistSent, refreshCharacters]);

  const handleCopy = useCallback(async (r: crawler.CrawlResult) => {
    const text = (r.sections ?? [])
      .map(s => (s.heading ? `## ${s.heading}\n` : '') + s.body)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ kind: 'info', title: 'Copied', body: 'Summary copied to the clipboard.' });
    } catch {
      toast({ kind: 'bad', title: 'Copy failed', body: 'Clipboard is not available.' });
    }
  }, [toast]);

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
                onClick={() => { setSub('chars'); setOpenUrl(null); }}>
                Character summaries <span className="n">{charResults.length}</span>
              </button>
              <button type="button" data-on={sub === 'lore' ? '1' : '0'}
                onClick={() => { setSub('lore'); setOpenUrl(null); }}>
                Lorebook summaries <span className="n">{loreResults.length}</span>
              </button>
            </div>
            <span className="grow" />
            <span className="uplabel">
              {sub === 'chars' ? 'send → drafts the character card' : 'send → stages an extraction'}
            </span>
          </div>

          <div className="sum-note">
            <SparksIcon size={15} style={{ color: 'var(--acc)', flexShrink: 0, marginTop: 1 }} />
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
            const link = linkedChar(r.url);
            const isSent = Boolean(st?.sent?.[r.url]) || Boolean(link);
            const open = openUrl === r.url;
            const isChar = roleOf(r.url) === 'character';
            let sentLabel = 'unlinked';
            if (isSent) {
              if (link) sentLabel = `→ ${link.name || 'Untitled'}`;
              else sentLabel = isChar ? 'character' : 'staged';
            }
            return (
              <div key={r.url} className="sum-card" data-open={open ? '1' : '0'}>
                <button type="button" className="head" onClick={() => setOpenUrl(open ? null : r.url)}>
                  <span className={`dot ${isSent ? 'ok' : 'idle'}`} />
                  <b>{r.title}</b>
                  <span>· {pageSlug(r.url)}</span>
                  <span className="grow" />
                  <span className="sum-link" data-on={isSent ? '1' : '0'}>
                    {isSent && <CheckIcon size={10} />} {sentLabel}
                  </span>
                  <span>{r.wordCount.toLocaleString()} words</span>
                  <span className="chev"><DownIcon size={13} /></span>
                </button>
                {open && (
                  <>
                    <div className="body">
                      {r.sections && <SectionContent sections={r.sections} />}
                      {r.infobox && r.infobox.length > 0 && (
                        <Infobox entries={r.infobox} style={{ marginTop: 16 }} />
                      )}
                    </div>
                    <div className="foot">
                      <span className="meta">
                        <span className="url" title={r.url}>
                          <LinkIcon size={11} style={{ verticalAlign: -2, marginRight: 5 }} />
                          {r.url}
                        </span>
                        <span>~{Math.round(r.wordCount * 1.35).toLocaleString()} tokens</span>
                      </span>
                      <span className="grow" />
                      <button type="button" className="btn ghost icon" title="Copy summary" onClick={() => handleCopy(r)}>
                        <CopyIcon size={14} />
                      </button>
                      {isSent && (
                        <button type="button" className="btn ghost sm" onClick={() => onNav(isChar ? 'characters' : 'lorebook')}>
                          Open {isChar ? 'character' : 'lorebook'} <ArrowIcon size={11} />
                        </button>
                      )}
                      <button type="button" className="btn primary sm" disabled={sending === r.url} onClick={() => handleSend(r)}>
                        <SparksIcon size={12} /> {isSent ? 'Re-send' : 'Send'} to {isChar ? 'character' : 'lorebook'}
                      </button>
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
