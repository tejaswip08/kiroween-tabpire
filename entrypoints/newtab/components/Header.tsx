import { openBloodBank } from '../../../lib/tabs';
import { BatMark, BloodOrbIcon, ThemesIcon } from './icons';
import { DawnButton } from './DawnButton';
import { HeaderButton } from './HeaderButton';
import { StatsPanel } from './StatsPanel';

export function Header({
  vampires,
  starving,
  estimatedMb,
  reclaimedMb,
  staked,
  coffined,
  dawnCount,
  dawnBusy,
  onDawn,
}: {
  vampires: number;
  starving: number;
  estimatedMb: number;
  reclaimedMb: number;
  staked: number;
  coffined: number;
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

      <StatsPanel vampires={vampires} starving={starving} estimatedMb={estimatedMb} reclaimedMb={reclaimedMb} staked={staked} coffined={coffined} />

      <nav className="header-actions" aria-label="Page actions">
        <HeaderButton label="Themes" icon={<ThemesIcon size={24} />} tip="Coming soon" disabled />
        <HeaderButton
          label="Blood Bank"
          icon={<BloodOrbIcon size={26} />}
          tip="Blood Bank: your totals, rank and recent deeds."
          onClick={() => void openBloodBank()}
        />
        <DawnButton count={dawnCount} busy={dawnBusy} onDawn={onDawn} />
      </nav>
    </header>
  );
}
