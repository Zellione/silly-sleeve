import React, { useState, useCallback, useEffect } from 'react';
import { PageHead } from '../components/Layout';
import { GlobeIcon, LinkIcon, RerollIcon, SaveIcon, ArrowIcon } from '../icons';
import { useToast } from '../components/ToastProvider';
import { CrawlPage, GetCachedCrawl } from '../../wailsjs/go/main/App';
import { crawler } from '../../wailsjs/go/models';
import { SectionContent } from '../components/SectionContent';

const RECENT_WIKIS = [
  'baldursgate.fandom.com', 'witcher.fandom.com',
  'finalfantasy.fandom.com', 'dragonage.fandom.com',
  'eberron.fandom.com',
];

type Phase = 'idle' | 'fetching' | 'crawled';

const CrawlerScreen: React.FC = () => {
  const [url, setUrl] = useState('https://baldursgate.fandom.com/wiki/Elara_Wynd');
  const [phase, setPhase] = useState<Phase>('idle');
  const [follow, setFollow] = useState(0);
  const [include, setInclude] = useState<Record<string, boolean>>({
    infobox: true, quotes: true, trivia: false, gallery: false,
  });
  const [result, setResult] = useState<crawler.CrawlResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    GetCachedCrawl().then(r => {
      if (r) {
        setResult(r);
        setPhase('crawled');
      }
    }).catch(() => {});
  }, []);

  const toggleInclude = (k: string) => {
    setInclude(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const startCrawl = useCallback(async () => {
    if (!url.trim()) return;
    setPhase('fetching');
    try {
      const opts = new crawler.CrawlOptions({ followLinks: follow, include });
      const res = await CrawlPage(url, opts);
      setResult(res);
      setPhase('crawled');
    } catch {
      setPhase('idle');
      toast({ kind: 'bad', title: 'Crawl failed', body: 'Could not reach the wiki. Check the URL and try again.' });
    }
  }, [url, follow, include, toast]);

  const wordCount = result?.wordCount ?? 0;
  const sectionCount = result?.sections?.length ?? 0;

  return (
    <>
      <PageHead
        step={1}
        subtitle="Pull a source from the wild"
        title={<>Crawl a <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>wiki page</em></>}
        actions={
          <>
            <button className="btn ghost" disabled title="Coming in a later phase">
              <SaveIcon size={14} /> Save crawl
            </button>
            <button className="btn primary" disabled={phase !== 'crawled'} title="Coming in a later phase">
              Send to Compose <ArrowIcon size={14} />
            </button>
          </>
        }
      />
      <div className="ss-page-body scroll">
        <div className="crawler-grid">
          {/* LEFT — input + options */}
          <div className="col" style={{ gap: 18 }}>
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
                  <span key={w} className="chip" onClick={() => setUrl('https://' + w + '/wiki/')}>{w}</span>
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
                  <select className="field" value={follow} onChange={e => { setFollow(+e.target.value); e.target.blur(); }} style={{ width: 100, padding: '6px 8px', fontSize: 12 }}>
                    <option value={0}>No</option>
                    <option value={1}>1 hop</option>
                    <option value={2}>2 hops</option>
                  </select>
                </div>
                <small>Multi-hop support coming in a later phase.</small>
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
            </div>
          </div>

          {/* RIGHT — preview */}
          <div className="crawl-preview">
            <div className="head">
              {phase === 'fetching' ? (
                <><span className="dot warn" /> <b>Fetching…</b><span style={{ flex: 1 }} /></>
              ) : result ? (
                <><span className="dot ok" /> <b>{result.title}</b><span> · {result.domain}</span><span style={{ flex: 1 }} /><span>{wordCount.toLocaleString()} words · {sectionCount} sections</span></>
              ) : (
                <><span className="dot idle" /> <b>No page crawled</b><span style={{ flex: 1 }} /></>
              )}
            </div>
            <div className="body scroll">
              {phase === 'fetching' ? (
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
              ) : result ? (
                <>
                   {result.infobox && result.infobox.length > 0 && (
                     <dl className="infobox">
                       {result.infobox.map((entry, i) => {
                         const showSection = entry.section && (i === 0 || result.infobox[i - 1].section !== entry.section);
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
                    {result.sections && <SectionContent sections={result.sections} />}
                    {result && (!result.sections || result.sections.length === 0) && (
                      <div className="col" style={{alignItems:'center', padding:'30px 16px', gap:8, textAlign:'center'}}>
                        <span style={{color:'var(--ink-2)', fontSize:13}}>No content extracted from this page.</span>
                        <span style={{color:'var(--ink-3)', fontSize:11}}>The wiki page may not exist, be empty, or contain no parseable content.</span>
                      </div>
                    )}
                </>
              ) : (
                <div className="col" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Enter a wiki URL and click "Crawl page" to begin.</span>
                </div>
              )}
            </div>
            <div className="foot">
              <span className="meta">
                  <span>Status · {result ? (result.statusCode || 'ERR') : '…'}</span>
                <span>Latency · {result ? result.latencyMs + ' ms' : '…'}</span>
                <span>Cache · {result ? 'warm' : 'cold'}</span>
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
