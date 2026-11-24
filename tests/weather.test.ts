// Feature: themes, Property 14: Weather is bounded
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { WEATHER } from '../lib/scene/weather';
import { THEMES, type ThemeId, type WeatherKind } from '../lib/themes';
const KINDS = Object.keys(WEATHER) as WeatherKind[];
const EXPECTED: Record<ThemeId, WeatherKind | null> = {
  crypt: null, pumpkin: 'leaves', forest: 'fireflies', frost: 'snow', bloodmoon: 'ash', castle: 'embers',
};
describe('weather (Property 14)', () => {
  it('every count is at most 2,000 and every reducedCount is at most a quarter of it', () => {
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), (kind) => {
        const w = WEATHER[kind];
        expect(w.kind).toBe(kind);
        expect(w.count).toBeGreaterThan(0);
        expect(w.count).toBeLessThanOrEqual(2000);
        expect(w.reducedCount).toBeGreaterThan(0);
        expect(w.reducedCount).toBeLessThanOrEqual(w.count / 4);
      }),
    );
  });
  it('has the five kinds of the design', () => {
    expect([...KINDS].sort()).toEqual(['ash', 'embers', 'fireflies', 'leaves', 'snow']);
  });
  it('maps each theme to its weather', () => {
    fc.assert(
      fc.property(fc.constantFrom(...THEMES), (t) => {
        expect(t.weather).toBe(EXPECTED[t.id]);
      }),
    );
  });
});
