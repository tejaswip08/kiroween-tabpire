// Where the card popup goes. Pure: numbers in, numbers out.
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface PopupPlace {
  left: number;
  top: number;
  /** Where the popup sits next to the card. */
  side: 'above' | 'right' | 'left' | 'below';
}
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Puts a popup of `w` x `h` next to a card. It prefers the space above the card (centred on it), then the
 * right side, then the left side, then below. It always stays inside the window, `margin` from every edge,
 * and it never covers the card itself unless the window is too small to avoid it.
 */
export function placePopup(card: Rect, w: number, h: number, vw: number, vh: number, gap = 12, margin = 8): PopupPlace {
  const cx = (card.left + card.right) / 2;
  const cy = (card.top + card.bottom) / 2;
  if (card.top - gap - h >= margin) return { side: 'above', left: clamp(cx - w / 2, margin, vw - w - margin), top: card.top - gap - h };
  const sideTop = clamp(cy - h / 2, margin, vh - h - margin);
  if (card.right + gap + w <= vw - margin) return { side: 'right', left: card.right + gap, top: sideTop };
  if (card.left - gap - w >= margin) return { side: 'left', left: card.left - gap - w, top: sideTop };
  if (card.bottom + gap + h <= vh - margin) return { side: 'below', left: clamp(cx - w / 2, margin, vw - w - margin), top: card.bottom + gap };
  return { side: 'above', left: clamp(cx - w / 2, margin, vw - w - margin), top: clamp(card.top - gap - h, margin, vh - h - margin) };
}
