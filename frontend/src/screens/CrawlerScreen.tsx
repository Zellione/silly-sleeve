import React, { useState, useCallback, useEffect } from 'react';
import { PageHead } from '../components/Layout';
import { GlobeIcon, LinkIcon, RerollIcon, SaveIcon, ArrowIcon, TrashIcon, CheckIcon } from '../icons';
import { useToast } from '../components/ToastProvider';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { CrawlPage, GetCrawlState, SaveCrawlState, ClearCrawl, RemoveCrawlResult, SendCrawlResult, SaveProjectBundle } from '../../wailsjs/go/main/App';
import { crawler, main } from '../../wailsjs/go/models';
import { SectionContent } from '../components/SectionContent';
import { Dropdown } from '../components/Dropdown';

const RECENT_WIKIS = [
  'baldursgate.fandom.com', 'witcher.fandom.com',
  'finalfantasy.fandom.com', 'dragonage.fandom.com',
  'eberron.fandom.com',
];

type Phase = 'idle' | 'fetching' | 'crawled';
type RoleValue = 'character' | 'lorebook';

const ROLE_LABELS: Record<RoleValue, string> = {
  character: 'Character',
  lorebook: 'Lorebook',
};

// normalizeRole coerces any stored role (including legacy "skip") to a valid
// dropdown value, defaulting unknowns to lorebook.
const normalizeRole = (v: string | undefined): RoleValue =>
  v === 'character' ? 'character' : 'lorebook';

interface CrawlerScreenProps {
  projectPath?: string;
}

const CrawlerScreen: React.FC<CrawlerScreenProps> = ({ projectPath = '' }) => {
  const [url, setUrl] = useState('https://baldursgate.fandom.com/wiki/Elara_Wynd');
  const [phase, setPhase] = useState<Phase>('idle');
  const [follow, setFollow] = useState(0);
  const [include, setInclude] = useState<Record<string, boolean>>({
    infobox: true, quotes: true, trivia: false, gallery: false,
  });
  const [set, setSet] = useState<crawler.CrawlSet | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [roles, setRoles] = useState<Record<string, RoleValue>>({});
  // sent maps a page URL to the role it was last sent to the project as, so the
  // list can mark already-sent pages.
  const [sent, setSent] = useState<Record<string, RoleValue>>({});
  const [selectors, setSelectors] = useState('');
  // Gates auto-commit until the backend state has been restored, so the initial
  // default render can't overwrite a saved crawl before it loads.
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const initializeRoles = useCallback((crawlSet: crawler.CrawlSet) => {
    const newRoles: Record<string, RoleValue> = {};
    crawlSet.results.forEach((result, idx) => {
      newRoles[result.url] = idx === 0 ? 'character' : 'lorebook';
    });
    setRoles(newRoles);
  }, []);

  // Restore the screen from backend state on mount (survives tab switches and
  // project loads). Auto-commit stays disabled until this completes.
  useEffect(() => {
    GetCrawlState().then(st => {
      if (st.url) setUrl(st.url);
      if (st.followLinks) setFollow(st.followLinks);
      if (st.include && Object.keys(st.include).length > 0) setInclude(st.include);
      if (st.selectors) setSelectors(st.selectors);
      const restoredSet = st.set ?? null;
      const restored = restoredSet?.results ?? [];
      if (restoredSet && restored.length > 0) {
        setSet(restoredSet);
        setSelectedIdx(0);
        if (st.roles && Object.keys(st.roles).length > 0) {
          const normalized: Record<string, RoleValue> = {};
          Object.entries(st.roles).forEach(([k, v]) => { normalized[k] = normalizeRole(v); });
          setRoles(normalized);
        } else {
          initializeRoles(restoredSet);
        }
        if (st.sent && Object.keys(st.sent).length > 0) {
          const normalizedSent: Record<string, RoleValue> = {};
          Object.entries(st.sent).forEach(([k, v]) => { normalizedSent[k] = normalizeRole(v); });
          setSent(normalizedSent);
        }
        setPhase('crawled');
      }
    }).catch(() => {}).finally(() => setHydrated(true));
  }, [initializeRoles]);

  // Auto-commit inputs + role assignments to backend state (debounced) so they
  // survive navigation and are captured by the next project save.
  useEffect(() => {
    if (!hydrated) return undefined;
    const t = setTimeout(() => {
      SaveCrawlState(new main.CrawlState({
        url, followLinks: follow, include, selectors, roles, sent,
      })).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [hydrated, url, follow, include, selectors, roles, sent]);

  const toggleInclude = (k: string) => {
    setInclude(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const startCrawl = useCallback(async () => {
    if (!url.trim()) return;
    setPhase('fetching');
    try {
      const selectorArray = selectors.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      const opts = new crawler.CrawlOptions({
        followLinks: follow,
        include,
        selectors: selectorArray.length > 0 ? selectorArray : undefined,
      });
      const res = await CrawlPage(url, opts);
      setSet(res);
      setSelectedIdx(0);
      initializeRoles(res);
      setPhase('crawled');
    } catch {
      setPhase('idle');
      toast({ kind: 'bad', title: 'Crawl failed', body: 'Could not reach the wiki. Check the URL and try again.' });
    }
  }, [url, follow, include, selectors, toast, initializeRoles]);

  const handleSendRow = useCallback(async (pageURL: string, title: string) => {
    const role = normalizeRole(roles[pageURL]);
    try {
      let outcome = await SendCrawlResult(pageURL, role, false);
      if (outcome.status === 'needs_confirm') {
        const noun = role === 'character' ? `character named "${outcome.name}"` : `lorebook entry from "${outcome.name}"`;
        const ok = await confirm(`A ${noun} already exists. Overwrite it?`);
        if (!ok) return;
        outcome = await SendCrawlResult(pageURL, role, true);
      }
      if (outcome.status === 'missing') {
        toast({ kind: 'bad', title: 'Send failed', body: 'That page is no longer in the crawl.' });
        return;
      }
      setSent(prev => ({ ...prev, [pageURL]: role }));
      const label = ROLE_LABELS[role];
      const verb = outcome.status === 'overwritten' ? 'Overwrote' : 'Sent to';
      toast({ kind: 'ok', title: `${verb} ${label.toLowerCase()}`, body: `"${title}" → ${label}` });
    } catch {
      toast({ kind: 'bad', title: 'Send failed', body: 'Could not send the page to the project.' });
    }
  }, [roles, confirm, toast]);

  const handleRemoveResult = useCallback(async (pageURL: string) => {
    try {
      const updated = await RemoveCrawlResult(pageURL);
      const nextResults = updated.results ?? [];
      if (nextResults.length === 0) {
        // Removed the last page — reset to the empty state.
        setSet(null);
        setSelectedIdx(0);
        setRoles({});
        setSent({});
        setPhase('idle');
        return;
      }
      setSet(updated);
      setSelectedIdx(prev => Math.min(prev, nextResults.length - 1));
      setRoles(prev => {
        const next = { ...prev };
        delete next[pageURL];
        return next;
      });
      setSent(prev => {
        const next = { ...prev };
        delete next[pageURL];
        return next;
      });
    } catch {
      toast({ kind: 'bad', title: 'Remove failed', body: 'Could not remove the page from the crawl.' });
    }
  }, [toast]);

  const handleClearAll = useCallback(async () => {
    try {
      await ClearCrawl();
    } catch { /* best-effort; reset the screen regardless */ }
    setSet(null);
    setSelectedIdx(0);
    setRoles({});
    setSent({});
    setPhase('idle');
  }, []);

  const handleSaveCrawl = useCallback(async () => {
    // Flush the current crawl state, then write the project to disk now (the
    // same write auto-save performs on its timer).
    try {
      await SaveCrawlState(new main.CrawlState({ url, followLinks: follow, include, selectors, roles, sent }));
    } catch { /* non-fatal */ }
    if (!projectPath) {
      toast({ kind: 'warn', title: 'No project yet', body: 'Save the project first to write the crawl to disk.' });
      return;
    }
    try {
      await SaveProjectBundle(projectPath);
      toast({ kind: 'ok', title: 'Crawl saved', body: 'Crawl list and parameters saved to the project.' });
    } catch {
      toast({ kind: 'bad', title: 'Save failed', body: 'Could not save the project.' });
    }
  }, [projectPath, url, follow, include, selectors, roles, sent, toast]);

  const results = set?.results ?? [];
  const selectedResult = results[selectedIdx];
  const wordCount = selectedResult?.wordCount ?? 0;
  const sectionCount = selectedResult?.sections?.length ?? 0;

  const renderPreviewHead = () => {
    if (phase === 'fetching') {
      return <><span className="dot warn" /> <b>Fetching…</b><span style={{ flex: 1 }} /></>;
    }
    if (selectedResult) {
      return <><span className="dot ok" /> <b>{selectedResult.title}</b><span> · {selectedResult.domain}</span><span style={{ flex: 1 }} /><span>{wordCount.toLocaleString()} words · {sectionCount} sections</span></>;
    }
    return <><span className="dot idle" /> <b>No page crawled</b><span style={{ flex: 1 }} /></>;
  };

  const renderPreviewBody = () => {
    if (phase === 'fetching') {
      return (
        <div className="col" style={{ gap: 10 }}>
          <div className="shimmer" style={{ height: 22, width: '40%' }} />
          <div className="shimmer" style={{ height: 13 }} />
          <div className="shimmer" style={{ height: 13, width: '90%' }} />
          <div className="shimmer" style={{ height: 13, width: '80%' }} />
          <div className="shimmer" style={{ height: 13, width: '95%' }} />
          <div className="shimmer" style={{ height: 80, marginTop: 16 }} />
          <div className="shimmer" style={{ height: 13 }} />
          <div className="shimmer" style={{ height: 13, width: '85%' }} />
        </div>
      );
    }
    if (!selectedResult) {
      return (
        <div className="col" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Enter a wiki URL and click "Crawl page" to begin.</span>
        </div>
      );
    }
    const hasSections = selectedResult.sections && selectedResult.sections.length > 0;
    return (
      <>
        {selectedResult.infobox && selectedResult.infobox.length > 0 && (
          <dl className="infobox">
            {selectedResult.infobox.map((entry, i) => {
              const showSection = entry.section && (i === 0 || selectedResult.infobox[i - 1].section !== entry.section);
              return (
                <React.Fragment key={i}>
                  {showSection && <div className="infobox-section">{entry.section}</div>}
                  <dt>{entry.key}</dt>
                  <dd>
                    {entry.value.split('\n').map((line, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </dd>
                </React.Fragment>
              );
            })}
          </dl>
        )}
        {hasSections && <SectionContent sections={selectedResult.sections} />}
        {!hasSections && (
          <div className="col" style={{ alignItems: 'center', padding: '30px 16px', gap: 8, textAlign: 'center' }}>
            <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>No content extracted from this page.</span>
            <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>The wiki page may not exist, be empty, or contain no parseable content.</span>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <PageHead
        step={1}
        subtitle="Pull a source from the wild"
        title={<>Crawl a <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>wiki page</em></>}
        actions={
          <button className="btn ghost" disabled={results.length === 0} onClick={handleSaveCrawl}>
            <SaveIcon size={14} /> Save crawl
          </button>
        }
      />
      <div className="ss-page-body scroll">
        <div className="crawler-grid">
          {/* LEFT — input + options + results (whole column scrolls as one) */}
          <div className="col crawl-left">
            <div className="crawl-input">
              <div className="uplabel">Source URL</div>
              <div className="url-bar">
                <span className="scheme"><LinkIcon size={12} /></span>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  spellCheck={false}
                  placeholder="https://wiki.fandom.com/wiki/Page_name"
                />
              </div>
              <div className="recent">
                <span className="uplabel" style={{ paddingRight: 4 }}>Recent</span>
                {RECENT_WIKIS.map(w => (
                  <button key={w} type="button" className="chip" onClick={() => setUrl('https://' + w + '/wiki/')}>{w}</button>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <span className="helpr">Fandom / MediaWiki pages are parsed natively. Other URLs fall back to readable-mode HTML.</span>
                {phase === 'idle' && (
                  <button className="btn primary" onClick={startCrawl}>
                    <GlobeIcon size={14} /> Crawl page
                  </button>
                )}
                {phase === 'fetching' && (
                  <button className="btn primary" disabled style={{ opacity: 0.7 }}>
                    <div className="dot warn" style={{ boxShadow: 'none' }} /> Fetching…
                  </button>
                )}
                {phase === 'crawled' && (
                  <button className="btn ghost" onClick={startCrawl}>
                    <RerollIcon size={14} /> Re-crawl
                  </button>
                )}
              </div>
            </div>

            <div className="uplabel" style={{ paddingLeft: 2 }}>Crawl options</div>
            <div className="crawl-opts">
              <div className="crawl-opt">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>Follow links</b>
                  <Dropdown
                    aria-label="Follow links"
                    value={String(follow)}
                    onChange={raw => setFollow(+raw)}
                    style={{ width: 100 }}
                    options={[
                      { value: '0', label: 'No' },
                      { value: '1', label: '1 hop' },
                      { value: '2', label: '2 hops' },
                    ]}
                  />
                </div>
                <small>Follows same-domain links breadth-first, bounded by Max pages (Settings → Crawler). Raise it to reach deeper hops.</small>
              </div>
              <div className="crawl-opt">
                <b>Include</b>
                <div className="col" style={{ gap: 4 }}>
                  {Object.entries(include).map(([k, v]) => (
                    <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, textTransform: 'capitalize' }}>
                      <input type="checkbox" checked={v} onChange={() => toggleInclude(k)} style={{ accentColor: 'var(--acc)' }} />
                      {k}
                    </label>
                  ))}
                </div>
              </div>
              <div className="crawl-opt" style={{ gridColumn: '1 / -1' }}>
                <b>Custom selectors <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11, fontFamily: 'var(--f-mono)', marginLeft: 6 }}>advanced</span></b>
                <input
                  className="field"
                  value={selectors}
                  onChange={e => setSelectors(e.target.value)}
                  style={{ fontFamily: 'var(--f-mono)', fontSize: '11.5px' }}
                  placeholder=".mw-parser-output > p, .mw-parser-output > h2"
                />
                <small>Defaults to the MediaWiki body. Override to pin specific sections.</small>
              </div>
            </div>

            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="uplabel" style={{ paddingLeft: 2 }}>Results</span>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={handleClearAll}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <TrashIcon size={12} /> Delete all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {results.map((r, idx) => (
                    <div
                      key={r.url}
                      data-on={idx === selectedIdx || null}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 12px',
                        border: '1px solid var(--ink-5)',
                        borderRadius: 4,
                        background: 'var(--surface-1)',
                        fontSize: 12,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedIdx(idx)}
                        aria-pressed={idx === selectedIdx}
                        aria-label={`Preview ${r.title}`}
                        style={{
                          flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer',
                          background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.title}
                          {sent[r.url] && (
                            <span
                              title={`Sent as ${ROLE_LABELS[sent[r.url]]}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                                color: 'var(--ok, #4caf50)', border: '1px solid var(--ok, #4caf50)',
                                borderRadius: 3, padding: '1px 5px', flexShrink: 0,
                              }}
                            >
                              <CheckIcon size={9} /> {ROLE_LABELS[sent[r.url]]}
                            </span>
                          )}
                        </span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.domain}
                          {r.depth > 0 && <span style={{ marginLeft: 8 }}>hop {r.depth}</span>}
                          {r.wordCount > 0 && <span style={{ marginLeft: 8 }}>{r.wordCount} words</span>}
                        </span>
                      </button>
                      <Dropdown
                        value={normalizeRole(roles[r.url])}
                        onChange={val => setRoles(prev => ({ ...prev, [r.url]: val as RoleValue }))}
                        options={[
                          { value: 'character', label: ROLE_LABELS.character },
                          { value: 'lorebook', label: ROLE_LABELS.lorebook },
                        ]}
                        style={{ width: 120 }}
                        aria-label={`Role for ${r.title}`}
                      />
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => handleSendRow(r.url, r.title)}
                        style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                      >
                        {sent[r.url] ? 'Re-send' : 'Send'} <ArrowIcon size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${r.title}`}
                        title="Remove from crawl"
                        onClick={() => handleRemoveResult(r.url)}
                        style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-3)' }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — preview */}
          <div className="crawl-preview">
            <div className="head">
              {renderPreviewHead()}
            </div>
            <div className="body scroll">
              {renderPreviewBody()}
            </div>
            <div className="foot">
              <span className="meta">
                  <span>Status · {selectedResult ? (selectedResult.statusCode || 'ERR') : '…'}</span>
                <span>Latency · {selectedResult ? selectedResult.latencyMs + ' ms' : '…'}</span>
                <span>Cache · {selectedResult ? 'warm' : 'cold'}</span>
              </span>
              <span style={{ flex: 1 }} />
              <span className="meta">~{Math.round(wordCount * 1.7).toLocaleString()} tokens</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CrawlerScreen;
