import { useEffect, useRef, useState } from 'react';
import { MAX_HEIGHT_SHARE } from '../../../lib/cardFit';
/**
 * Width and height (CSS pixels) of the space the cards may use: the element's own size, with the height capped
 * to a share of the window, and `full`, the element's whole height. Zero until the element has been laid out.
 */
export function useAreaSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0, full: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      const full = Math.floor(el.clientHeight);
      const h = Math.floor(Math.min(full, window.innerHeight * MAX_HEIGHT_SHARE));
      setSize((s) => (s.w === w && s.h === h && s.full === full ? s : { w, h, full }));
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return [ref, size] as const;
}
