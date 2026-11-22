import { describe, expect, it } from 'vitest';
import { cameraAt, projectDirection, DRIFT_PERIOD_S } from '../lib/scene/camera';
import {
  CLOUD_COUNT, CLOUD_LANES, MOON, MOON_KEEP_OUT_DEG, PUFFS_PER_CLOUD, WITCH_FLIGHT_S, cloudFade, cloudPuffs, cloudU, cloudDistanceToMoon, cloudsAt,
  moonDirection, moonScreenRadius, moonTarget, witchAt,
} from '../lib/scene/sky';
import { HALO } from '../lib/scene/meaning';

const WIDE = [16 / 10, 16 / 9, 21 / 9];

describe('moon placement', () => {
  it.each(WIDE)('the whole disc stays on screen in the upper right at aspect %d, at drift extremes', (aspect) => {
    const r = moonScreenRadius(aspect);
    const dir = moonDirection(aspect);
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * DRIFT_PERIOD_S;
      const p = projectDirection(dir, cameraAt(t, aspect))!;
      expect(p).not.toBeNull();
      const rx = r.disc / aspect;
      expect(p.x - rx).toBeGreaterThan(0.68);
      expect(p.x + rx).toBeLessThan(0.99);
      expect(p.y - r.disc).toBeGreaterThan(0.01);
      expect(p.y + r.disc).toBeLessThan(0.45);
    }
  });
  it('is a large disc, as in the reference', () => {
    expect(MOON.discDeg).toBeGreaterThanOrEqual(4);
    expect(moonScreenRadius(16 / 9).disc).toBeGreaterThan(0.08);
    expect(MOON.haloDeg).toBeGreaterThan(MOON.discDeg * 1.5);
  });
  it('keeps the moon in view in a narrow window', () => {
    for (const aspect of [1, 0.8, 0.6]) {
      const r = moonScreenRadius(aspect);
      const p = projectDirection(moonDirection(aspect), cameraAt(0, aspect))!;
      expect(p.x).toBeGreaterThan(r.disc / aspect);
      expect(p.x).toBeLessThan(1 - r.disc / aspect);
      expect(p.y).toBeLessThan(1 / 3);
      expect(p.y).toBeGreaterThan(r.disc * 0.4);
    }
  });
  it('has no face: the disc is smaller than the halo', () => {
    expect(MOON.discDeg).toBeLessThan(MOON.haloDeg);
    expect(moonTarget(1.78).x).toBeGreaterThan(0.5);
  });
});

describe('clouds', () => {
  it('never reach the moon halo, even at its largest pulse', () => {
    const limit = MOON.haloDeg * (1 + HALO.ampHungry);
    expect(MOON_KEEP_OUT_DEG).toBeCloseTo(limit, 9);
    for (let i = 0; i < 5000; i++) {
      for (const c of cloudsAt(i * 7.31)) expect(cloudDistanceToMoon(c)).toBeGreaterThan(limit);
    }
  });
  it('wrap inside their lane and have every lane', () => {
    expect(cloudsAt(0)).toHaveLength(CLOUD_COUNT);
    expect(new Set(cloudsAt(0).map((c) => c.lane)).size).toBe(CLOUD_LANES.length);
    for (const t of [0, 1e3, 1e5, -500]) {
      cloudsAt(t).forEach((c) => {
        const lane = CLOUD_LANES[c.lane]!;
        expect(c.u).toBeGreaterThanOrEqual(lane.uMin);
        expect(c.u).toBeLessThan(lane.uMax);
      });
    }
  });
  it('have clouds above, below and beside the moon', () => {
    expect(CLOUD_LANES.some((l) => l.v > 10)).toBe(true);
    expect(CLOUD_LANES.some((l) => l.v < -10)).toBe(true);
    expect(CLOUD_LANES.some((l) => Math.abs(l.v) < 10 && l.uMax < -MOON_KEEP_OUT_DEG)).toBe(true);
  });
  it('drift slowly and fade out at the ends of a lane, so a wrap is never seen', () => {
    const a = cloudsAt(0);
    const b = cloudsAt(1 / 60);
    a.forEach((c, i) => {
      const lane = CLOUD_LANES[c.lane]!;
      const d = Math.abs(b[i]!.u - c.u);
      const wrapped = d > (lane.uMax - lane.uMin) - 0.05;
      expect(d < 0.05 || wrapped).toBe(true);
      if (wrapped) expect(cloudFade(c.u, lane.uMin, lane.uMax)).toBeLessThan(0.01);
    });
    expect(cloudFade(-80, -80, -27)).toBe(0);
    expect(cloudFade(-27, -80, -27)).toBe(0);
    expect(cloudFade(-53, -80, -27)).toBeCloseTo(1, 6);
  });
});

describe('cloud puffs', () => {
  it('keep clear of the moon halo at its largest pulse, at any time', () => {
    for (const p of cloudPuffs()) {
      for (let i = 0; i < 400; i++) {
        const u = cloudU(p.u0, p.speed, i * 13.7, p.uMin, p.uMax) + p.offU;
        const d = Math.hypot(u, p.v + p.offV) - p.radius;
        expect(d).toBeGreaterThan(MOON_KEEP_OUT_DEG);
      }
    }
  });
  it('make several overlapping puffs for every cloud, with flat bases and rounder humps', () => {
    const puffs = cloudPuffs();
    expect(puffs).toHaveLength(CLOUD_COUNT * PUFFS_PER_CLOUD);
    expect(PUFFS_PER_CLOUD).toBeGreaterThanOrEqual(6);
    expect(new Set(puffs.map((p) => p.ratio)).size).toBeGreaterThan(1);
    const first = puffs.slice(0, PUFFS_PER_CLOUD);
    const gaps = first.slice(1).map((p, i) => Math.abs(p.offU - first[i]!.offU));
    // Neighbouring puffs are closer together than their width, so they overlap.
    gaps.forEach((g, i) => expect(g).toBeLessThan(first[i]!.radius + first[i + 1]!.radius));
  });
});

describe('witch', () => {
  it('flies continuously and passes in front of the moon halfway', () => {
    let prev = witchAt(0);
    for (let i = 1; i <= 2000; i++) {
      const cur = witchAt(i / 2000);
      expect(Math.hypot(cur.u - prev.u, cur.v - prev.v)).toBeLessThan(0.2);
      expect(Number.isFinite(cur.tilt)).toBe(true);
      prev = cur;
    }
    const mid = witchAt(0.5);
    expect(Math.abs(mid.u)).toBeLessThan(MOON.haloDeg);
    expect(Math.abs(mid.v)).toBeLessThan(MOON.haloDeg);
  });
  it('clamps bad progress', () => {
    expect(witchAt(-3)).toEqual(witchAt(0));
    expect(witchAt(9)).toEqual(witchAt(1));
    expect(WITCH_FLIGHT_S).toBeGreaterThan(0);
  });
  it('starts and ends off the sides of the window', () => {
    expect(Math.abs(witchAt(0).u)).toBeGreaterThan(40);
    expect(Math.abs(witchAt(1).u)).toBeGreaterThan(40);
  });
});

