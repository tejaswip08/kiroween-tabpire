import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { VampireState } from '../lib/hunger';
import { BUDGET } from '../lib/scene/config';
import { POSE_KEYS, statePose, type Pose } from '../lib/vampire/pose';
import {
  DAWN_STAGGER_MAX_MS, DAWN_STAGGER_MS, EXIT_MS, asleepFinal, dawnDelayMs, exitDurationMs, exitFrame, exitRemoves,
  type ExitFrame, type TimelineKind,
} from '../lib/vampire/exits';

const KINDS: TimelineKind[] = ['stake', 'dawn', 'crypt', 'coffin', 'none'];
const IDLE_STATES: VampireState[] = ['awake', 'starving', 'protected'];

function numbers(fr: ExitFrame): number[] {
  return [
    ...POSE_KEYS.map((k) => fr.pose[k]), fr.alpha, fr.dissolve, fr.edge, fr.embers, fr.flash, fr.coffin,
    fr.bat.alpha, fr.bat.x, fr.bat.y, fr.bat.scale, fr.bat.flapPhase,
  ];
}

describe('exit durations', () => {
  it('never exceed 1.6 seconds, even with the largest Dawn stagger', () => {
    for (const kind of KINDS) {
      for (const order of [0, 1, 3, 7, 50, 10_000, NaN, -4]) {
        expect(exitDurationMs(kind, order)).toBeLessThanOrEqual(BUDGET.maxExitMs);
        expect(exitDurationMs(kind, order)).toBeGreaterThan(0);
      }
    }
    expect(exitDurationMs('dawn', 1e6)).toBe(EXIT_MS.dawn + DAWN_STAGGER_MAX_MS);
  });
  it('staggers Dawn in card order, up to a limit', () => {
    expect(dawnDelayMs(0)).toBe(0);
    expect(dawnDelayMs(1)).toBe(DAWN_STAGGER_MS);
    const delays = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(dawnDelayMs);
    for (let i = 1; i < delays.length; i++) expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!);
    expect(Math.max(...delays)).toBe(DAWN_STAGGER_MAX_MS);
    expect(exitDurationMs('dawn', 3)).toBe(EXIT_MS.dawn + 3 * DAWN_STAGGER_MS);
  });
  it('is 260 ms for a card that leaves without an action', () => {
    expect(exitDurationMs('none')).toBe(260);
  });
});

describe('exit timelines', () => {
  it.each(KINDS)('%s starts at the idle pose and ends in its final state', (kind) => {
    for (const s of IDLE_STATES) {
      for (const order of [0, 4, 99]) {
        const idle = statePose(s, 2.5, 9);
        const start = exitFrame(kind, 0, idle, order, 9);
        expect(start.pose).toEqual(idle);
        expect(start.alpha).toBe(1);
        expect(start.dissolve).toBe(0);
        expect(start.flash).toBe(0);
        expect(start.bat.alpha).toBe(0);
        expect(start.coffin).toBe(0);

        const end = exitFrame(kind, exitDurationMs(kind, order), idle, order, 9);
        const later = exitFrame(kind, 99_999, idle, order, 9);
        expect(later).toEqual(end);
        if (exitRemoves(kind)) {
          expect(end.alpha).toBeCloseTo(0, 9);
          expect(end.bat.alpha).toBeCloseTo(0, 9);
        } else {
          expect(end.pose).toEqual(asleepFinal(9));
          expect(end.coffin).toBeCloseTo(1, 9);
          expect(end.alpha).toBe(1);
        }
      }
    }
  });
  it.each(KINDS)('%s is continuous and finite at every millisecond', (kind) => {
    const idle = statePose('starving', 1, 3);
    for (const order of [0, 12]) {
      const total = exitDurationMs(kind, order);
      let prev = numbers(exitFrame(kind, 0, idle, order, 3));
      for (let ms = 1; ms <= total + 20; ms++) {
        const cur = numbers(exitFrame(kind, ms, idle, order, 3));
        cur.forEach((v, i) => {
          expect(Number.isFinite(v)).toBe(true);
          expect(Math.abs(v - prev[i]!), `${kind} ${ms} #${i}`).toBeLessThan(0.05);
        });
        prev = cur;
      }
    }
  });
  it('keeps every value inside safe limits for any elapsed time', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KINDS),
        fc.oneof(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity)),
        fc.integer({ min: 0, max: 400 }),
        (kind, ms, order) => {
          const idle: Pose = statePose('awake', 1, 2);
          const fr = exitFrame(kind, ms, idle, order, 2);
          for (const v of numbers(fr)) expect(Number.isFinite(v)).toBe(true);
          for (const v of [fr.alpha, fr.dissolve, fr.edge, fr.embers, fr.flash, fr.coffin, fr.bat.alpha]) {
            expect(v).toBeGreaterThanOrEqual(-1e-9);
            expect(v).toBeLessThanOrEqual(1 + 1e-9);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('what each exit does', () => {
  const idle = statePose('awake', 0, 1);
  it('stake topples backward and drops out of view', () => {
    const mid = exitFrame('stake', 500, idle);
    expect(mid.pose.rotX).toBeLessThan(idle.rotX - 0.3);
    expect(exitFrame('stake', 900, idle).pose.y).toBeLessThan(-0.5);
  });
  it('dawn dissolves with a glowing edge and rising embers, staggered by order', () => {
    const mid = exitFrame('dawn', 650, idle, 0);
    expect(mid.dissolve).toBeGreaterThan(0.3);
    expect(mid.edge).toBeGreaterThan(0.5);
    expect(mid.embers).toBeGreaterThan(0.5);
    expect(exitFrame('dawn', 100, idle, 7).dissolve).toBe(0);
    expect(exitFrame('dawn', 100, idle, 0).dissolve).toBeGreaterThan(0);
  });
  it('crypt turns into a bat that flies up and out', () => {
    const early = exitFrame('crypt', 100, idle);
    const late = exitFrame('crypt', 900, idle);
    expect(early.bat.alpha).toBe(0);
    expect(late.bat.alpha).toBeGreaterThan(0.9);
    expect(late.bat.y).toBeGreaterThan(early.bat.y + 0.5);
    expect(late.alpha).toBe(0);
    expect(exitFrame('crypt', 300, idle).flash).toBeGreaterThan(0.3);
  });
  it('coffin rises, lays the vampire down and closes its eyes', () => {
    expect(exitFrame('coffin', 600, idle).coffin).toBeGreaterThan(0.9);
    expect(exitFrame('coffin', 900, idle).pose.lying).toBeGreaterThan(0.3);
    expect(exitFrame('coffin', 900, idle).pose.eyesClosed).toBe(0);
    expect(exitFrame('coffin', 1300, idle).pose.eyesClosed).toBeGreaterThan(0.5);
  });
});
