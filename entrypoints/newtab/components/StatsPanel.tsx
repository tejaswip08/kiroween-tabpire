import type { ReactNode } from 'react';
import { formatMb } from '../../../lib/hunger';
import { CountUp } from './CountUp';
/** The memory the bar is measured against: a full bar means 4 GB in use. */
export const DRAIN_FULL_MB = 4000;
function Stat({ label, est = false, note, children }: { label: string; est?: boolean; note: string; children: ReactNode }) {
  return (
    <div className="stat">
      <dt className="stat-label">
        {label}
        {est && (
          <abbr className="est-tag" title="Estimated">
            est.
          </abbr>
        )}
      </dt>
      <dd className="stat-value">{children}</dd>
      <dd className="stat-note">{note}</dd>
    </div>
  );
}
/** Glass panel with three columns: vampires, memory draining now, and blood reclaimed. The memory figures are estimates. */
export function StatsPanel({
  vampires,
  starving,
  estimatedMb,
  reclaimedMb,
  staked,
  coffined,
}: {
  vampires: number;
  starving: number;
  estimatedMb: number;
  reclaimedMb: number;
  staked: number;
  coffined: number;
}) {
  const drain = Math.min(1, Math.max(0, estimatedMb / DRAIN_FULL_MB));
  return (
    <section className="stats-panel" aria-label="Browser stats">
      <dl className="stats">
        <Stat label="Vampires" note={starving === 0 ? 'none starving' : `${starving} starving`}>
          <CountUp value={vampires} />
        </Stat>
        <Stat label="Draining now" est note="by your open tabs">
          <CountUp value={estimatedMb} format={formatMb} />
          <span className="stat-bar" role="img" aria-label={`${Math.round(drain * 100)}% of 4 GB`}>
            <span className="stat-bar-fill" style={{ transform: `scaleX(${drain})` }} />
          </span>
        </Stat>
        <Stat label="Blood reclaimed" est note={`${staked} slain · ${coffined} coffined`}>
          <CountUp value={reclaimedMb} format={formatMb} />
        </Stat>
      </dl>
    </section>
  );
}
