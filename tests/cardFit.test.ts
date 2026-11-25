import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTION_BUTTON_PX, CARD_GAP, CARD_H, CARD_W, MAX_SCALE, MIN_BUTTON_PX, MIN_SCALE, capacityAt, fitCards } from '../lib/cardFit';

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
      expect(Math.ceil(n / cols) * (CARD_H * fit.scale + CARD_GAP) - CARD_GAP).toBeLessThanOrEqual(640);
      expect(cols * (CARD_W * fit.scale + CARD_GAP) - CARD_GAP).toBeLessThanOrEqual(1400);
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
  it('are never smaller than 28 px on screen', () => {
    expect(ACTION_BUTTON_PX * MIN_SCALE).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
    for (const [w, h, n] of [[1400, 480, 40], [800, 300, 19], [2560, 1300, 60]] as const) {
      expect(ACTION_BUTTON_PX * fitCards(w, h, n).scale).toBeGreaterThanOrEqual(28);
    }
  });
  it('match the size in cards.css', () => {
    const css = readFileSync('entrypoints/newtab/styles/cards.css', 'utf8');
    expect(css).toMatch(new RegExp(`\\.card-actions \\.icon-btn \\{\\s*width: ${ACTION_BUTTON_PX}px;\\s*height: ${ACTION_BUTTON_PX}px;`));
  });
});
describe('using the whole free height when the tabs do not fit in the share', () => {
  it('shows more cards, never fewer', () => {
    const share = fitCards(1400, 560, 19);
    const full = fitCards(1400, 560, 19, 700);
    expect(full.shown).toBeGreaterThan(share.shown);
    expect(fitCards(1400, 560, 3, 700)).toEqual(fitCards(1400, 560, 3));
  });
});
