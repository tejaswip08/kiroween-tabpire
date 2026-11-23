// Fits all the tab cards on one screen. Pure: no DOM.
/** A card at full size, in CSS pixels (the same numbers as --card-width and --card-height in base.css). */
export const CARD_W = 220;
export const CARD_H = 380;
/** Space between cards, in CSS pixels (not scaled). */
export const CARD_GAP = 16;
/** Smallest and largest card scale. At 0.55 a card is 121 x 209 px. */
export const MIN_SCALE = 0.55;
export const MAX_SCALE = 1;
/** The cards use at most this share of the window height, so the path and the gate stay visible above them. */
export const MAX_HEIGHT_SHARE = 0.52;

export interface CardFit {
  /** Scale of every card, from MIN_SCALE to MAX_SCALE. */
  scale: number;
  /** How many cards are shown. The rest are the "+N more" card. */
  shown: number;
  /** Tabs that do not fit at the smallest size (0 when all fit). */
  more: number;
}

/** How many cards fit in a row and in a column at `scale`. */
export function capacityAt(width: number, height: number, scale: number): { cols: number; rows: number } {
  const cols = Math.max(0, Math.floor((width + CARD_GAP) / (CARD_W * scale + CARD_GAP)));
  const rows = Math.max(0, Math.floor((height + CARD_GAP) / (CARD_H * scale + CARD_GAP)));
  return { cols, rows };
}

/**
 * The largest card scale at which `count` cards fit in `width` x `height`. If they do not fit even at the
 * smallest scale, the hungriest ones are shown and one slot becomes the "+N more" card. With no size
 * (the page is not laid out yet) every card is shown at full size.
 */
export function fitCards(width: number, height: number, count: number): CardFit {
  const n = Math.max(0, Math.floor(count));
  if (!(width > 0) || !(height > 0) || n === 0) return { scale: MAX_SCALE, shown: n, more: 0 };
  for (let s = MAX_SCALE; s >= MIN_SCALE - 1e-9; s -= 0.01) {
    const { cols, rows } = capacityAt(width, height, s);
    if (cols * rows >= n) return { scale: Math.max(MIN_SCALE, Math.round(s * 100) / 100), shown: n, more: 0 };
  }
  const { cols, rows } = capacityAt(width, height, MIN_SCALE);
  // Always show at least one card and the "+N more" card.
  const slots = Math.max(2, cols * rows);
  const shown = slots - 1;
  return { scale: MIN_SCALE, shown, more: n - shown };
}
