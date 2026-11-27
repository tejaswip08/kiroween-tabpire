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

function Tile({ label, children, icon, tone, wide = false }: { label: string; children: ReactNode; icon: ReactNode; tone: string; wide?: boolean }) {
  return (
    <div className={`bb-tile${wide ? ' bb-tile-rank' : ''}`} data-tone={tone}>
      <span className="bb-tile-icon" aria-hidden="true">
        {icon}
      </span>
      {tone === 'blood' && (
        <span className="bb-drips" aria-hidden="true">
          <i /><i /><i />
        </span>
      )}
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** One bat per vampire slain (up to 7) flies across the page. Decorative, but the count is the slain total. */
function Bats({ count }: { count: number }) {
  const n = Math.min(count, 7);
  return (
    <div className="bb-bats" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="bb-bat" style={{ ['--i' as string]: i }}>
          <svg viewBox="0 0 64 28" width="34" height="15">
            <path
              className="bb-bat-wing"
              d="M32 8c3 0 4 3 5 5 3-5 8-9 15-9-2 3-2 6-1 8 4 0 8 2 12 6-5-1-8 0-10 3-3-3-6-3-9-1-2 4-5 6-8 7-3-1-6-3-8-7-3-2-6-2-9 1-2-3-5-4-10-3 4-4 8-6 12-6 1-2 1-5-1-8 7 0 12 4 15 9 1-2 2-5 5-5z"
              fill="currentColor"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
/** The blood moon: a plain red disc whose glow grows with progress to the next hunter rank. */
function Moon({ progress }: { progress: number }) {
  return <div className="bb-moon" aria-hidden="true" style={{ opacity: 0.55 + 0.45 * progress }} />;
}
/** The graveyard skyline: one tombstone per vampire slain (up to 14), behind an iron fence. */
function Graveyard({ count }: { count: number }) {
  const n = Math.min(count, 14);
  const stones = Array.from({ length: n }, (_, i) => {
    const x = 40 + ((i * 397) % 1120);
    const h = 34 + ((i * 53) % 30);
    const kind = i % 3;
    const d =
      kind === 0
        ? `M${x} 200v-${h}a16 16 0 0 1 32 0v${h}z`
        : kind === 1
          ? `M${x + 12} 200v-${h}h-10v-9h10v-10h8v10h10v9h-10v${h}z`
          : `M${x} 200v-${h - 6}l14-8 14 8v${h - 6}z`;
    return <path key={i} d={d} />;
  });
  const fence = Array.from({ length: 60 }, (_, i) => `M${i * 20 + 4} 200v-26l3-6 3 6v26z`).join('');
  return (
    <svg className="bb-yard" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path className="bb-yard-fence" d={`${fence}M0 182h1200v3H0zM0 192h1200v3H0z`} />
      <path className="bb-yard-tree" d="M1080 200c4-40 2-70-6-96-12-8-26-10-40-26 16 8 26 10 36 14-4-14-12-24-24-34 14 6 22 14 28 24 2-18 0-30-6-44 10 12 14 26 14 40 8-12 18-18 30-22-10 8-18 18-22 30 12-2 22 0 32 6-12 0-22 2-30 8 4 30 4 64 0 100z" />
      <path className="bb-yard-tree" d="M150 200c3-30 1-52-5-70-10-6-20-8-30-20 12 6 20 8 27 10-3-10-9-18-18-26 11 5 17 11 21 18 1-14 0-23-4-33 8 9 10 20 10 30 6-9 14-14 23-17-8 6-14 14-17 23 9-2 17 0 24 5-9 0-17 2-23 6 3 23 3 48 0 74z" />
      <g className="bb-yard-stones">{stones}</g>
      <path className="bb-yard-ground" d="M0 200V190Q300 176 600 188T1200 184V200z" />
    </svg>
  );
}
/** A corner cobweb: the sign of a panel nobody has used yet. */
function Cobweb() {
  return (
    <svg className="bb-web" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <path d="M100 0H0M100 0L0 40M100 0L0 100M100 0L40 100M100 0V100" />
        <path d="M70 0Q66 26 40 30M85 0Q76 38 40 54M100 0Q86 54 40 74" />
        <path d="M100 30Q74 32 70 56M100 54Q76 62 62 82M100 74Q84 78 76 92" opacity=".6" />
      </g>
    </svg>
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
      <Moon progress={totals.progress} />
      <Bats count={totals.slain} />
      <Graveyard count={totals.slain} />
      <div className="bb-fog" aria-hidden="true" />
      <main className="bb">
        <header className="bb-head">
          <div>
            <h1 className="bb-title">
              The Blood Bank
              <span className="bb-title-drips" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
            </h1>
            <span className="bb-rule" aria-hidden="true" />
            <p className="bb-sub">{BANK_SUB}</p>
          </div>
          <button type="button" className="bb-back" onClick={() => void openCrypt({ sameTab: true })}>
            {'\u2190 Back to the Crypt'}
          </button>
        </header>
        <dl className="bb-tiles">
          <Tile label="Blood reclaimed" tone="blood" icon={<DawnIcon size={30} />}>
            <CountUp value={stats.mbFreed} format={formatMb} />
          </Tile>
          <Tile label="Vampires slain" tone="stake" icon={<StakeIcon size={30} />}>
            <CountUp value={totals.slain} />
          </Tile>
          <Tile label="Coffined" tone="coffin" icon={<CoffinIcon size={30} />}>
            <CountUp value={totals.coffined} />
          </Tile>
          <Tile label="Hunter rank" tone="rank" icon={<CryptIcon size={30} />} wide>
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
              <p className="bb-empty">
                <Cobweb />
                {EMPTY_LOG_TEXT}
              </p>
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
                <p className="bb-empty">
                  {crypt.length === 0 && <Cobweb />}
                  {crypt.length === 0 ? 'The crypt is empty. Use Crypt on a vampire to save it for later.' : 'No saved tab matches.'}</p>
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
