import type { ReactNode } from 'react';
import type { VampireState } from '../../../lib/hunger';
import { VampireEmblem } from './icons';

/**
 * Fixed 96 x 112 box. Spec 4 puts the 3D vampire here without changing the card layout.
 * Until then it shows a flat vampire emblem whose face matches the state.
 */
export function PortraitSlot({ state, children }: { state: VampireState; children?: ReactNode }) {
  return (
    <div className="portrait-slot" data-state={state}>
      {children ?? <VampireEmblem state={state} />}
    </div>
  );
}
