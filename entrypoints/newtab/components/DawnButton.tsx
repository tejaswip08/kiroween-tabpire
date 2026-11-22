import { DawnIcon } from './icons';
import { HeaderButton } from './HeaderButton';

export function dawnTip(count: number, busy: boolean): string {
  if (busy) return 'Dawn is running. Please wait.';
  if (count === 0) return 'Dawn: no starving tabs to close right now.';
  const tabs = count === 1 ? '1 starving tab' : `${count} starving tabs`;
  return `Dawn: close ${tabs} and save ${count === 1 ? 'it' : 'them'} to the Crypt.`;
}

/** Sunrise button. Enabled only when Dawn would close at least one tab. */
export function DawnButton({
  count,
  busy,
  onDawn,
}: {
  count: number;
  busy: boolean;
  onDawn: () => void;
}) {
  return (
    <HeaderButton
      label="Dawn"
      className="header-btn-dawn"
      icon={<DawnIcon size={26} />}
      tip={dawnTip(count, busy)}
      disabled={busy || count === 0}
      busy={busy}
      badge={count}
      onClick={onDawn}
    />
  );
}
