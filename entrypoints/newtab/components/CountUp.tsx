import { useEffect, useRef, useState } from 'react';
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** True when numbers should jump to their value: reduced motion, or no way to ask (tests). */
function instant(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/**
 * A number that counts from what it showed to its new value. It starts at its value, so nothing counts on the
 * first paint; the page's numbers count up when the data arrives or changes. With reduced motion it just changes.
 */
export function CountUp({
  value,
  format = (n) => String(n),
  durationMs = 700,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const still = instant();
  const current = useRef(value);
  useEffect(() => {
    if (still || value === current.current) {
      current.current = value;
      setShown(value);
      return undefined;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      current.current = from + (value - from) * easeOut(t);
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, still]);
  return <span className="count-up">{format(Math.round(still ? value : shown))}</span>;
}
