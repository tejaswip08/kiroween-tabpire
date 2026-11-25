import { useCallback, useState } from 'react';
import { dawnTargets } from '../../lib/hunger';
import { dawnNotice } from '../../lib/messages';
import { popupDawn, popupHeading, popupSub } from '../../lib/popupText';
import { dawn, openBloodBank, openCrypt } from '../../lib/tabs';
import { sumMb } from '../../lib/view';
import { formatMb } from '../../lib/hunger';
import { CountUp } from '../newtab/components/CountUp';
import { BloodOrbIcon, DawnIcon, VampireEmblem } from '../newtab/components/icons';
import { useCrypt } from '../newtab/components/useCrypt';
import { useTheme } from '../newtab/components/useTheme';
import './popup.css';

/**
 * The toolbar popup: a small vampire portrait (starving when any tab is), how many tabs are starving, the memory the
 * vampires drain, a wide Dawn button, and the ways to the Crypt and the Blood Bank. `onDone` runs after a button opened
 * a page (the extension closes the popup; the web demo keeps it).
 */
export function Popup({ onDone = () => {} }: { onDone?: () => void }) {
  useTheme();
  const data = useCrypt();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const starving = data.cards.filter((c) => c.state === 'starving').length;
  const burn = dawnTargets(data.cards.map((c) => c.info), data.garlic, data.now).length;
  const onDawn = useCallback(async () => {
    if (busy || burn === 0) return;
    setBusy(true);
    try {
      setNote(dawnNotice(await dawn()).text);
    } finally {
      setBusy(false);
      data.reload();
    }
  }, [busy, burn, data]);
  return (
    <main className="popup" data-state={starving > 0 ? 'starving' : 'awake'}>
      <div className="popup-portrait" aria-hidden="true">
        <VampireEmblem state={starving > 0 ? 'starving' : 'awake'} />
      </div>
      <p className="popup-eyebrow">Tabpire</p>
      <h1 className="popup-heading">{popupHeading(starving)}</h1>
      <p className="popup-sub">{popupSub(data.cards.length, sumMb(data.cards))}</p>
      <button
        type="button"
        className="popup-dawn"
        aria-disabled={busy || burn === 0 || undefined}
        aria-busy={busy || undefined}
        onClick={() => void onDawn()}
      >
        <DawnIcon size={24} />
        <span>{popupDawn(burn)}</span>
      </button>
      <p className="popup-note" role="status">
        {note}
      </p>
      <div className="popup-row">
        <button
          type="button"
          className="popup-btn"
          onClick={() => {
            void openCrypt().then(onDone);
          }}
        >
          Open the Crypt
        </button>
        <button
          type="button"
          className="popup-btn popup-bank"
          aria-label={`Blood Bank: ${formatMb(data.stats.mbFreed)} reclaimed`}
          onClick={() => {
            void openBloodBank().then(onDone);
          }}
        >
          <BloodOrbIcon size={20} />
          <CountUp value={data.stats.mbFreed} format={formatMb} />
        </button>
      </div>
    </main>
  );
}
