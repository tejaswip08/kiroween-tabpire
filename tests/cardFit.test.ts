import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTION_BUTTON_PX, CARD_H, CARD_W, COMPACT_BELOW, MAX_ROWS, MAX_SCALE, MIN_BUTTON_PX, MIN_SCALE, buttonPxAt, capacityAt, fitCards, gapAt } from '../lib/cardFit';

describe('fitCards', () => {
  it('shows every card at full size when they fit', () => {
    expect(fitCards(1400, 520, 6)).toEqual({ scale: 1, shown: 6, more: 0 });
  });
  it('shrinks the cards so all of them fit in the space', () => {
    // The smallest scale keeps the action buttons at 28 px, so fewer cards fit than before: 1400 x 640 holds 14.
    for (const n of [8, 10, 12, 14]) {
      const fit = fitCards(1400, 640, n);
      expect(fit.more, `n=${n}`).toBe(0);
      expect(fit.scale).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(fit.scale).toBeLessThan(MAX_SCALE);
      const { cols, rows } = capacityAt(1400, 640, fit.scale);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
      // The grid is no taller than the space.
      expect(Math.ceil(n / cols) * (CARD_H * fit.scale + gapAt(fit.scale)) - gapAt(fit.scale)).toBeLessThanOrEqual(640);
      expect(cols * (CARD_W * fit.scale + gapAt(fit.scale)) - gapAt(fit.scale)).toBeLessThanOrEqual(1400);
    }
  });
  it('picks the largest scale that fits (more tabs never make cards bigger)', () => {
    let prev = Infinity;
    for (let n = 1; n <= 24; n++) {
      const s = fitCards(1300, 460, n).scale;
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
  it('keeps the smallest size and shows the hungriest plus a "+N more" slot when there are too many', () => {
    const fit = fitCards(1000, 300, 100);
    expect(fit.scale).toBe(MIN_SCALE);
    const { cols, rows } = capacityAt(1000, 300, MIN_SCALE);
    expect(fit.shown).toBe(cols * rows - 1);
    expect(fit.shown + fit.more).toBe(100);
    expect(fit.more).toBeGreaterThan(0);
  });
  it('shows everything at full size before the page is laid out', () => {
    expect(fitCards(0, 0, 300)).toEqual({ scale: 1, shown: 300, more: 0 });
  });
  it('handles no tabs and a tiny space', () => {
    expect(fitCards(800, 400, 0).shown).toBe(0);
    // No room for even one card at the smallest size: nothing is shown, so nothing can overlap the controls.
    expect(fitCards(120, 90, 10)).toEqual({ scale: MIN_SCALE, shown: 0, more: 0 });
    // Room for one slot only: it is the "+N more" card.
    const one = fitCards(CARD_W * MIN_SCALE, CARD_H * MIN_SCALE, 10);
    expect(one.shown + 1).toBe(1);
    expect(one.more).toBe(10);
  });
});
describe('the action buttons', () => {
  it('are never smaller than 28 px on screen: below 0.78 they grow inside the card', () => {
    expect(buttonPxAt(1)).toBe(ACTION_BUTTON_PX);
    expect(buttonPxAt(MIN_SCALE)).toBeCloseTo(MIN_BUTTON_PX, 9);
    expect(COMPACT_BELOW).toBeCloseTo(28 / 36, 9);
    for (const [w, h, n] of [[1400, 480, 40], [800, 300, 19], [2560, 1300, 60]] as const) {
      expect(buttonPxAt(fitCards(w, h, n).scale)).toBeGreaterThanOrEqual(28 - 1e-9);
    }
    // Four of them fit across the smallest card: its width less the border (3 px each side) and 2 px each side.
    expect(4 * (MIN_BUTTON_PX / MIN_SCALE) + 3 * 2).toBeLessThanOrEqual(CARD_W - 6 - 4);
  });
  it('the compact buttons in cards.css use the same rule', () => {
    const css = readFileSync('entrypoints/newtab/styles/cards.css', 'utf8');
    expect(css).toMatch(/\.card-grid\[data-compact\] \.card-actions \.icon-btn \{\s*width: calc\(28px \/ var\(--card-scale\)\);/);
  });
  it('uses at most two rows', () => {
    expect(MAX_ROWS).toBe(2);
    expect(capacityAt(1400, 5000, MIN_SCALE).rows).toBe(2);
  });
  it('match the size in cards.css', () => {
    const css = readFileSync('entrypoints/newtab/styles/cards.css', 'utf8');
    expect(css).toMatch(new RegExp(`\\.card-actions \\.icon-btn \\{\\s*width: ${ACTION_BUTTON_PX}px;\\s*height: ${ACTION_BUTTON_PX}px;`));
  });
});
describe('using the whole free height when the tabs do not fit in the share', () => {
  it('shows more cards, never fewer', () => {
    const share = fitCards(1400, 220, 30);
    const full = fitCards(1400, 220, 30, 700);
    expect(full.shown).toBeGreaterThan(share.shown);
    expect(fitCards(1400, 560, 3, 700)).toEqual(fitCards(1400, 560, 3));
  });
});
