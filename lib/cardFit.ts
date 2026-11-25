// Fits all the tab cards on one screen. Pure: no DOM.
/** A card at full size, in CSS pixels (the same numbers as --card-width and --card-height in base.css). */
export const CARD_W = 220;
export const CARD_H = 380;
/** Space between cards at full size, in CSS pixels. It shrinks with the cards (`gap` in cards.css). */
export const CARD_GAP = 16;
/** The gap between cards at a scale. */
export const gapAt = (scale: number): number => CARD_GAP * scale;
/** The action buttons on a card at full size (`.card-actions .icon-btn` in cards.css), in CSS pixels. */
export const ACTION_BUTTON_PX = 36;
/**
 * The action buttons never get smaller than this on screen: below the scale where 36 px would shrink under 28 px,
 * cards.css makes the buttons bigger inside the card (`28px / scale`), so on screen they stay 28 px.
 */
export const MIN_BUTTON_PX = 28;
/** The size of an action button on screen at a card scale. */
export const buttonPxAt = (scale: number): number => Math.max(ACTION_BUTTON_PX, MIN_BUTTON_PX / scale) * scale;
/**
 * Below this scale a card is "compact": its action row uses the card's full inner width, so four 28 px buttons fit.
 * It is the scale where a 36 px button is 28 px on screen.
 */
export const COMPACT_BELOW = MIN_BUTTON_PX / ACTION_BUTTON_PX;
/** Smallest and largest card scale. At 0.56 a card is 123 x 213 px and four 28 px buttons still fit across it. */
export const MIN_SCALE = 0.56;
export const MAX_SCALE = 1;
/** The cards use at most two rows; more tabs shrink the cards, and only below the smallest size are any hidden. */
export const MAX_ROWS = 2;
/** The cards use at most this share of the window height, so the path and the gate stay visible above them. */
export const MAX_HEIGHT_SHARE = 0.52;
export interface CardFit {
  /** Scale of every card, from MIN_SCALE to MAX_SCALE. */
  scale: number;
  /** How many cards are shown. The rest are behind the "+N more" button. */
  shown: number;
  /** Tabs that do not fit at the smallest size (0 when all fit, or when there is no room for any card). */
  more: number;
}
/** How many cards fit in a row and in a column (at most `MAX_ROWS`) at `scale`. */
export function capacityAt(width: number, height: number, scale: number): { cols: number; rows: number } {
  const g = gapAt(scale);
  const cols = Math.max(0, Math.floor((width + g + 1e-6) / (CARD_W * scale + g)));
  const rows = Math.min(MAX_ROWS, Math.max(0, Math.floor((height + g + 1e-6) / (CARD_H * scale + g))));
  return { cols, rows };
}
/**
 * The largest card scale at which `count` cards fit in `width` x `height` (`fullHeight`: the whole free height, used
 * only when they do not all fit in `height`). If they do not fit even at the
 * smallest scale, the hungriest ones are shown and one slot becomes the "+N more" card. With no size
 * (the page is not laid out yet) every card is shown at full size.
 */
export function fitCards(width: number, height: number, count: number, fullHeight = height): CardFit {
  const first = fitIn(width, height, count);
  // When the tabs do not all fit in the share of the window kept for the cards, the whole free space may be used, so
  // more of them are shown at the smallest size (the path and the gate are then partly behind the cards).
  if (first.more === 0 && first.shown === Math.max(0, Math.floor(count))) return first;
  if (!(fullHeight > height)) return first;
  const full = fitIn(width, fullHeight, count);
  return full.shown > first.shown ? full : first;
}
function fitIn(width: number, height: number, count: number): CardFit {
  const n = Math.max(0, Math.floor(count));
  if (!(width > 0) || !(height > 0) || n === 0) return { scale: MAX_SCALE, shown: n, more: 0 };
  // Whole hundredths, so the scale returned is exactly the scale that was checked.
  for (let k = Math.round(MAX_SCALE * 100); k >= Math.round(MIN_SCALE * 100); k--) {
    const s = k / 100;
    const { cols, rows } = capacityAt(width, height, s);
    if (cols * rows >= n) return { scale: s, shown: n, more: 0 };
  }
  const { cols, rows } = capacityAt(width, height, MIN_SCALE);
  // The hungriest that fit, and one slot is the "+N more" card. Never more slots than fit, so the cards never overlap
  // the header, the search box or the chips, and the page never scrolls. With no slot at all nothing is shown.
  const slots = cols * rows;
  if (slots === 0) return { scale: MIN_SCALE, shown: 0, more: 0 };
  const shown = slots - 1;
  return { scale: MIN_SCALE, shown, more: n - shown };
}
