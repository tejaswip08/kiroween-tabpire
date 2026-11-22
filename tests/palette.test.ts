import { describe, expect, it } from 'vitest';
import { ACCENT, COLD, COLD_HUE_RANGE, WARM, WARM_HUE_RANGE, hueOf } from '../lib/scene/palette';
import { mulberry32 } from '../lib/scene/rng';

describe('hueOf', () => {
  it.each([
    ['#ff0000', 0],
    ['#00ff00', 120],
    ['#0000ff', 240],
    ['#ffff00', 60],
    ['#00ffff', 180],
    ['#ff00ff', 300],
    ['#808080', 0],
  ])('%s is %i degrees', (hex, hue) => {
    expect(hueOf(hex)).toBeCloseTo(hue, 5);
  });
});

describe('scene palette', () => {
  it('keeps every cold colour between 210 and 280 degrees', () => {
    for (const [name, hex] of Object.entries(COLD)) {
      const h = hueOf(hex);
      expect(h, name).toBeGreaterThanOrEqual(COLD_HUE_RANGE[0]);
      expect(h, name).toBeLessThanOrEqual(COLD_HUE_RANGE[1]);
    }
  });

  it('keeps every warm colour between 10 and 50 degrees', () => {
    for (const [name, hex] of Object.entries(WARM)) {
      const h = hueOf(hex);
      expect(h, name).toBeGreaterThanOrEqual(WARM_HUE_RANGE[0]);
      expect(h, name).toBeLessThanOrEqual(WARM_HUE_RANGE[1]);
    }
  });

  it('keeps warm and cold well apart', () => {
    const warmMax = Math.max(...Object.values(WARM).map(hueOf));
    const coldMin = Math.min(...Object.values(COLD).map(hueOf));
    expect(coldMin - warmMax).toBeGreaterThan(150);
  });

  it('has a red moon', () => {
    const h = hueOf(ACCENT.moon);
    expect(h > 340 || h < 10).toBe(true);
  });
});

describe('mulberry32', () => {
  it('gives the same numbers for the same seed, in range', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(8)()).not.toBe(mulberry32(7)());
  });
});
