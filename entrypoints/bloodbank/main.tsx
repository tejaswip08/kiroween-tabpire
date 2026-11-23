import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/grenze-gotisch/latin-800.css';
import '@fontsource/sora/latin-400.css';
import '@fontsource/sora/latin-600.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '../newtab/styles/tokens.css';
import '../newtab/styles/base.css';
import './bloodbank.css';
import { formatMb, rankFor } from '../../lib/hunger';
import { openCrypt } from '../../lib/tabs';
import { onStoreChange, store, type CryptEntry, type LogAction, type LogEntry, type Stats } from '../../lib/store';
import { CountUp } from '../newtab/components/CountUp';

const EMPTY: Stats = { staked: 0, coffined: 0, crypted: 0, dawns: 0, mbFreed: 0 };
const WORDS: Record<LogAction, string> = {
  stake: 'Staked',
  coffin: 'Put to sleep',
  crypt: 'Saved to the Crypt',
  dawn: 'Closed by Dawn',
  resurrect: 'Brought back',
  garlic: 'Garlic changed',
};

/** Totals, rank and the log, kept live while other Tabpire pages write data. */
function useBloodBank() {
  const [data, setData] = useState<{ stats: Stats; log: LogEntry[]; crypt: CryptEntry[]; ready: boolean }>({ stats: EMPTY, log: [], crypt: [], ready: false });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [stats, log, crypt] = await Promise.all([store.getStats(), store.getLog(), store.getCrypt()]);
      if (alive) setData({ stats, log, crypt, ready: true });
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

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bb-tile">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function BloodBank() {
  const { stats, log, crypt } = useBloodBank();
  const rank = rankFor(stats.staked);
  const progress = rank.next === null ? 1 : (stats.staked - rank.from) / (rank.next - rank.from);
  const recent = [...log].reverse().slice(0, 30);
  return (
    <main className="bb">
      <header className="bb-head">
        <div>
          <h1 className="bb-title">Blood Bank</h1>
          <p className="bb-sub">What your vampires have cost them, and what you have taken back.</p>
        </div>
        <button type="button" className="bb-back" onClick={() => void openCrypt({ sameTab: true })}>
          Back to The Crypt
        </button>
      </header>
      <section className="bb-rank" aria-label="Rank">
        <p className="bb-rank-name">{rank.name}</p>
        <div className="bb-meter" role="img" aria-label={rank.next === null ? 'Top rank' : `${stats.staked} of ${rank.next} slain for the next rank`}>
          <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
        </div>
        <p className="bb-rank-note">{rank.next === null ? 'You have reached the top rank.' : `${rank.next - stats.staked} more slain for the next rank.`}</p>
      </section>
      <dl className="bb-tiles">
        <Tile label="Slain"><CountUp value={stats.staked} /></Tile>
        <Tile label="Coffined"><CountUp value={stats.coffined} /></Tile>
        <Tile label="In the Crypt"><CountUp value={crypt.length} /></Tile>
        <Tile label="Dawns"><CountUp value={stats.dawns} /></Tile>
        <Tile label="Blood reclaimed (est.)"><CountUp value={stats.mbFreed} format={formatMb} /></Tile>
      </dl>
      <section aria-labelledby="bb-log">
        <h2 id="bb-log" className="bb-h2">Recent deeds</h2>
        {recent.length === 0 ? (
          <p className="bb-empty">Nothing yet. Stake, coffin or save a tab and it will be written here.</p>
        ) : (
          <ul className="bb-log" role="list">
            {recent.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="bb-log-action">{WORDS[e.action]}</span>
                <span className="bb-log-what">{e.title || e.site || 'a tab'}</span>
                <time className="bb-log-time" dateTime={new Date(e.at).toISOString()}>{new Date(e.at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

document.title = 'Blood Bank - Tabpire';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BloodBank />
  </React.StrictMode>,
);
