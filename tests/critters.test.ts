import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  SKELETON_LOOP_S, catEarTwitch, catTailAngle, crowPose, hash01, owlEyeOpen, owlHeadYaw, skeletonRise, spiderLength, wispGlow, wispOffset,
} from '../lib/scene/critters';

const times = Array.from({ length: 4000 }, (_, i) => i * 0.037);

describe('hash01', () => {
  it('is repeatable and between 0 and 1', () => {
    for (let k = 0; k < 200; k++) {
      const v = hash01(3, k);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hash01(3, k)).toBe(v);
    }
  });
});

describe('crows', () => {
  it('stay within small limits, and every hop and head turn starts and ends at rest', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let hops = 0;
      let turns = 0;
      let prev = crowPose(0, seed);
      for (const t of times) {
        const p = crowPose(t, seed);
        expect(p.hop).toBeGreaterThanOrEqual(0);
        expect(p.hop).toBeLessThanOrEqual(0.17);
        expect(Math.abs(p.headYaw)).toBeLessThanOrEqual(1.0);
        expect(Math.abs(p.headPitch)).toBeLessThanOrEqual(0.13);
        // No jumps between frames.
        expect(Math.abs(p.hop - prev.hop)).toBeLessThan(0.05);
        expect(Math.abs(p.headYaw - prev.headYaw)).toBeLessThan(0.15);
        if (p.hop > 0.1) hops++;
        if (Math.abs(p.headYaw) > 0.6) turns++;
        prev = p;
      }
      expect(hops).toBeGreaterThan(0);
      expect(turns).toBeGreaterThan(0);
    }
  });
  it('do not all move together', () => {
    const at = (s: number) => times.filter((t) => crowPose(t, s).hop > 0.1).slice(0, 5).join();
    expect(at(1)).not.toBe(at(2));
  });
});

describe('owl', () => {
  it('blinks now and then: eyes open most of the time, shut for a moment, always between 0 and 1', () => {
    let shut = 0;
    let open = 0;
    for (const t of times) {
      const v = owlEyeOpen(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (v < 0.1) shut++;
      if (v > 0.99) open++;
    }
    expect(shut).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(times.length * 0.8);
    expect(owlEyeOpen(0)).toBe(1);
  });
  it('turns its head slowly within limits', () => {
    for (const t of times) expect(Math.abs(owlHeadYaw(t))).toBeLessThanOrEqual(0.35);
  });
});

describe('cat', () => {
  it('swishes its tail within limits, smoothly', () => {
    let prev = catTailAngle(0);
    for (const t of times) {
      const a = catTailAngle(t);
      expect(Math.abs(a)).toBeLessThanOrEqual(0.76);
      expect(Math.abs(a - prev)).toBeLessThan(0.1);
      prev = a;
    }
  });
  it('twitches an ear now and then', () => {
    const v = times.map(catEarTwitch);
    expect(Math.max(...v)).toBeGreaterThan(0.1);
    expect(Math.min(...v)).toBe(0);
  });
});

describe('spiders', () => {
  it('hang between a third and all of the thread, bobbing', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.integer({ min: 0, max: 50 }), fc.double({ min: 0, max: 5, noNaN: true }), (t, seed, drop) => {
        const l = spiderLength(t, seed, drop);
        expect(l).toBeGreaterThanOrEqual(drop * 0.35 - 1e-9);
        expect(l).toBeLessThanOrEqual(drop + 1e-9);
      }),
    );
    expect(spiderLength(NaN, 1, 2)).toBeGreaterThan(0);
  });
});

describe('skeletons', () => {
  it('rest, rise, hold and sink in a loop, starting and ending hidden, and smoothly', () => {
    for (const seed of [0, 1, 2]) {
      let prev = skeletonRise(0, seed);
      let up = 0;
      let hidden = 0;
      for (let i = 0; i <= SKELETON_LOOP_S * 100 * 2; i++) {
        const r = skeletonRise(i / 100, seed);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(Math.abs(r - prev)).toBeLessThan(0.02);
        if (r === 1) up++;
        if (r === 0) hidden++;
        prev = r;
      }
      expect(up).toBeGreaterThan(100);
      expect(hidden).toBeGreaterThan(100);
      expect(skeletonRise(SKELETON_LOOP_S - seed * 4.7 + 0.0001 * 0, seed)).toBeCloseTo(skeletonRise(0 - seed * 4.7 + 0, seed), 6);
    }
  });
  it('do not rise together', () => {
    expect(skeletonRise(5, 0)).not.toBeCloseTo(skeletonRise(5, 1), 2);
  });
});

describe('wisps', () => {
  it('drift in small loops and glow softly', () => {
    const out = { x: 0, y: 0, z: 0 };
    for (const t of times) {
      wispOffset(t, 3, out);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(1.7 + 1e-9);
      expect(Math.abs(out.y)).toBeLessThanOrEqual(0.45 + 1e-9);
      expect(Math.abs(out.z)).toBeLessThanOrEqual(1.4 + 1e-9);
      const g = wispGlow(t, 3);
      expect(g).toBeGreaterThanOrEqual(0.64);
      expect(g).toBeLessThanOrEqual(1.0);
    }
  });
});
