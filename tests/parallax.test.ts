import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cameraAt, project } from '../lib/scene/camera';
import { PARALLAX, parallaxOffsets, parallaxTarget, stepParallax, type PointerState, type Spring } from '../lib/scene/parallax';

const ptr = (over: Partial<PointerState> = {}): PointerState => ({ x: 960, y: 540, known: true, lastMove: 10, ...over });
const rest = (): Spring => ({ x: 0, y: 0, vx: 0, vy: 0 });

describe('parallaxTarget', () => {
  it('follows the pointer from -1 (left, top) to 1 (right, bottom)', () => {
    expect(parallaxTarget(ptr({ x: 0, y: 0 }), 1920, 1080, 10.5, false)).toEqual({ x: -1, y: -1 });
    expect(parallaxTarget(ptr({ x: 1920, y: 1080 }), 1920, 1080, 10.5, false)).toEqual({ x: 1, y: 1 });
    expect(parallaxTarget(ptr(), 1920, 1080, 10.5, false)).toEqual({ x: 0, y: 0 });
  });
  it('rests when the pointer left the window, stopped for a while, or reduced motion is on', () => {
    expect(parallaxTarget(ptr({ known: false }), 1920, 1080, 10.5, false)).toEqual({ x: 0, y: 0 });
    expect(parallaxTarget(ptr({ x: 1900 }), 1920, 1080, 10 + PARALLAX.idleSeconds + 0.1, false)).toEqual({ x: 0, y: 0 });
    expect(parallaxTarget(ptr({ x: 1900 }), 1920, 1080, 10.5, true)).toEqual({ x: 0, y: 0 });
  });
  it('stays within -1 and 1 for any input, and never makes NaN', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6 }), fc.double({ min: -1e6, max: 1e6 }), fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }), fc.boolean(), (x, y, w, h, reduced) => {
        const t = parallaxTarget(ptr({ x, y }), w * 1000, h * 1000, 10.2, reduced);
        for (const v of [t.x, t.y]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThanOrEqual(1);
        }
      }),
    );
  });
});

describe('stepParallax', () => {
  it('glides: it starts slowly, never overshoots, and settles at the target', () => {
    const s = rest();
    let prev = 0;
    const first = [];
    for (let i = 0; i < 600; i++) {
      stepParallax(s, { x: 1, y: 0 }, 1 / 60);
      expect(s.x).toBeLessThanOrEqual(1 + 1e-9);
      expect(s.x).toBeGreaterThanOrEqual(prev - 1e-9);
      if (i < 4) first.push(s.x - prev);
      prev = s.x;
    }
    // Eased start: the first steps are tiny and growing, not a jump.
    expect(first[0]!).toBeLessThan(0.01);
    expect(first[3]!).toBeGreaterThan(first[0]!);
    expect(s.x).toBeCloseTo(1, 3);
  });
  it('drifts back to rest more slowly than it follows, and stops there', () => {
    const go = rest();
    const back: Spring = { x: 1, y: 0, vx: 0, vy: 0 };
    let tGo = 0;
    let tBack = 0;
    for (let i = 0; i < 1200; i++) {
      stepParallax(go, { x: 1, y: 0 }, 1 / 60);
      stepParallax(back, { x: 0, y: 0 }, 1 / 60);
      if (!tGo && go.x > 0.9) tGo = i;
      if (!tBack && back.x < 0.1) tBack = i;
    }
    expect(tBack).toBeGreaterThan(tGo * 1.5);
    expect(Math.abs(back.x)).toBeLessThan(1e-3);
  });
  it('is the same at any frame rate, and ignores bad time steps', () => {
    const a = rest();
    const b = rest();
    for (let i = 0; i < 60; i++) stepParallax(a, { x: 1, y: 1 }, 1 / 60);
    for (let i = 0; i < 120; i++) stepParallax(b, { x: 1, y: 1 }, 1 / 120);
    expect(a.x).toBeCloseTo(b.x, 3);
    const c = rest();
    stepParallax(c, { x: 1, y: 1 }, NaN);
    stepParallax(c, { x: 1, y: 1 }, -3);
    stepParallax(c, { x: 1, y: 1 }, 99);
    expect(Number.isFinite(c.x + c.y + c.vx + c.vy)).toBe(true);
  });
});

describe('parallax offsets and depth', () => {
  it('stay small: a few degrees of view', () => {
    const out = new Float64Array(4);
    parallaxOffsets(1, 1, out);
    expect(Math.abs(out[0]!)).toBeLessThanOrEqual(PARALLAX.maxX);
    expect(Math.abs(out[1]!)).toBeLessThanOrEqual(PARALLAX.maxY);
    // Sideways, the camera and its target move together, so the view only turns a little.
    const yawDeg = (Math.atan2(out[2]! - out[0]!, 24) * 180) / Math.PI;
    expect(yawDeg).toBeLessThan(3);
    parallaxOffsets(NaN, 9, out);
    expect(Number.isFinite(out[0]! + out[1]!)).toBe(true);
  });
  it('moves near things on screen much more than far ones', () => {
    const base = cameraAt(0, 16 / 9, true);
    const moved = { ...base, position: [base.position[0] + 1.3, base.position[1], base.position[2]] as const, target: [base.target[0] + 1.3, base.target[1], base.target[2]] as const };
    const shift = (z: number) => {
      const p = [base.target[0], 2, z] as const;
      return Math.abs(project(p, base)!.x - project(p, moved as typeof base)!.x);
    };
    const near = shift(4);
    const mid = shift(-20);
    const far = shift(-90);
    expect(near).toBeGreaterThan(mid * 1.5);
    expect(mid).toBeGreaterThan(far * 2);
    expect(far).toBeGreaterThan(0);
  });
});
