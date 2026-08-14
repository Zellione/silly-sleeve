import React, { useState } from 'react';
import { CheckIcon } from '../../icons';
import { settings } from '../../../wailsjs/go/models';

export const DEFAULT_USER_AGENT = 'SillySleeve/1.0 (+https://github.com/Zellione/silly-sleeve)';
export const DEFAULT_RATE_LIMIT_MS = 1000;
export const DEFAULT_MAX_PAGES = 10;

export type CrawlerSettingsProps = Readonly<{
  settingsState: settings.Settings;
  persist: (next: settings.Settings) => Promise<void>;
}>;

export const CrawlerSettings: React.FC<CrawlerSettingsProps> = ({ settingsState, persist }) => {
  const crawler = settingsState.crawler || settings.CrawlerConfig.createFrom({});
  const [draftUA, setDraftUA] = useState(crawler.userAgent || DEFAULT_USER_AGENT);
  const [draftRateLimit, setDraftRateLimit] = useState(crawler.rateLimitMs || DEFAULT_RATE_LIMIT_MS);
  const [draftMaxPages, setDraftMaxPages] = useState(crawler.maxPages || DEFAULT_MAX_PAGES);

  const handleSave = async () => {
    const next = settings.Settings.createFrom({
      ...settingsState,
      crawler: settings.CrawlerConfig.createFrom({
        userAgent: draftUA || DEFAULT_USER_AGENT,
        rateLimitMs: draftRateLimit || DEFAULT_RATE_LIMIT_MS,
        maxPages: draftMaxPages || DEFAULT_MAX_PAGES,
      }),
    });
    await persist(next);
  };

  return (
    <div className="settings-section">
      <h3>Wiki crawler</h3>
      <p className="desc">
        Configure how the crawler behaves when scraping wiki pages. Set the user agent, rate limiting, and maximum pages per crawl.
      </p>
      <div className="settings-form">
        <div className="form-row">
          <label htmlFor="crawler-user-agent">
            <span>User-Agent</span>
            <small>Identifies your crawler to web servers.</small>
          </label>
          <input
            id="crawler-user-agent"
            className="field"
            type="text"
            aria-label="User-Agent"
            value={draftUA}
            onChange={e => setDraftUA(e.target.value)}
            placeholder={DEFAULT_USER_AGENT}
            spellCheck={false}
          />
        </div>

        <div className="form-row">
          <label htmlFor="crawler-rate-limit">
            <span>Rate limit</span>
            <small>Milliseconds between requests. Higher values are more polite to servers.</small>
          </label>
          <input
            id="crawler-rate-limit"
            className="field"
            type="number"
            aria-label="Rate limit (ms)"
            min={0}
            step={100}
            value={draftRateLimit}
            onChange={e => setDraftRateLimit(Math.max(0, Number(e.target.value) || DEFAULT_RATE_LIMIT_MS))}
            style={{ width: 120, fontFamily: 'var(--f-mono)' }}
          />
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>ms</span>
        </div>

        <div className="form-row">
          <label htmlFor="crawler-max-pages">
            <span>Max pages</span>
            <small>Maximum number of pages to crawl in a single operation.</small>
          </label>
          <input
            id="crawler-max-pages"
            className="field"
            type="number"
            aria-label="Max pages"
            min={1}
            step={1}
            value={draftMaxPages}
            onChange={e => setDraftMaxPages(Math.max(1, Number(e.target.value) || DEFAULT_MAX_PAGES))}
            style={{ width: 120, fontFamily: 'var(--f-mono)' }}
          />
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary sm" onClick={handleSave}>
            <CheckIcon size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  );
};
