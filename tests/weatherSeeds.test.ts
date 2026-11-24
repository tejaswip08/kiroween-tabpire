import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_ANCHORS, WEATHER, emberAnchors, weatherDrawCount, weatherSeeds, type WeatherSpec } from '../lib/scene/weather';
const SPECS = Object.values(WEATHER);
describe('weather helpers', () => {
  it('seeds are deterministic, in 0..1, four per particle', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SPECS), (s: WeatherSpec) => {
        const a = weatherSeeds(s.kind, s.count);
        expect(a).toHaveLength(s.count * 4);
        expect(weatherSeeds(s.kind, s.count)).toEqual(a);
        for (const v of a) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1);
        }
      }),
    );
  });
  it('draw count is count, or reducedCount under reduced motion, and never above 2000', () => {
    for (const s of SPECS) {
      expect(weatherDrawCount(s, false)).toBe(s.count);
      expect(weatherDrawCount(s, true)).toBe(s.reducedCount);
      expect(s.count).toBeLessThanOrEqual(2000);
    }
  });
  it('uses at most four anchors, and one fallback when there are none', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ x: i, y: 1, z: 0 }));
    expect(emberAnchors(many)).toHaveLength(MAX_ANCHORS);
    expect(emberAnchors([])).toHaveLength(1);
  });
});
