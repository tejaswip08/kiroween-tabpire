import { useCallback, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { placePopup } from '../../../lib/popupPlace';
import type { TipContent } from '../../../lib/tips';

/** Space between the control and its tip, in CSS pixels. */
const GAP = 8;

/**
 * Wraps one control with a tip. The tip is a dark rounded box in a portal, so a scaled card never shrinks it. It opens
 * on hover and on keyboard focus, sits above the control (or below, or beside it, when there is no room), always stays
 * inside the window and never covers the control. Escape hides it. The control gets `aria-describedby`, so screen
 * readers read the tip as its description; the tip stays in the page while closed for that reason.
 *
 * A rich tip (`content`) has an UPPERCASE title, the vampire's line in quotes, a bullet list and a small grey note.
 * A plain tip (`text`, with an optional `note`) is one line.
 */
export function Tooltip({
  text,
  content,
  placement = 'top',
  hidden = false,
  note,
  children,
}: {
  text?: string;
  content?: TipContent;
  /** Optional second line of a plain tip, for example the full tab title. */
  note?: string;
  placement?: 'top' | 'bottom';
  /** Hide the tip, for example while a popover from the same button is open. */
  hidden?: boolean;
  children: (props: { 'aria-describedby': string }) => ReactElement;
}) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pos, setPosState] = useState<{ left: number; top: number } | null>(null);
  // Only a real move re-renders, so placing the tip can never loop.
  const setPos = useCallback((next: { left: number; top: number } | null) => {
    setPosState((cur) => (cur === next || (cur && next && cur.left === next.left && cur.top === next.top) ? cur : next));
  }, []);
  // When the popover from this button closes (a theme picked, Escape, a click outside), keep the tip closed until the
  // pointer leaves or focus moves away, so it does not pop back up over the page.
  const wasHidden = useRef(hidden);
  useLayoutEffect(() => {
    if (wasHidden.current && !hidden) setDismissed(true);
    wasHidden.current = hidden;
  }, [hidden]);
  const open = (hover || focus) && !dismissed && !hidden;
  const place = useCallback(() => {
    const anchor = wrap.current?.firstElementChild ?? wrap.current;
    const el = tip.current;
    if (!anchor || !el) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // A tip that prefers the bottom (header buttons) goes below when it fits there.
    if (placement === 'bottom' && a.bottom + GAP + h <= vh - GAP) {
      setPos({ left: Math.round(Math.min(Math.max(a.left + a.width / 2 - w / 2, GAP), Math.max(GAP, vw - w - GAP))), top: Math.round(a.bottom + GAP) });
      return;
    }
    const p = placePopup(a, w, h, vw, vh, GAP, GAP);
    setPos({ left: Math.round(p.left), top: Math.round(p.top) });
  }, [placement, setPos]);
  const key = content ? `${content.title}|${content.says ?? ''}|${content.points.join('|')}|${content.note ?? ''}` : `${text ?? ''}|${note ?? ''}`;
  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place, setPos, key]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setDismissed(true);
  };
  const keyboardFocus = (e: FocusEvent) => {
    try {
      return (e.target as HTMLElement).matches(':focus-visible');
    } catch {
      return true;
    }
  };
  const body = (
    <span
      ref={tip}
      role="tooltip"
      id={id}
      className={`tip tip-${placement}${content ? ' tip-rich' : ''}`}
      data-open={open && pos ? 'true' : undefined}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
    >
      {content ? (
        <>
          <span className="tip-title">{content.title}</span>
          {content.says && <span className="tip-says">{`\u201c${content.says}\u201d`}</span>}
          {content.points.length > 0 && (
            <span className="tip-points">
              {content.points.map((p) => (
                <span key={p} className="tip-point">
                  {p}
                </span>
              ))}
            </span>
          )}
          {content.note && <span className="tip-note">{content.note}</span>}
        </>
      ) : (
        <>
          <span className="tip-text">{text}</span>
          {note && <span className="tip-note">{note}</span>}
        </>
      )}
    </span>
  );
  return (
    <span
      ref={wrap}
      className="tip-wrap"
      data-dismissed={dismissed || hidden || undefined}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setDismissed(false);
      }}
      onFocus={(e) => setFocus(keyboardFocus(e))}
      onBlur={() => {
        setFocus(false);
        setDismissed(false);
      }}
    >
      {children({ 'aria-describedby': id })}
      {typeof document === 'undefined' ? body : createPortal(body, document.body)}
    </span>
  );
}
