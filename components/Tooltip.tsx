import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// One floating explainer for the whole page, shown on hover or keyboard focus.
// It renders above the shared WebGL canvas, so it works over 3D portraits too.

type Tip = { rect: DOMRect; content: ReactNode; key: string };
const Ctx = createContext<{ show(t: Tip): void; hide(): void }>({ show() {}, hide() {} });

const DELAY_MS = 220;
const MARGIN = 10;

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((t: Tip) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTip(t), DELAY_MS);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setTip(null);
  }, []);

  useEffect(() => {
    const away = () => hide();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && away();
    addEventListener('scroll', away, true);
    addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer.current);
      removeEventListener('scroll', away, true);
      removeEventListener('keydown', onKey);
    };
  }, [hide]);

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      <AnimatePresence>{tip && <Bubble key={tip.key} tip={tip} />}</AnimatePresence>
    </Ctx.Provider>
  );
}

function Bubble({ tip }: { tip: Tip }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const r = tip.rect;
    const below = r.top - height - MARGIN < 8;
    const top = below ? r.bottom + MARGIN : r.top - height - MARGIN;
    const left = Math.min(innerWidth - width - 8, Math.max(8, r.left + r.width / 2 - width / 2));
    setPos({ left, top, below });
  }, [tip]);

  return (
    <motion.div
      ref={ref}
      role="tooltip"
      className="tip"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0 }}
      initial={{ opacity: 0, y: pos?.below ? -4 : 4 }}
      animate={{ opacity: pos ? 1 : 0, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.15 }}
    >
      {tip.content}
    </motion.div>
  );
}

/** Props to spread on any element so hovering or focusing it explains it. */
export function useTip(content: ReactNode, key: string) {
  const { show, hide } = useContext(Ctx);
  const open = (e: { currentTarget: Element }) => show({ rect: e.currentTarget.getBoundingClientRect(), content, key });
  return { onMouseEnter: open, onFocus: open, onMouseLeave: hide, onBlur: hide };
}

/** Wraps children in an element that shows `content` on hover or focus. */
export function Tipped({ content, id, children, className }: { content: ReactNode; id: string; children: ReactNode; className?: string }) {
  const tip = useTip(content, id);
  return (
    <div className={className} {...tip}>
      {children}
    </div>
  );
}
