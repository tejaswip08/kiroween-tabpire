// What the scene shows, worked out from the user's data. Pure.
// Every symbol in the scene comes from here (Requirement 7).
import { CAPS } from './config';
import { clamp, lerp } from './rng';

export interface SceneInputs {
  cardCount: number;
  starvingCount: number;
  estimatedMb: number;
  /** Items in the Crypt. */
  cryptCount: number;
  /** Tabs saved with Crypt or Dawn (stats.crypted). */
  crypted: number;
  /** Protected sites. */
  garlicCount: number;
  /** Tabs staked (stats.staked). */
  staked: number;
  /** Tabs put to sleep (stats.coffined). */
  coffined: number;
  /** Dawn would close at least one tab. */
  dawnReady: boolean;
}

export interface SceneState {
  ghosts: number;
  bats: number;
  candles: number;
  newGraves: number;
  coffins: number;
  haloPeriodS: number;
  haloAmplitude: number;
  fogFactor: number;
  emberRate: number;
  witch: boolean;
}

export const HALO = { periodCalm: 6, periodHungry: 2.5, ampCalm: 0.06, ampHungry: 0.2 } as const;
export const FOG = { min: 0.7, max: 1.3, fullAtMb: 8000 } as const;
export const EMBERS = { min: 0.15, max: 1, fullAtStarving: 12 } as const;

/** Anything that is not a finite number counts as 0. */
const finite = (n: number): number => (Number.isFinite(n) ? n : 0);
const count = (n: number, cap: number): number => Math.min(cap, Math.max(0, Math.floor(finite(n))));

/** Share of cards that are starving, from 0 to 1. */
export function hungerShare(cardCount: number, starvingCount: number): number {
  const cards = Math.max(0, finite(cardCount));
  if (cards === 0) return 0;
  return clamp(finite(starvingCount) / cards, 0, 1);
}

export function sceneState(i: SceneInputs): SceneState {
  const share = hungerShare(i.cardCount, i.starvingCount);
  const starving = Math.max(0, finite(i.starvingCount));
  return {
    ghosts: count(i.cryptCount, CAPS.ghosts),
    bats: count(i.crypted, CAPS.bats),
    candles: count(i.garlicCount, CAPS.candles),
    newGraves: count(i.staked, CAPS.newGraves),
    coffins: count(i.coffined, CAPS.coffins),
    haloPeriodS: lerp(HALO.periodCalm, HALO.periodHungry, share),
    haloAmplitude: lerp(HALO.ampCalm, HALO.ampHungry, share),
    fogFactor: lerp(FOG.min, FOG.max, clamp(finite(i.estimatedMb) / FOG.fullAtMb, 0, 1)),
    emberRate: lerp(EMBERS.min, EMBERS.max, clamp(starving / EMBERS.fullAtStarving, 0, 1)),
    witch: i.dawnReady === true,
  };
}

/**
 * Frame-rate independent easing toward a target. Never overshoots.
 * `rate` is per second (higher is faster).
 */
export function approach(current: number, target: number, dt: number, rate: number): number {
  const k = 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));
  return current + (target - current) * k;
}
