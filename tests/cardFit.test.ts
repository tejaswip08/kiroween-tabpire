import { describe, expect, it } from 'vitest';
import { CARD_GAP, CARD_H, CARD_W, MAX_SCALE, MIN_SCALE, capacityAt, fitCards } from '../lib/cardFit';

describe('fitCards', () => {
  it('shows every card at full size when they fit', () => {
    expect(fitCards(1400, 520, 6)).toEqual({ scale: 1, shown: 6, more: 0 });
  });
  it('shrinks the cards so all of them fit in the space', () => {
    for (const n of [9, 12, 16, 20]) {
      const fit = fitCards(1400, 480, n);
      expect(fit.more, `n=${n}`).toBe(0);
      expect(fit.scale).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(fit.scale).toBeLessThan(MAX_SCALE);
      const { cols, rows } = capacityAt(1400, 480, fit.scale);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
      // The grid is no taller than the space.
      expect(Math.ceil(n / cols) * (CARD_H * fit.scale + CARD_GAP) - CARD_GAP).toBeLessThanOrEqual(480);
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
    const tiny = fitCards(120, 90, 10);
    expect(tiny.shown).toBeGreaterThanOrEqual(1);
    expect(tiny.shown + tiny.more).toBe(10);
  });
});
