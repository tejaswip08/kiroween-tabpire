import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import '../../components/theme.css';
import './popup.css';
import { usePointerVars } from '../../components/Atmosphere';
import { BloodIcon, SunIcon } from '../../components/Icons';
import { StandaloneVampire } from '../../components/three/Portrait';
import { useCrypt } from '../../components/useCrypt';
import { appetiteMb, dawnTargets, formatMb, stageOf } from '../../lib/hunger';
import { dawn, openBloodBank } from '../../lib/tabs';

function Popup() {
  usePointerVars();
  const { tabs, store, time, garlic } = useCrypt();
  const targets = dawnTargets(tabs, time, garlic);
  const starving = tabs.filter((t) => stageOf(t, time, garlic) === 'starving').length;
  const draining = tabs.reduce((sum, t) => sum + appetiteMb(t), 0);

  return (
    <div className="popup">
      <div className="pop-head">
        <div className="pop-vamp">
          <StandaloneVampire
            stage={starving ? 'starving' : 'fresh'}
            pallor={starving ? 0.85 : 0}
            variant={0}
            style={{ width: 92, height: 108 }}
          />
        </div>
        <div>
          <p className="pop-eyebrow">Tabpire</p>
          <h1>{starving ? `${starving} starving` : 'All fed'}</h1>
          <p className="pop-sub">
            {tabs.length} vampires · ~{formatMb(draining)} draining
          </p>
        </div>
      </div>

      <button className="btn btn-dawn pop-wide" disabled={!targets.length} onClick={() => dawn(tabs)}>
        <SunIcon /> {targets.length ? `Dawn · burn ${targets.length}` : 'No one to burn'}
      </button>
      <div className="pop-row">
        <button className="btn" onClick={() => browser.tabs.create({})}>Open the Crypt</button>
        <button className="btn" onClick={() => openBloodBank()}>
          <BloodIcon /> {store ? formatMb(store.stats.reclaimedMb) : 'Blood Bank'}
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
