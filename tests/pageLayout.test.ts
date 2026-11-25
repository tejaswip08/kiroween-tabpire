// The Crypt page at small and usual window sizes, with 19 tabs: the cards never overlap the header, the search box, the
// pinned pages or the chips, and the page never scrolls. The cards area sizes come from the real page in a headless
// browser (`npm run layout:check -- --write`, which also checks the real element boxes); this test checks that
// `fitCards` keeps every card inside that area, with action buttons of at least 28 px and a "+N more" card for the rest.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, MAX_HEIGHT_SHARE, MAX_ROWS, buttonPxAt, capacityAt, fitCards, gapAt } from '../lib/cardFit';

interface Measured { width: number; height: number; areaWidth: number; areaHeight: number; cards: number; more: number }
const fixture = JSON.parse(readFileSync('tests/fixtures/page-layout.json', 'utf8')) as {
  tabs: number;
  windows: { width: number; height: number }[];
  measured: Measured[];
};

describe('page layout with 19 tabs', () => {
  it('was measured at 800x600, 1280x600, 1440x900 and 1920x1080', () => {
    expect(fixture.tabs).toBe(19);
    expect(fixture.measured.map((m) => `${m.width}x${m.height}`)).toEqual(['800x600', '1280x600', '1440x900', '1920x1080', '1366x768']);
  });
  describe.each(fixture.measured)('at $width x $height', (m) => {
    // The same numbers CardGrid passes: the area width, the area height capped to a share of the window, and the full height.
    const fit = fitCards(m.areaWidth, Math.min(m.areaHeight, m.height * MAX_HEIGHT_SHARE), fixture.tabs, m.areaHeight);
    const slots = fit.shown + (fit.more > 0 ? 1 : 0);
    const { cols } = capacityAt(m.areaWidth, m.areaHeight, fit.scale);
    it('keeps every card inside the cards area, so nothing overlaps the controls and the page does not scroll', () => {
      const rows = Math.ceil(slots / cols);
      const g = gapAt(fit.scale);
      expect(rows).toBeLessThanOrEqual(MAX_ROWS);
      expect(rows * (CARD_H * fit.scale + g) - g).toBeLessThanOrEqual(m.areaHeight + 1e-6);
      expect(Math.min(slots, cols) * (CARD_W * fit.scale + g) - g).toBeLessThanOrEqual(m.areaWidth + 1e-6);
    });
    it('keeps the action buttons at least 28 px', () => {
      expect(buttonPxAt(fit.scale)).toBeGreaterThanOrEqual(28 - 1e-9);
    });
    it('shows at least one card, every tab when the window is 1440 x 900 or larger, and "+N more" otherwise', () => {
      if (m.width >= 1440 && m.height >= 900) expect([fit.shown, fit.more]).toEqual([fixture.tabs, 0]);
      expect(fit.shown).toBeGreaterThanOrEqual(1);
      expect(fit.shown + fit.more).toBe(fixture.tabs);
      // The real page showed the same.
      expect([fit.shown, fit.more]).toEqual([m.cards, m.more]);
    });
  });
  it('the short-window rules exist, so 800x600 has room for a row of cards', () => {
    const css = readFileSync('entrypoints/newtab/styles/compact.css', 'utf8');
    expect(css).toMatch(/@media \(max-height: 760px\)/);
  });
});
