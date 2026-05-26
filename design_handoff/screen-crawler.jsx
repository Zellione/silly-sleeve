// ─── Crawler screen ───────────────────────────────────────

const RECENT_WIKIS = [
  'baldursgate.fandom.com', 'witcher.fandom.com',
  'finalfantasy.fandom.com', 'dragonage.fandom.com',
  'eberron.fandom.com',
];

const SAMPLE_INFOBOX = [
  ['race', 'Half-elf'], ['class', 'Bard (College of Lore)'],
  ['allegiance', 'The Harpers'], ['weapon', 'Rapier · "Songthorn"'],
  ['height', '5\'8" / 173 cm'], ['eye color', 'Smoke grey'],
  ['hair color', 'Auburn, shoulder-length'], ['homeland', 'Baldur\'s Gate'],
];

function Crawler({ onContinue }) {
  const [url, setUrl] = React.useState('https://baldursgate.fandom.com/wiki/Elara_Wynd');
  const [phase, setPhase] = React.useState('crawled'); // idle, fetching, crawled
  const [follow, setFollow] = React.useState(1);
  const [include, setInclude] = React.useState({ infobox: true, quotes: true, trivia: false, gallery: false });

  const startCrawl = () => {
    setPhase('fetching');
    setTimeout(() => setPhase('crawled'), 1100);
  };

  return (
    <>
      <PageHead step={1} subtitle="Pull a source from the wild"
        title={<>Crawl a <em style={{fontStyle:'normal',color:'var(--acc)'}}>wiki page</em></>}
        actions={
          <>
            <button className="btn ghost" onClick={() => window.toast && window.toast({
              kind: 'ok', title: 'Crawl saved',
              body: '1,842 words cached locally · re-crawl skipped until source changes.',
            })}><I.Save size={14}/> Save crawl</button>
            <button className="btn primary" onClick={onContinue} disabled={phase!=='crawled'}>
              Send to Compose <I.Arrow size={14}/>
            </button>
          </>
        }
      />
      <div className="ss-page-body scroll">
        <div className="crawler-grid">
          {/* LEFT — input + options */}
          <div className="col" style={{gap:18}}>
            <div className="crawl-input">
              <div className="uplabel">Source URL</div>
              <div className="url-bar">
                <span className="scheme"><I.Link size={12}/></span>
                <input value={url} onChange={e => setUrl(e.target.value)} spellCheck={false}
                       placeholder="https://wiki.fandom.com/wiki/Page_name"/>
              </div>
              <div className="recent">
                <span className="uplabel" style={{paddingRight:4}}>Recent</span>
                {RECENT_WIKIS.map(w => (
                  <span key={w} className="chip" onClick={()=> setUrl('https://'+w+'/wiki/')}>{w}</span>
                ))}
              </div>
              <div className="row" style={{justifyContent:'space-between', marginTop:4}}>
                <span className="helpr">Fandom / MediaWiki pages are parsed natively. Other URLs fall back to readable-mode HTML.</span>
                {phase === 'idle' && <button className="btn primary" onClick={startCrawl}><I.Globe size={14}/> Crawl page</button>}
                {phase === 'fetching' && <button className="btn primary" disabled style={{opacity:0.7}}><div className="dot warn" style={{boxShadow:'none'}}/> Fetching…</button>}
                {phase === 'crawled' && <button className="btn ghost" onClick={startCrawl}><I.Reroll size={14}/> Re-crawl</button>}
              </div>
            </div>

            <div className="uplabel" style={{paddingLeft:2}}>Crawl options</div>
            <div className="crawl-opts">
              <div className="crawl-opt">
                <div className="row" style={{justifyContent:'space-between'}}>
                  <b>Follow links</b>
                  <select className="field" value={follow} onChange={e=>setFollow(+e.target.value)} style={{width:100, padding:'6px 8px', fontSize:12}}>
                    <option value={0}>No</option>
                    <option value={1}>1 hop</option>
                    <option value={2}>2 hops</option>
                  </select>
                </div>
                <small>Pull cross-referenced pages on the same domain to flesh out backstory.</small>
              </div>
              <div className="crawl-opt">
                <b>Include</b>
                <div className="col" style={{gap:4}}>
                  {Object.entries(include).map(([k,v]) => (
                    <label key={k} style={{display:'flex',gap:8,alignItems:'center',fontSize:12, textTransform:'capitalize'}}>
                      <input type="checkbox" checked={v} onChange={()=>setInclude({...include,[k]:!v})} style={{accentColor:'var(--acc)'}}/>
                      {k}
                    </label>
                  ))}
                </div>
              </div>
              <div className="crawl-opt" style={{gridColumn:'1 / -1'}}>
                <b>Custom selectors <span style={{color:'var(--ink-3)',fontWeight:400,fontSize:11,fontFamily:'var(--f-mono)',marginLeft:6}}>advanced</span></b>
                <input className="field" defaultValue=".mw-parser-output > p, .mw-parser-output > h2" style={{fontFamily:'var(--f-mono)',fontSize:11.5}} placeholder="CSS selector to include…"/>
                <small>Defaults to the MediaWiki body. Override to pin specific sections.</small>
              </div>
            </div>
          </div>

          {/* RIGHT — preview */}
          <div className="crawl-preview">
            <div className="head">
              {phase === 'fetching' ? (
                <><span className="dot warn"/> <b>Fetching…</b><span style={{flex:1}}/>
                <span>2/4 pages</span></>
              ) : (
                <><span className="dot ok"/> <b>elara_wynd</b><span>· baldursgate.fandom.com</span><span style={{flex:1}}/>
                <span>1,842 words · 4 sections</span></>
              )}
            </div>
            <div className="body scroll">
              {phase === 'fetching' ? (
                <div className="col" style={{gap:10}}>
                  <div className="shimmer" style={{height:22, width:'40%'}}/>
                  <div className="shimmer" style={{height:13}}/>
                  <div className="shimmer" style={{height:13, width:'90%'}}/>
                  <div className="shimmer" style={{height:13, width:'80%'}}/>
                  <div className="shimmer" style={{height:13, width:'95%'}}/>
                  <div className="shimmer" style={{height:80, marginTop:16}}/>
                  <div className="shimmer" style={{height:13}}/>
                  <div className="shimmer" style={{height:13, width:'85%'}}/>
                </div>
              ) : (
                <>
                  <h4>Elara Wynd</h4>
                  <p>
                    <span className="section-tag">lede</span>
                    <span className="pick">Elara Wynd, called the Crimson Lark by the patrons of the Elfsong, is a half-elf bard who haunts the docks of Baldur's Gate.</span> Once a chorister at the Temple of Lathander, she now collects ballads — and the secrets they carry — for the Harpers.
                  </p>
                  <dl className="infobox">
                    {SAMPLE_INFOBOX.map(([k,v]) => (
                      <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>
                    ))}
                  </dl>
                  <h4>Appearance</h4>
                  <p>
                    Elara wears a sleeveless leather doublet stained the colour of dried wine, with the sigil of a lark tooled near the collar. <mark>Her left ear bears a notched scar from a duel in the Steel Watch barracks.</mark> She is rarely seen without her rapier "Songthorn" or her quill-case of folded ravensteel.
                  </p>
                  <h4>Personality</h4>
                  <p>
                    Cheerful in public houses, watchful in alleys. Elara collects names the way other bards collect rhymes — she remembers everyone she has met by their first lie. She drinks little, but matches every cup the table sets in front of her, then pours hers into a hidden flask.
                  </p>
                  <h4>History</h4>
                  <p>
                    Born in <span className="pick">Reithwin Town</span> the year of the Mind Flayer crisis, Elara survived the early Shadow-curse by sheltering in a wagon of refugees bound for the coast…
                  </p>
                </>
              )}
            </div>
            <div className="foot">
              <span className="meta">
                <span>Status · {phase === 'crawled' ? '200 OK' : '…'}</span>
                <span>Latency · 412 ms</span>
                <span>Cache · hot</span>
              </span>
              <span style={{flex:1}}/>
              <span className="meta">~3,124 tokens</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Crawler });
