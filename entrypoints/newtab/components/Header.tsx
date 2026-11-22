import { BatMark, BloodOrbIcon, ThemesIcon } from './icons';
import { DawnButton } from './DawnButton';
import { HeaderButton } from './HeaderButton';
import { StatsPanel } from './StatsPanel';

export function Header({
  openTabs,
  estimatedMb,
  reclaimedMb,
  dawnCount,
  dawnBusy,
  onDawn,
}: {
  openTabs: number;
  estimatedMb: number;
  reclaimedMb: number;
  dawnCount: number;
  dawnBusy: boolean;
  onDawn: () => void;
}) {
  return (
    <header className="header">
      <div className="brand">
        <BatMark size={44} className="brand-mark" />
        <div>
          <h1 className="brand-name">Tabpire</h1>
          <p className="brand-tagline">Your tabs are draining you. Stake them.</p>
        </div>
      </div>

      <StatsPanel openTabs={openTabs} estimatedMb={estimatedMb} reclaimedMb={reclaimedMb} />

      <nav className="header-actions" aria-label="Page actions">
        <HeaderButton label="Themes" icon={<ThemesIcon size={24} />} tip="Coming soon" disabled />
        <HeaderButton label="Blood Bank" icon={<BloodOrbIcon size={26} />} tip="Coming soon" disabled />
        <DawnButton count={dawnCount} busy={dawnBusy} onDawn={onDawn} />
      </nav>
    </header>
  );
}
