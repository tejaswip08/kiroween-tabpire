import { useEffect } from 'react';
import type { PointerState } from '../../../lib/scene/parallax';

/** Where the pointer is, for the scene's mouse parallax. One listener, shared. */
export const pointer: PointerState = { x: 0, y: 0, known: false, lastMove: -1e9 };

const seconds = () => performance.now() / 1000;

export function usePointerTracker(): void {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.known = true;
      pointer.lastMove = seconds();
    };
    const leave = () => {
      pointer.known = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);
}

export { seconds as pointerClock };
