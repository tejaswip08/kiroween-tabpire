import { useEffect, useState, type ReactNode } from 'react';
import './bloodbank.css';
import { BANK_SUB, EMPTY_GARLIC_TEXT, EMPTY_LOG_TEXT, bankTotals, logRows, searchCrypt } from '../../lib/bloodbank';
import { formatMb, siteOf } from '../../lib/hunger';
import { forgetCrypt, openCrypt, resurrect, ungarlic } from '../../lib/tabs';
import { onStoreChange, store, type CryptEntry, type LogAction, type LogEntry, type Stats } from '../../lib/store';
import { CountUp } from '../newtab/components/CountUp';
import { CoffinIcon, CryptIcon, DawnIcon, GarlicIcon, StakeIcon, WakeIcon } from '../newtab/components/icons';
import { SiteIcon } from '../newtab/components/SiteIcon';
import { useTheme } from '../newtab/components/useTheme';

const EMPTY: Stats = { staked: 0, coffined: 0, crypted: 0, dawns: 0, mbFreed: 0 };
const LOG_ICON: Record<LogAction, () => ReactNode> = {
  stake: () => <StakeIcon size={22} />,
  coffin: () => <CoffinIcon size={22} />,
  crypt: () => <CryptIcon size={22} />,
  resurrect: () => <WakeIcon size={22} />,
  garlic: () => <GarlicIcon size={22} />,
  dawn: () => <DawnIcon size={22} />,
};

interface BankData {
  stats: Stats;
  log: LogEntry[];
  crypt: CryptEntry[];
  garlic: string[];
  ready: boolean;
}
/** Totals, the log, the crypt and the garlic sites, kept live while other Tabpire pages write data. */
function useBloodBank(): BankData {
  const [data, setData] = useState<BankData>({ stats: EMPTY, log: [], crypt: [], garlic: [], ready: false });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [stats, log, crypt, garlic] = await Promise.all([store.getStats(), store.getLog(), store.getCrypt(), store.getGarlic()]);
      if (alive) setData({ stats, log, crypt, garlic, ready: true });
    };
    void load();
    const off = onStoreChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return data;
}

function Tile({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`bb-tile${wide ? ' bb-tile-rank' : ''}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The full Blood Bank page: totals and rank, the hunt log, the crypt (search, Resurrect, Delete) and the garlic sites. */
export function BloodBank() {
  useTheme(); // data-theme follows the saved choice. No picker and no save notice on this page.
  const { stats, log, crypt, garlic, ready } = useBloodBank();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const totals = bankTotals(stats);
  const rows = logRows(log, Date.now());
  const saved = searchCrypt(crypt, query);
  const run = async (key: string, job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try {
      await job();
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="bb-scroll">
      <main className="bb">
        <header className="bb-head">
          <div>
            <h1 className="bb-title">The Blood Bank</h1>
            <p className="bb-sub">{BANK_SUB}</p>
          </div>
          <button type="button" className="bb-back" onClick={() => void openCrypt({ sameTab: true })}>
            {'\u2190 Back to the Crypt'}
          </button>
        </header>
        <dl className="bb-tiles">
          <Tile label="Blood reclaimed">
            <CountUp value={stats.mbFreed} format={formatMb} />
          </Tile>
          <Tile label="Vampires slain">
            <CountUp value={totals.slain} />
          </Tile>
          <Tile label="Coffined">
            <CountUp value={totals.coffined} />
          </Tile>
          <Tile label="Hunter rank" wide>
            <span className="bb-rank-name">{totals.rank}</span>
            <span
              className="bb-meter"
              role="img"
              aria-label={totals.progress >= 1 ? 'Top rank' : `${Math.round(totals.progress * 100)}% of the way to the next rank`}
            >
              <span style={{ transform: `scaleX(${totals.progress})` }} />
            </span>
            <span className="bb-rank-note">{totals.rankNote}</span>
          </Tile>
        </dl>
        <div className="bb-columns">
          <section className="bb-panel" aria-labelledby="bb-log">
            <h2 id="bb-log" className="bb-h2">
              Hunt log
            </h2>
            {ready && rows.length === 0 ? (
              <p className="bb-empty">{EMPTY_LOG_TEXT}</p>
            ) : (
              <ul className="bb-log" role="list">
                {rows.map((r) => (
                  <li key={r.key} data-action={r.action}>
                    <span className="bb-log-icon" aria-hidden="true">
                      {LOG_ICON[r.action]()}
                    </span>
                    <span className="bb-log-text">
                      <span className="bb-log-action">{r.word}</span> <span className="bb-log-what">{r.what}</span>
                    </span>
                    <span className="bb-log-time">{r.time}</span>
                    <span className="bb-log-mb">{r.mb}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="bb-side">
            <section className="bb-panel" aria-labelledby="bb-crypt">
              <h2 id="bb-crypt" className="bb-h2">
                The crypt · {crypt.length}
              </h2>
              <input
                className="bb-search"
                type="search"
                placeholder="Search saved tabs"
                aria-label="Search saved tabs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {saved.length === 0 ? (
                <p className="bb-empty">{crypt.length === 0 ? 'The crypt is empty. Use Crypt on a vampire to save it for later.' : 'No saved tab matches.'}</p>
              ) : (
                <ul className="bb-crypt" role="list">
                  {saved.map((item) => (
                    <li key={item.id}>
                      <SiteIcon site={siteOf(item.url)} />
                      <a className="bb-crypt-link" href={item.url} target="_blank" rel="noreferrer" title={item.url}>
                        {item.title || item.url}
                      </a>
                      <button
                        type="button"
                        className="bb-btn bb-btn-blood"
                        aria-disabled={busy !== null || undefined}
                        onClick={() => void run(item.id, () => resurrect(item.id, Date.now(), { activate: false }))}
                      >
                        Resurrect
                      </button>
                      <button
                        type="button"
                        className="bb-btn"
                        aria-label={`Delete ${item.title || item.url}`}
                        aria-disabled={busy !== null || undefined}
                        onClick={() => void run(item.id, () => forgetCrypt(item.id))}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bb-panel" aria-labelledby="bb-garlic">
              <h2 id="bb-garlic" className="bb-h2">
                Garlic · protected sites
              </h2>
              {garlic.length === 0 ? (
                <p className="bb-empty">{EMPTY_GARLIC_TEXT}</p>
              ) : (
                <ul className="bb-garlic" role="list">
                  {garlic.map((site) => (
                    <li key={site}>
                      <SiteIcon site={site} />
                      <span className="bb-garlic-site">{site}</span>
                      <button
                        type="button"
                        className="bb-btn"
                        aria-label={`Remove garlic from ${site}`}
                        aria-disabled={busy !== null || undefined}
                        onClick={() => void run(site, () => ungarlic(site))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
