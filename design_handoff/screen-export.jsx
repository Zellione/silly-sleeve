// ─── Preview screen ───────────────────────────────────────
// Inspect the assembled card for the active character. Pure preview —
// export controls live in the dedicated Export step.

function Preview({ onContinue, characters, activeCharId, onSelectChar, onAddChar, activeChar }) {
  return (
    <>
      <PageHead step={6} subtitle="Inspect the assembled card"
        title={<>Preview <em style={{fontStyle:'normal',color:'var(--acc)'}}>{activeChar.name.split(' ')[0]}</em></>}
        actions={
          <>
            <button className="btn ghost"><I.Copy size={13}/> Copy JSON</button>
            <button className="btn primary" onClick={onContinue}>
              Continue to Export <I.Arrow size={14}/>
            </button>
          </>
        } />
      <CharacterStrip characters={characters} activeId={activeCharId}
                      onSelect={onSelectChar} onAdd={onAddChar}/>
      <div className="ss-page-body scroll">
        <div className="export-grid">
          {/* LEFT — assembled character card */}
          <div className="col" style={{gap:18}}>
            <div className="character-card">
              <div className="portrait">
                <div className="id">
                  <b>{activeChar.name}</b>
                  {activeChar.id} · 832 × 1216
                </div>
                <div className="tags">
                  <span className="tag acc">half-elf</span>
                  <span className="tag acc">bard</span>
                  <span className="tag">harper</span>
                  <span className="tag">docks</span>
                </div>
              </div>
              <div className="body scroll">
                <div className="title-block">
                  <span className="epithet">The {activeChar.epithet} · Half-elf, bard</span>
                  <h2>{activeChar.name}</h2>
                </div>

                <div className="field">
                  <h5 className="field-title">Appearance</h5>
                  <p className="field-body">Mid-height half-elf, mid-twenties in human years. Auburn hair cut at the shoulder, smoke-grey eyes, a notched scar on her left ear. She wears a sleeveless leather doublet stained wine-dark, with a lark sigil tooled near the collar.</p>
                </div>

                <div className="field">
                  <h5 className="field-title">Personality</h5>
                  <p className="field-body">Cheerful with strangers, watchful with friends. Collects names the way other bards collect rhymes; remembers everyone by the first lie they told her. Quick to laugh, slow to forgive.</p>
                </div>

                <div className="field">
                  <h5 className="field-title">Voice — example exchange</h5>
                  <blockquote style={{margin:0, padding:'12px 14px', borderLeft: '2px solid var(--acc)', background: 'var(--bg)', borderRadius:'0 4px 4px 0', font:'italic 14px/1.55 var(--f-display)', color:'var(--ink)'}}>
                    "You have the look of a man who pays for his secrets with his name. Sit. I'll pour."
                  </blockquote>
                </div>

                <div className="field">
                  <h5 className="field-title">Stat block</h5>
                  <div className="stat-mini">
                    <div><b>10</b><span>STR</span></div>
                    <div><b>16</b><span>DEX</span></div>
                    <div><b>12</b><span>CON</span></div>
                    <div><b>13</b><span>INT</span></div>
                    <div><b>11</b><span>WIS</span></div>
                    <div><b>18</b><span>CHA</span></div>
                    <div><b>34</b><span>HP</span></div>
                    <div><b>15</b><span>AC</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — token budget + linked lorebook */}
          <div className="export-side">
            <div className="card">
              <h4>Token budget</h4>
              <div className="col" style={{gap:8, marginTop:8}}>
                <div className="row" style={{justifyContent:'space-between', fontSize:11.5}}>
                  <span>Description</span><span className="mono">412</span>
                </div>
                <div className="bar"><i style={{width:'52%'}}/></div>
                <div className="row" style={{justifyContent:'space-between', fontSize:11.5}}>
                  <span>Personality</span><span className="mono">186</span>
                </div>
                <div className="bar"><i style={{width:'24%', background:'var(--ok)'}}/></div>
                <div className="row" style={{justifyContent:'space-between', fontSize:11.5}}>
                  <span>Scenario</span><span className="mono">94</span>
                </div>
                <div className="bar"><i style={{width:'12%', background:'var(--ok)'}}/></div>
                <div className="row" style={{justifyContent:'space-between', fontSize:11.5}}>
                  <span>Examples</span><span className="mono">312</span>
                </div>
                <div className="bar"><i style={{width:'39%'}}/></div>
                <div className="divline"/>
                <div className="row" style={{justifyContent:'space-between', fontSize:12}}>
                  <b>Permanent total</b>
                  <b className="mono">1,004 / 2,048</b>
                </div>
              </div>
            </div>

            <div className="card">
              <h4>Linked lorebook</h4>
              <div className="col" style={{gap:6, marginTop:8}}>
                {[
                  { name: 'The Harpers', pri: 100 },
                  { name: 'The Elfsong tavern', pri: 80 },
                  { name: 'Reithwin & the Shadow-curse', pri: 60 },
                  { name: 'Songthorn (rapier)', pri: 40 },
                ].map(e => (
                  <div key={e.name} className="lorebook-row">
                    <div><b>{e.name}</b><div className="kw">linked · attached at export</div></div>
                    <span className="pri">{e.pri}</span>
                  </div>
                ))}
              </div>
              <span className="helpr" style={{marginTop:8, display:'block'}}>4 of 6 project entries are scoped to {activeChar.name.split(' ')[0]}.</span>
            </div>

            <div className="card">
              <h4>Ready check</h4>
              <div className="col" style={{gap:6, marginTop:8}}>
                {[
                  ['Name & tags', true],
                  ['Personality', true],
                  ['Appearance', true],
                  ['Backstory', true],
                  ['Portrait · 832×1216', true],
                  ['First message / greeting', false],
                ].map(([k, ok]) => (
                  <div key={k} className="row" style={{gap:8, fontSize:12}}>
                    {ok ? <I.Check size={14} style={{color:'var(--ok)', flexShrink:0}}/>
                        : <I.X size={14} style={{color:'var(--warn)', flexShrink:0}}/>}
                    <span style={{color: ok ? 'var(--ink-2)' : 'var(--ink-3)'}}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Preview });
