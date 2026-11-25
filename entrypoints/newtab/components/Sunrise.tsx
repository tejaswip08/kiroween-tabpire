import { useEffect } from 'react';
/** How long the sunrise sweep lasts (the `sunrise` keyframes in states.css). */
export const SUNRISE_MS = 1500;
/**
 * The Dawn sunrise: a warm golden glow that sweeps up over the whole screen while the starving cards burn to embers.
 * CSS only, transform and opacity. Never shown under reduced motion (App does not mount it then). Takes no clicks.
 */
export function Sunrise({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, SUNRISE_MS + 100);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="sunrise" aria-hidden="true" data-testid="sunrise">
      <span className="sunrise-glow" />
    </div>
  );
}
