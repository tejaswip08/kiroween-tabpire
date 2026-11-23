import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { VampireState } from '../lib/hunger';
import {
  BLEND_RATE, LOOK_LIMIT, NO_LOOK, POSE_KEYS, POSE_LIMITS, approach, approachPose, blendPose, lookAngles, statePose, type Pose,
} from '../lib/vampire/pose';
import { COFFIN, FRAME, VAMPIRE, coffinFit, eyeRay, visibleHeight } from '../lib/vampire/rig';
import { BUDGET } from '../lib/scene/config';

const STATES: VampireState[] = ['awake', 'starving', 'protected', 'asleep'];
const L = POSE_LIMITS;

function expectSafe(p: Pose) {
  for (const k of POSE_KEYS) expect(Number.isFinite(p[k]), k).toBe(true);
  expect(Math.abs(p.x)).toBeLessThanOrEqual(L.offset);
  expect(Math.abs(p.y)).toBeLessThanOrEqual(L.offset);
  for (const r of [p.rotX, p.rotY, p.rotZ]) expect(Math.abs(r)).toBeLessThanOrEqual(L.rot);
  for (const s of [p.scaleX, p.scaleY, p.scaleZ]) {
    expect(s).toBeGreaterThanOrEqual(L.scaleMin);
    expect(s).toBeLessThanOrEqual(L.scaleMax);
  }
  expect(Math.abs(p.bend)).toBeLessThanOrEqual(L.bend);
  for (const k of ['glow', 'lying', 'eyesClosed'] as const) {
    expect(p[k]).toBeGreaterThanOrEqual(0);
    expect(p[k]).toBeLessThanOrEqual(1);
  }
  expect(Math.abs(p.breath)).toBeLessThanOrEqual(1);
}

describe('statePose', () => {
  it('stays finite and within limits for every state, time, seed and look', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.oneof(fc.double({ min: -1e5, max: 1e5, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity)),
        fc.oneof(fc.integer({ min: 0, max: 2_000_000 }), fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.constantFrom(NaN)),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.boolean(),
        (state, t, seed, dx, dy, reduced) => expectSafe(statePose(state, t, seed, lookAngles(dx, dy), reduced)),
      ),
      { numRuns: 400 },
    );
  });
  it('awake breathes between 1 and 1.025 and turns toward the cursor within limits', () => {
    for (let i = 0; i < 400; i++) {
      const p = statePose('awake', i * 0.1, 3);
      expect(p.scaleY).toBeGreaterThanOrEqual(1);
      expect(p.scaleY).toBeLessThanOrEqual(1.025 + 1e-9);
      expect(p.scaleX).toBeLessThanOrEqual(1);
    }
    const right = statePose('awake', 1, 3, lookAngles(5, 0));
    const left = statePose('awake', 1, 3, lookAngles(-5, 0));
    expect(right.rotY - left.rotY).toBeGreaterThan(0.5);
    const far = statePose('awake', 1, 3, lookAngles(1e9, 1e9));
    expect(far.rotY - VAMPIRE.facingYaw).toBeLessThanOrEqual(LOOK_LIMIT.yaw + 1e-9);
    expect(far.rotX).toBeLessThanOrEqual(LOOK_LIMIT.pitch + 1e-9);
  });
  it('starving hunches, paces and glows between 0.4 and 1', () => {
    let minX = Infinity, maxX = -Infinity, minG = Infinity, maxG = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const p = statePose('starving', i * 0.01, 1);
      expect(p.bend).toBeGreaterThan(0.3);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minG = Math.min(minG, p.glow); maxG = Math.max(maxG, p.glow);
    }
    expect(minX).toBeLessThan(-0.05);
    expect(maxX).toBeGreaterThan(0.05);
    expect(minG).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(maxG).toBeLessThanOrEqual(1 + 1e-9);
  });
  it('protected leans back and trembles', () => {
    const a = statePose('protected', 0.01, 2);
    const b = statePose('protected', 0.02, 2);
    expect(a.rotX).toBeLessThan(-0.2);
    expect(a.rotZ).not.toBe(b.rotZ);
  });
  it('asleep lies down with closed eyes', () => {
    const p = statePose('asleep', 3, 5);
    expect(p.lying).toBe(1);
    expect(p.eyesClosed).toBe(1);
  });
  it('gives each seed its own timing', () => {
    expect(statePose('awake', 2, 1).scaleY).not.toBeCloseTo(statePose('awake', 2, 2).scaleY, 6);
    expect(statePose('starving', 2, 1).x).not.toBeCloseTo(statePose('starving', 2, 9).x, 6);
  });
  it('holds still with reduced motion', () => {
    for (const s of STATES) {
      expect(statePose(s, 1, 4, lookAngles(3, 3), true)).toEqual(statePose(s, 77, 4, NO_LOOK, true));
    }
  });
});

describe('blendPose', () => {
  it('returns its inputs at 0 and 1 and clamps bad k', () => {
    const a = statePose('awake', 1, 1);
    const b = statePose('starving', 1, 1);
    expect(blendPose(a, b, 0)).toEqual(a);
    expect(blendPose(a, b, 1)).toEqual(b);
    expect(blendPose(a, b, -4)).toEqual(a);
    expect(blendPose(a, b, 9)).toEqual(b);
    expect(blendPose(a, b, NaN)).toEqual(a);
    expectSafe(blendPose(a, b, 0.4));
  });
  it('is continuous in k', () => {
    const a = statePose('awake', 1, 1);
    const b = statePose('asleep', 1, 1);
    let prev = blendPose(a, b, 0);
    for (let i = 1; i <= 100; i++) {
      const cur = blendPose(a, b, i / 100);
      for (const k of POSE_KEYS) expect(Math.abs(cur[k] - prev[k])).toBeLessThan(0.1);
      prev = cur;
    }
  });
});

describe('approach and look', () => {
  it('never overshoots and settles', () => {
    fc.assert(
      fc.property(fc.double({ min: -10, max: 10, noNaN: true }), fc.double({ min: -10, max: 10, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 50, noNaN: true }), (c, t, dt, rate) => {
        const n = approach(c, t, dt, rate);
        expect(Math.abs(n - t)).toBeLessThanOrEqual(Math.abs(c - t) + 1e-9);
        expect((n - t) * (c - t)).toBeGreaterThanOrEqual(-1e-9);
      }),
    );
    let p = statePose('awake', 0, 1);
    const target = statePose('asleep', 0, 1);
    for (let i = 0; i < 90; i++) p = approachPose(p, target, 1 / 60, BLEND_RATE);
    expect(Math.abs(p.lying - 1)).toBeLessThan(0.02);
  });
  it('clamps the look angles and ignores bad numbers', () => {
    expect(lookAngles(0, 0)).toEqual({ yaw: 0, pitch: 0 });
    expect(lookAngles(NaN, Infinity)).toEqual({ yaw: 0, pitch: 0 });
    const far = lookAngles(-1e12, 1e12);
    expect(far.yaw).toBeGreaterThanOrEqual(-LOOK_LIMIT.yaw);
    expect(far.pitch).toBeLessThanOrEqual(LOOK_LIMIT.pitch);
    expect(lookAngles(1, 0).yaw).toBeGreaterThan(0);
  });
});

describe('eyeRay', () => {
  it('starts in front of the model, aims at it, and puts the eyes either side of the middle', () => {
    const l = eyeRay(-1, 0);
    const r = eyeRay(1, 0);
    expect(l.origin[2]).toBeGreaterThan(1);
    expect(l.dir).toEqual([-0, 0, -1].map((v) => v + 0));
    expect(r.origin[0] - l.origin[0]).toBeCloseTo(2 * VAMPIRE.eyeX * VAMPIRE.width, 9);
    expect(l.origin[1]).toBeCloseTo(VAMPIRE.eyeY * VAMPIRE.height, 9);
  });
  it('follows the facing yaw: turning the model turns the ray with it', () => {
    for (const yaw of [Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
      const r = eyeRay(1, yaw);
      // Turning the ray by the yaw must give a ray from straight in front (+z) aiming at -z.
      const rot = (v: number[]) => [v[0]! * Math.cos(yaw) + v[2]! * Math.sin(yaw), v[1]!, -v[0]! * Math.sin(yaw) + v[2]! * Math.cos(yaw)];
      const dir = rot(r.dir);
      expect(dir[0]).toBeCloseTo(0, 9);
      expect(dir[2]).toBeCloseTo(-1, 9);
      expect(rot(r.origin)[0]).toBeCloseTo(VAMPIRE.eyeX * VAMPIRE.width, 9);
      expect(rot(r.origin)[2]).toBeCloseTo(2, 9);
    }
  });
});

describe('portrait framing', () => {
  it('shows the whole vampire and the top of its tomb, with a small gap above the head', () => {
    expect(visibleHeight(FRAME.distance, FRAME.fov)).toBeCloseTo(FRAME.worldHeight, 1);
    const top = FRAME.centreY + FRAME.worldHeight / 2;
    const bottom = FRAME.centreY - FRAME.worldHeight / 2;
    // The head top is inside the frame, with a small gap above it.
    expect(top).toBeGreaterThan(VAMPIRE.height);
    expect(top - VAMPIRE.height).toBeLessThan(0.15);
    // The feet (y = 0) and the tomb under them are in view.
    expect(bottom).toBeLessThan(-0.15);
    // The vampire fills about 70 percent of the arch height or more.
    expect(VAMPIRE.height / FRAME.worldHeight).toBeGreaterThanOrEqual(0.7);
  });
});
describe('rig', () => {
  it('fits the lying vampire inside the coffin length', () => {
    const f = coffinFit();
    expect(f.scale * VAMPIRE.height).toBeLessThan(COFFIN.length);
    expect(f.scale * VAMPIRE.width).toBeLessThanOrEqual(COFFIN.width * 1.0);
    expect(Number.isFinite(f.y + f.z)).toBe(true);
  });
  it('keeps the eye fractions inside the model', () => {
    expect(VAMPIRE.eyeY).toBeGreaterThan(0.5);
    expect(VAMPIRE.eyeY).toBeLessThan(1);
    expect(VAMPIRE.eyeX).toBeGreaterThan(0);
    expect(VAMPIRE.eyeX).toBeLessThan(0.5);
    expect(BUDGET.vampireTriangles).toBeGreaterThan(0);
  });
});
