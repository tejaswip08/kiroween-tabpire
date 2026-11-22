import type { ReactNode } from 'react';
import type { VampireState } from '../../../lib/hunger';
import { VampireEmblem } from './icons';

/**
 * Fixed 96 x 112 box. The 3D vampire is drawn here by the portrait canvas behind the card, through
 * a hole in the card surface (`data-3d='on'` on the card). Until it is ready, and when 3D is
 * not available, the slot shows a flat vampire emblem whose face matches the state.
 */
export function PortraitSlot({ state, children }: { state: VampireState; children?: ReactNode }) {
  return (
    <div className="portrait-slot" data-state={state} data-portrait-slot="">
      {children ?? <VampireEmblem state={state} />}
    </div>
  );
}
