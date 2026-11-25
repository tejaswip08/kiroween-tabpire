import type { DawnKeepReason } from '../../../lib/hunger';
import { dawnHeaderTip, dawnLabel } from '../../../lib/tips';
import { DawnIcon } from './icons';
import { HeaderButton } from './HeaderButton';
/**
 * Sunrise button: "Dawn · burn N". Enabled only when Dawn would close at least one tab. Its tip says how much memory
 * Dawn frees and, when a starving tab is kept safe (`kept`, see `dawnKeepReason`), which and why.
 */
export function DawnButton({
  count,
  mb = 0,
  busy,
  onDawn,
  kept = [],
}: {
  count: number;
  /** The memory of the tabs Dawn would close. */
  mb?: number;
  busy: boolean;
  onDawn: () => void;
  /** Why each starving tab that Dawn will not close is kept. */
  kept?: readonly DawnKeepReason[];
}) {
  return (
    <HeaderButton
      label={dawnLabel(count)}
      className="header-btn-dawn"
      icon={<DawnIcon size={26} />}
      tip={dawnHeaderTip(count, mb, kept, busy)}
      disabled={busy || count === 0}
      busy={busy}
      onClick={onDawn}
    />
  );
}
