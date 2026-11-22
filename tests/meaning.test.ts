import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CAPS } from '../lib/scene/config';
import { FOG, HALO, approach, hungerShare, sceneState, type SceneInputs } from '../lib/scene/meaning';
import { FLICKER_MAX, FLICKER_MIN, flicker } from '../lib/scene/flicker';

const base: SceneInputs = {
  cardCount: 10,
  starvingCount: 0,
  estimatedMb: 0,
  cryptCount: 0,
  crypted: 0,
  garlicCount: 0,
  staked: 0,
  coffined: 0,
  dawnReady: false,
};

const anyNumber = fc.oneof(fc.integer({ min: -50, max: 500 }), fc.double({ min: -50, max: 500, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity));
const inputsArb: fc.Arbitrary<SceneInputs> = fc.record({
  cardCount: anyNumber,
  starvingCount: anyNumber,
  estimatedMb: fc.oneof(anyNumber, fc.integer({ min: 0, max: 20000 })),
  cryptCount: anyNumber,
  crypted: anyNumber,
  garlicCount: anyNumber,
  staked: anyNumber,
  coffined: anyNumber,
  dawnReady: fc.boolean(),
});

describe('sceneState', () => {
  it('keeps every count whole, never negative and within its cap', () => {
    fc.assert(
      fc.property(inputsArb, (i) => {
        const s = sceneState(i);
        const caps = { ghosts: CAPS.ghosts, bats: CAPS.bats, candles: CAPS.candles, newGraves: CAPS.newGraves, coffins: CAPS.coffins };
        for (const [key, cap] of Object.entries(caps)) {
          const v = s[key as keyof typeof caps];
          expect(Number.isInteger(v), key).toBe(true);
          expect(v, key).toBeGreaterThanOrEqual(0);
          expect(v, key).toBeLessThanOrEqual(cap);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('matches the data below the caps', () => {
    const s = sceneState({ ...base, cryptCount: 3, crypted: 9, garlicCount: 5, staked: 14, coffined: 2 });
    expect(s).toMatchObject({ ghosts: 3, bats: 9, candles: 5, newGraves: 14, coffins: 2 });
  });

  it('caps at the limits in the requirements', () => {
    const s = sceneState({ ...base, cryptCount: 99, crypted: 99, garlicCount: 99, staked: 99, coffined: 99 });
    expect(s).toMatchObject({ ghosts: 8, bats: 24, candles: 12, newGraves: 24, coffins: 8 });
  });

  it('floors fractions and ignores bad numbers', () => {
    expect(sceneState({ ...base, staked: 3.9 }).newGraves).toBe(3);
    expect(sceneState({ ...base, staked: NaN, crypted: -4, cryptCount: Infinity }).newGraves).toBe(0);
    expect(sceneState({ ...base, cryptCount: Infinity }).ghosts).toBe(0);
  });

  it('has the halo from the requirements at share 0 and 1', () => {
    const calm = sceneState({ ...base, cardCount: 10, starvingCount: 0 });
    expect(calm.haloPeriodS).toBe(6);
    expect(calm.haloAmplitude).toBeCloseTo(0.06);
    const hungry = sceneState({ ...base, cardCount: 10, starvingCount: 10 });
    expect(hungry.haloPeriodS).toBe(2.5);
    expect(hungry.haloAmplitude).toBeCloseTo(0.2);
    expect(sceneState({ ...base, cardCount: 0, starvingCount: 3 }).haloPeriodS).toBe(6);
  });

  it('pulses faster and stronger as more tabs starve', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.nat(100), fc.nat(100), (cards, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const low = sceneState({ ...base, cardCount: cards, starvingCount: lo });
        const high = sceneState({ ...base, cardCount: cards, starvingCount: hi });
        expect(high.haloPeriodS).toBeLessThanOrEqual(low.haloPeriodS + 1e-12);
        expect(high.haloAmplitude).toBeGreaterThanOrEqual(low.haloAmplitude - 1e-12);
        expect(high.haloPeriodS).toBeGreaterThanOrEqual(HALO.periodHungry - 1e-12);
        expect(low.haloPeriodS).toBeLessThanOrEqual(HALO.periodCalm + 1e-12);
      }),
    );
  });

  it('keeps the fog between 70 and 130 percent, thicker with more memory', () => {
    expect(sceneState({ ...base, estimatedMb: 0 }).fogFactor).toBeCloseTo(0.7);
    expect(sceneState({ ...base, estimatedMb: 8000 }).fogFactor).toBeCloseTo(1.3);
    expect(sceneState({ ...base, estimatedMb: 80000 }).fogFactor).toBeCloseTo(1.3);
    expect(sceneState({ ...base, estimatedMb: -5 }).fogFactor).toBeCloseTo(0.7);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30000 }), fc.integer({ min: 0, max: 30000 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const fl = sceneState({ ...base, estimatedMb: lo }).fogFactor;
        const fh = sceneState({ ...base, estimatedMb: hi }).fogFactor;
        expect(fh).toBeGreaterThanOrEqual(fl - 1e-12);
        expect(fl).toBeGreaterThanOrEqual(FOG.min - 1e-12);
        expect(fh).toBeLessThanOrEqual(FOG.max + 1e-12);
      }),
    );
  });

  it('sends more embers when more tabs starve', () => {
    const none = sceneState({ ...base, starvingCount: 0 }).emberRate;
    const some = sceneState({ ...base, starvingCount: 6 }).emberRate;
    const many = sceneState({ ...base, starvingCount: 40 }).emberRate;
    expect(none).toBeCloseTo(0.15);
    expect(some).toBeGreaterThan(none);
    expect(many).toBeCloseTo(1);
  });

  it('shows the witch only while Dawn is ready', () => {
    expect(sceneState({ ...base, dawnReady: true }).witch).toBe(true);
    expect(sceneState({ ...base, dawnReady: false }).witch).toBe(false);
  });
});

describe('hungerShare', () => {
  it('is within 0 and 1', () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, (cards, starving) => {
        const s = hungerShare(cards, starving);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe('approach', () => {
  it('moves toward the target and never overshoots', () => {
    fc.assert(
      fc.property(fc.double({ min: -100, max: 100, noNaN: true }), fc.double({ min: -100, max: 100, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 50, noNaN: true }), (cur, target, dt, rate) => {
        const next = approach(cur, target, dt, rate);
        const lo = Math.min(cur, target) - 1e-9;
        const hi = Math.max(cur, target) + 1e-9;
        expect(next).toBeGreaterThanOrEqual(lo);
        expect(next).toBeLessThanOrEqual(hi);
      }),
    );
  });

  it('does not move when no time passes, and reaches the target in the end', () => {
    expect(approach(3, 9, 0, 5)).toBe(3);
    let v = 0;
    for (let i = 0; i < 600; i++) v = approach(v, 10, 1 / 60, 3);
    expect(v).toBeCloseTo(10, 3);
  });

  it('gives the same result for one big step or many small ones', () => {
    let small = 0;
    for (let i = 0; i < 100; i++) small = approach(small, 10, 0.01, 4);
    expect(approach(0, 10, 1, 4)).toBeCloseTo(small, 6);
  });
});

describe('flicker', () => {
  it('stays near 1 and inside its limits', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 10_000, noNaN: true }), fc.integer({ min: 0, max: 1000 }), (t, seed) => {
        const f = flicker(t, seed);
        expect(f).toBeGreaterThanOrEqual(FLICKER_MIN);
        expect(f).toBeLessThanOrEqual(FLICKER_MAX);
      }),
    );
  });

  it('changes in small steps between frames', () => {
    for (let seed = 0; seed < 8; seed++) {
      let prev = flicker(0, seed);
      for (let i = 1; i <= 3000; i++) {
        const cur = flicker(i / 60, seed);
        expect(Math.abs(cur - prev)).toBeLessThan(0.04);
        prev = cur;
      }
    }
  });

  it('differs between lights, and is exactly 1 with reduced motion', () => {
    expect(flicker(3.3, 1)).not.toBe(flicker(3.3, 2));
    expect(flicker(3.3, 1, true)).toBe(1);
    expect(flicker(123.4, 9, true)).toBe(1);
  });
});
