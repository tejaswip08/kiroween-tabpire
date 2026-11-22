import { useEffect } from 'react';

/** Where the cursor is, in window pixels. One listener for every portrait. */
export const cursor = { x: -1, y: -1, known: false };

export function useCursorTracker(): void {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      cursor.known = true;
    };
    const leave = () => {
      cursor.known = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);
}
