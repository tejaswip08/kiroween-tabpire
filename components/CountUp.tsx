import { useEffect, useRef, useState } from 'react';

/** Animates a number towards `value` and renders it with `format`. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let frame = requestAnimationFrame(function tick(t) {
      const k = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    });
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value]);

  return <>{format(shown)}</>;
}
