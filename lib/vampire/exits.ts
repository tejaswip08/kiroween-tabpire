// Exit timelines for the vampire, as pure functions of elapsed milliseconds.
// Each one starts at the card's idle pose and ends in its final state.
import { BUDGET } from '../scene/config';
import { clamp } from '../scene/rng';
import type { ExitKind } from '../scene/exitKinds';
import { blendPose, statePose, type Pose } from './pose';

export type TimelineKind = ExitKind | 'coffin';

export const EXIT_MS = { stake: 1000, dawn: 1300, crypt: 1200, coffin: 1400, none: 260 } as const;
/** Each Dawn card waits this long more than the one before it, up to the maximum. */
export const DAWN_STAGGER_MS = 40;
export const DAWN_STAGGER_MAX_MS = 300;
/** The card body stays fully visible until this long before the end, then fades. */
export const CARD_FADE_MS = 260;

export function dawnDelayMs(order: number): number {
  const o = Number.isFinite(order) ? Math.max(0, Math.floor(order)) : 0;
  return Math.min(DAWN_STAGGER_MAX_MS, o * DAWN_STAGGER_MS);
}

/** Total time a card stays on screen for this exit, including any stagger. */
export function exitDurationMs(kind: TimelineKind, order = 0): number {
  const ms = kind === 'dawn' ? EXIT_MS.dawn + dawnDelayMs(order) : EXIT_MS[kind];
  return Math.min(ms, BUDGET.maxExitMs);
}

export interface ExitFrame {
  pose: Pose;
  /** Opacity of the vampire, 0 to 1. */
  alpha: number;
  /** Noise dissolve amount, 0 to 1 (Dawn). */
  dissolve: number;
  /** Brightness of the burning edge, 0 to 1. */
  edge: number;
  /** How many embers rise from the body, 0 to 1. */
  embers: number;
  /** White-hot flash when the vampire turns into a bat, 0 to 1. */
  flash: number;
  bat: { alpha: number; x: number; y: number; scale: number; flapPhase: number };
  /** How far the coffin has risen into view: 0 hidden below, 1 in place. */
  coffin: number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeIn = (t: number): number => t * t;
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

const frame = (pose: Pose): ExitFrame => ({
  pose, alpha: 1, dissolve: 0, edge: 0, embers: 0, flash: 0,
  bat: { alpha: 0, x: 0, y: 0, scale: 1, flapPhase: 0 }, coffin: 0,
});

/** The pose a Coffin transition settles into. */
export function asleepFinal(seed: number): Pose {
  return statePose('asleep', 0, seed);
}

/**
 * The picture at `ms` after the exit began. `idle` is the pose the vampire had just
 * before. Past the end, it returns the final frame. Never returns NaN.
 */
export function exitFrame(kind: TimelineKind, rawMs: number, idle: Pose, order = 0, seed = 0): ExitFrame {
  const ms = Number.isFinite(rawMs) ? Math.max(0, rawMs) : 0;
  const f = frame({ ...idle });
  switch (kind) {
    case 'stake': {
      const p = clamp(ms / EXIT_MS.stake, 0, 1);
      // Topples backward about the feet, faster and faster, with one small bounce.
      const fall = easeIn(smooth(0, 0.6, p));
      const bounce = 0.09 * Math.sin(Math.PI * smooth(0.6, 0.8, p)) * (1 - smooth(0.8, 1, p));
      f.pose.rotX = idle.rotX - (Math.PI / 2) * (fall - bounce);
      f.pose.y = idle.y - 1.3 * easeIn(smooth(0.55, 1, p));
      f.alpha = 1 - smooth(0.85, 1, p);
      break;
    }
    case 'dawn': {
      const delay = dawnDelayMs(order);
      const p = clamp((ms - delay) / EXIT_MS.dawn, 0, 1);
      f.dissolve = smooth(0, 1, p);
      f.edge = Math.sin(Math.PI * clamp(f.dissolve, 0, 1)) ** 0.7;
      f.embers = Math.sin(Math.PI * p);
      f.pose.y = idle.y + 0.08 * p;
      f.alpha = 1 - smooth(0.9, 1, p);
      break;
    }
    case 'crypt': {
      const p = clamp(ms / EXIT_MS.crypt, 0, 1);
      // Squash and flash, then cross-fade into a bat that flies up and out.
      const squash = Math.sin(Math.PI * smooth(0, 0.35, p) * 0.5);
      f.pose.scaleY = idle.scaleY * (1 - 0.4 * squash);
      f.pose.scaleX = idle.scaleX * (1 + 0.15 * squash);
      f.pose.scaleZ = idle.scaleZ * (1 + 0.15 * squash);
      f.flash = Math.sin(Math.PI * smooth(0.1, 0.55, p));
      const turn = smooth(0.25, 0.4, p);
      f.alpha = 1 - turn;
      const fly = easeIn(smooth(0.35, 1, p));
      f.bat = {
        alpha: turn * (1 - smooth(0.95, 1, p)),
        x: 0.35 * fly,
        y: idle.y + 0.45 + 2.2 * fly,
        scale: 0.55 + 0.25 * smooth(0.25, 0.5, p),
        flapPhase: (Math.min(ms, EXIT_MS.crypt) / 1000) * 2 * Math.PI * 4,
      };
      break;
    }
    case 'coffin': {
      const p = clamp(ms / EXIT_MS.coffin, 0, 1);
      f.coffin = easeOut(smooth(0, 0.4, p));
      if (p >= 1) {
        f.pose = asleepFinal(seed);
      } else {
        // Lie down and sink, then close the eyes.
        const to = statePose('asleep', 0, seed);
        const lie = smooth(0.3, 0.8, p);
        const base = blendPose(idle, { ...to, eyesClosed: idle.eyesClosed }, lie);
        base.eyesClosed = idle.eyesClosed + (to.eyesClosed - idle.eyesClosed) * smooth(0.8, 1, p);
        f.pose = base;
      }
      break;
    }
    case 'none': {
      const p = clamp(ms / EXIT_MS.none, 0, 1);
      f.pose.y = idle.y - 0.08 * easeOut(p);
      f.alpha = 1 - p;
      break;
    }
  }
  return f;
}

/** True when an exit removes the vampire (all but the Coffin transition, which stays). */
export function exitRemoves(kind: TimelineKind): boolean {
  return kind !== 'coffin';
}
