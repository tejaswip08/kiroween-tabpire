import type { DawnKeepReason } from '../../../lib/hunger';
import { DawnIcon } from './icons';
import { HeaderButton } from './HeaderButton';

/**
 * The Dawn tooltip. `kept` lists why each starving tab that Dawn will not close is kept (see `dawnKeepReason`), so the
 * header's starving count and the tooltip never seem to disagree.
 */
export function dawnTip(count: number, busy: boolean, kept: readonly DawnKeepReason[] = []): string {
  if (busy) return 'Dawn is running. Please wait.';
  const reasons = [...new Set(kept)].join(', ');
  if (count === 0) {
    if (kept.length === 0) return 'Dawn: no starving tabs to close right now.';
    const tabs = kept.length === 1 ? '1 starving tab is' : `${kept.length} starving tabs are`;
    return `Dawn: nothing to close. ${tabs} kept safe (${reasons}).`;
  }
  const tabs = count === 1 ? '1 starving tab' : `${count} starving tabs`;
  const close = `Dawn: close ${tabs} and save ${count === 1 ? 'it' : 'them'} to the Crypt.`;
  if (kept.length === 0) return close;
  return `${close} ${kept.length === 1 ? '1 more is' : `${kept.length} more are`} kept safe (${reasons}).`;
}

/** Sunrise button. Enabled only when Dawn would close at least one tab. */
export function DawnButton({
  count,
  busy,
  onDawn,
  kept = [],
}: {
  count: number;
  busy: boolean;
  onDawn: () => void;
  /** Why each starving tab that Dawn will not close is kept. */
  kept?: readonly DawnKeepReason[];
}) {
  return (
    <HeaderButton
      label="Dawn"
      className="header-btn-dawn"
      icon={<DawnIcon size={26} />}
      tip={dawnTip(count, busy, kept)}
      disabled={busy || count === 0}
      busy={busy}
      badge={count}
      onClick={onDawn}
    />
  );
}
