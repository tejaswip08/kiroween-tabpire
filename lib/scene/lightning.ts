// Soft lightning for the Haunted Castle sky: when the sky flashes and how bright it gets. Pure: no three, no browser APIs.
// A flash is a brightness change only. Flashes are rare (one every 8 to 20 seconds), each one is a single pulse with a short
// rise and a slower fall, and there are none at all with reduced motion.
import { mulberry32 } from './rng';

export const LIGHTNING = {
  /** Seconds between the start of one flash and the start of the next. */
  minGap: 8,
  maxGap: 20,
  /** Seconds a flash takes to reach its peak, and to die away again. The rise is short, the fall is slower. */
  rise: 0.18,
  fall: 1.2,
  /** The peak of a flash, from the weakest to the strongest (1 is the brightest the shaders take). */
  minPeak: 0.55,
  maxPeak: 1,
} as const;

/** How long a flash lasts, in seconds. Always shorter than the shortest gap, so two flashes never overlap. */
export const FLASH_LENGTH = LIGHTNING.rise + LIGHTNING.fall;

interface Schedule {
  rng: () => number;
  /** The start time of each flash so far, and its peak. */
  starts: number[];
  peaks: number[];
}
const schedules = new Map<number, Schedule>();

function scheduleOf(seed: number): Schedule {
  let s = schedules.get(seed);
  if (!s) schedules.set(seed, (s = { rng: mulberry32(seed), starts: [], peaks: [] }));
  return s;
}
/** Adds flashes to the schedule (always in the same order for a seed) until one starts after `t`. */
function extend(s: Schedule, t: number): void {
  while (s.starts.length === 0 || s.starts[s.starts.length - 1]! <= t) {
    const prev = s.starts.length ? s.starts[s.starts.length - 1]! : 0;
    s.starts.push(prev + LIGHTNING.minGap + (LIGHTNING.maxGap - LIGHTNING.minGap) * s.rng());
    s.peaks.push(LIGHTNING.minPeak + (LIGHTNING.maxPeak - LIGHTNING.minPeak) * s.rng());
  }
}

/** The start times of the flashes that begin before `horizon` seconds, for a seed. The same seed always gives the same times. */
export function flashTimes(seed: number, horizon: number): number[] {
  const s = scheduleOf(seed);
  extend(s, horizon);
  return s.starts.filter((t) => t < horizon);
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
/** The brightness `dt` seconds after a flash started, for a flash with this peak: a quick smooth rise, then a slower smooth fall. */
export function flashShape(dt: number, peak: number): number {
  if (dt <= 0 || dt >= FLASH_LENGTH) return 0;
  if (dt < LIGHTNING.rise) return peak * smooth(dt / LIGHTNING.rise);
  const k = 1 - smooth((dt - LIGHTNING.rise) / LIGHTNING.fall);
  return peak * k * k;
}

/**
 * The brightness of the lightning at time `t`, from 0 (none) to 1. It is 0 with reduced motion, whatever `t` is.
 * Only the flash that started last can still be showing, because a flash ends long before the next one starts.
 */
export function lightningAt(t: number, seed: number, reduced = false): number {
  if (reduced || !(t > 0)) return 0;
  const s = scheduleOf(seed);
  extend(s, t);
  // The last flash that started at or before t.
  let lo = 0;
  let hi = s.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.starts[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  if (s.starts[lo]! > t) return 0;
  return flashShape(t - s.starts[lo]!, s.peaks[lo]!);
}

/** The boosts a flash of brightness `f` gives (the numbers the shaders and lights use). 0 at f = 0. */
export const FLASH_BOOST = {
  /** Added to the sky colour (linear colour), strongest toward the horizon. */
  sky: [0.2, 0.25, 0.38],
  /** Added to the colour of every cloud puff. */
  cloud: [0.3, 0.34, 0.5],
  /** The hemisphere and moonlight intensity are multiplied by 1 + this * f. */
  hemisphere: 1.4,
  moonlight: 1.1,
} as const;
