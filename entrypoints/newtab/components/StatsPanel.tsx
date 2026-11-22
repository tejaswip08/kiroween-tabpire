import { formatMemory } from '../../../lib/view';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt className="stat-label">
        {label}
        <abbr className="est-tag" title="Estimated">
          est.
        </abbr>
      </dt>
      <dd className="stat-value">{value}</dd>
    </div>
  );
}

/** Glass panel with the three figures. Every figure is an estimate. */
export function StatsPanel({
  openTabs,
  estimatedMb,
  reclaimedMb,
}: {
  openTabs: number;
  estimatedMb: number;
  reclaimedMb: number;
}) {
  return (
    <section className="stats-panel" aria-label="Browser stats">
      <dl className="stats">
        <Stat label="Open tabs" value={String(openTabs)} />
        <Stat label="Memory in use" value={formatMemory(estimatedMb)} />
        <Stat label="Memory reclaimed" value={formatMemory(reclaimedMb)} />
      </dl>
    </section>
  );
}
