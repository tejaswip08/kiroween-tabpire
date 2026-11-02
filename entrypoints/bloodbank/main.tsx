import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../components/theme.css';
import './bloodbank.css';
import { Atmosphere } from '../../components/Atmosphere';
import { useCrypt } from '../../components/useCrypt';
import { formatMb, rankFor } from '../../lib/hunger';
import type { LogAction } from '../../lib/store';
import { openCrypt, resurrect, toggleGarlic } from '../../lib/tabs';

const ICON: Record<LogAction, string> = {
  stake: '🗡',
  coffin: '⚰',
  crypt: '🏺',
  dawn: '☀',
  resurrect: '🦇',
  garlic: '🧄',
};
const VERB: Record<LogAction, string> = {
  stake: 'Staked',
  coffin: 'Coffined',
  crypt: 'Sent to crypt',
  dawn: '',
  resurrect: 'Resurrected',
  garlic: 'Garlic',
};

function BloodBank() {
  const { store } = useCrypt();
  const [query, setQuery] = useState('');
  if (!store) return null;
  const { stats, log, crypt, garlic } = store;
  const slain = stats.staked + stats.crypted;
  const q = query.toLowerCase();
  const found = crypt.filter((c) => !q || c.title.toLowerCase().includes(q) || c.url.toLowerCase().includes(q));

  return (
    <>
    <Atmosphere bats={1} />
    <main className="bank">
      <button className="btn back" onClick={openCrypt}>
        <span aria-hidden="true">←</span> Back to the Crypt
      </button>
      <p className="eyebrow">Tabpire</p>
      <h1>The Blood Bank</h1>
      <p className="sub">Everything you've reclaimed from the vampires. Stored only in this browser.</p>

      <section className="stats">
        <Stat label="Blood reclaimed" value={formatMb(stats.reclaimedMb)} />
        <Stat label="Vampires slain" value={String(slain)} />
        <Stat label="Coffined" value={String(stats.coffined)} />
        <Stat label="Hunter rank" value={rankFor(slain)} />
      </section>

      <div className="cols">
        <section>
          <h2>Hunt log</h2>
          {log.length === 0 ? (
            <p className="muted">No hunts yet. Open a new tab to meet your vampires.</p>
          ) : (
            <ol className="log">
              {log.slice(0, 80).map((e, i) => (
                <li key={i}>
                  <span className="icon" aria-hidden="true">{ICON[e.action]}</span>
                  <span className="when">{new Date(e.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="what">{VERB[e.action]} {e.action === 'dawn' ? e.title : `“${e.title}”`}</span>
                  {e.mb > 0 && <span className="mb">{formatMb(e.mb)}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2>The crypt · {crypt.length}</h2>
          <input
            className="search"
            placeholder="Search saved tabs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="saved">
            {found.map((c) => (
              <li key={c.url + c.at}>
                {c.favIconUrl ? <img src={c.favIconUrl} alt="" /> : <span className="dot" />}
                <a href={c.url} title={c.url}>{c.title}</a>
                <button className="btn btn-sm" onClick={() => resurrect(c.url)}>Resurrect</button>
              </li>
            ))}
          </ul>

          <h2 style={{ marginTop: 24 }}>Garlic · protected sites</h2>
          {garlic.length === 0 ? (
            <p className="muted">None yet. Hang garlic on a vampire to protect its site.</p>
          ) : (
            <ul className="garlic">
              {garlic.map((h) => (
                <li key={h}>
                  🧄 {h} <button className="btn btn-sm" onClick={() => toggleGarlic(`https://${h}`)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<BloodBank />);
