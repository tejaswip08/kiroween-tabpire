import { useCallback, useRef, useState } from 'react';
import type { ThemeId } from '../../../lib/themes';
import { openBloodBank } from '../../../lib/tabs';
import { BatMark, BloodOrbIcon, ThemesIcon } from './icons';
import { DawnButton } from './DawnButton';
import { HeaderButton } from './HeaderButton';
import { StatsPanel } from './StatsPanel';
import { ThemePicker } from '../ThemePicker';

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
  themeId,
  onTheme,
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
  themeId: ThemeId;
  onTheme: (id: ThemeId) => void;
}) {
  const [themesOpen, setThemesOpen] = useState(false);
  const themesBtn = useRef<HTMLButtonElement>(null);
  const closeThemes = useCallback(() => setThemesOpen(false), []);
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
        <div className="themes-anchor">
          <HeaderButton
            ref={themesBtn}
            label="Themes"
            icon={<ThemesIcon size={24} />}
            tip="Change how Tabpire looks: six themes."
            popup="dialog"
            expanded={themesOpen}
            tipHidden={themesOpen}
            onClick={() => setThemesOpen((o) => !o)}
          />
          <ThemePicker open={themesOpen} themeId={themeId} onSelect={onTheme} onClose={closeThemes} anchorRef={themesBtn} />
        </div>
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
