// The Frozen Cemetery (.kiro/specs/themes/unique-scenes.md, brief 3): the lake, the gravestones stuck in the ice, the icicles, the snow
// mounds, the aurora and the palette. The shared rules for every unique theme are in tests/uniqueScenes.test.ts.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AURORA_FULL_DISCS, AURORA_OFF_DISCS, AURORA_PEAK, auroraCeiling, auroraClearance,
} from '../lib/scene/aurora';
import { LAYOUT_SEED, MODELS, footprintOf } from '../lib/scene/layout';
import { MOON } from '../lib/scene/sky';
import { themeScene } from '../lib/scene/themeLayout';
import { FOOT, FROST_GHOST_TINT, FROST_MOON, FROST_PARTS, FROST_TRI_LIMIT, ICE_STONES, ICE_STONE_MODELS, buildFrozenCemetery } from '../lib/scene/uniqueScenes/frost';
import {
  ICICLES_PER_STONE, ICICLE_TRIS, LAKE, MAX_SINK, MOUND_COUNT, MOUND_TRIS, icicleSet, lakeDistance, moundSet, onLake, turnLikeCompose,
} from '../lib/scene/uniqueScenes/frostIce';
import { planTriangles } from '../lib/scene/uniqueScenes/forest';
import { VIEW_ASPECTS, hasFile } from '../lib/scene/uniqueScenes/types';
import { AURORA_FRAGMENT } from '../entrypoints/newtab/layers/scene/themes/Aurora';
import { sceneColorsFor } from '../entrypoints/newtab/layers/scene/colors';
import { themeById } from '../lib/themes';

const spec = themeScene('frost').unique!;
const stones = spec.placements.filter((p) => spec.ice!.stones.includes(p.id));
const seeds = fc.constantFrom(LAYOUT_SEED, 7, 99, 2024);

describe('the frozen lake', () => {
  it('is a wide flat ellipse: much wider than deep, in the middle distance', () => {
    expect(LAKE.rx).toBeGreaterThan(LAKE.rz * 1.8);
    expect(LAKE.z).toBeLessThan(-12);
    expect(LAKE.z - LAKE.rz).toBeGreaterThan(-36);
  });
  it('measures distance as 0 at the middle and 1 on the shore, along both axes', () => {
    expect(lakeDistance(LAKE.x, LAKE.z)).toBe(0);
    expect(lakeDistance(LAKE.x + LAKE.rx, LAKE.z)).toBeCloseTo(1, 12);
    expect(lakeDistance(LAKE.x, LAKE.z - LAKE.rz)).toBeCloseTo(1, 12);
    expect(onLake(LAKE.x + LAKE.rx - 0.1, LAKE.z)).toBe(true);
    expect(onLake(LAKE.x + LAKE.rx + 0.1, LAKE.z)).toBe(false);
    // A radius widens the lake.
    expect(onLake(LAKE.x + LAKE.rx + 0.1, LAKE.z, 0.5)).toBe(true);
  });
  it('is the centre of the stones: every ice stone stands in the ice, and the centrepiece is the middle one', () => {
    expect(spec.centrepiece.placement).toBe(stones[0]);
    expect(spec.centrepiece.placement.group).toBe('centre');
    expect(Math.abs(spec.centrepiece.placement.x - LAKE.x)).toBeLessThan(1);
    for (const s of stones) expect(lakeDistance(s.x, s.z), s.id).toBeLessThan(0.9);
    for (const id of spec.centrepiece.ids) expect(stones.map((s) => s.id)).toContain(id);
  });
  it('is clear of every pine and boulder (nothing stands on the ice)', () => {
    for (const p of spec.placements) {
      if (spec.ice!.stones.includes(p.id)) continue;
      const f = footprintOf(p);
      expect(onLake(p.x, p.z, Math.max(f.hx, f.hz)), p.id).toBe(false);
    }
  });
});

describe('the gravestones in the ice', () => {
  it('are a handful of only two kinds, tilted at different angles', () => {
    expect(stones.length).toBe(ICE_STONES.length);
    expect(stones.length).toBeGreaterThanOrEqual(5);
    expect(stones.length).toBeLessThanOrEqual(8);
    expect(new Set(stones.map((s) => s.model))).toEqual(new Set(ICE_STONE_MODELS));
    expect(new Set(stones.map((s) => `${s.tilt![0].toFixed(2)},${s.tilt![1].toFixed(2)}`)).size).toBe(stones.length);
    for (const s of stones) expect(Math.max(Math.abs(s.tilt![0]), Math.abs(s.tilt![1])), s.id).toBeGreaterThan(0.1);
    // Nothing else in the theme is a Crypt gravestone.
    for (const p of spec.placements) if (!stones.includes(p)) expect(ICE_STONE_MODELS, p.id).not.toContain(p.model);
  });
  it('are sunk only where flagged, by at most the documented maximum, and nothing else is below the snow', () => {
    expect(MAX_SINK).toBeLessThanOrEqual(0.6);
    expect(Object.keys(spec.sunk!).sort()).toEqual(stones.map((s) => s.id).sort());
    for (const s of stones) {
      expect(spec.sunk![s.id], s.id).toBeGreaterThan(0);
      expect(spec.sunk![s.id], s.id).toBeLessThanOrEqual(MAX_SINK);
      expect(s.y, s.id).toBeCloseTo(-spec.sunk![s.id]!, 12);
    }
    // Every other placement stands on the snow: a model file's own foot is cancelled by its lift (within 0.05 of y = 0).
    for (const p of spec.placements) {
      if (spec.sunk![p.id] !== undefined) continue;
      expect(p.y, p.id).toBeCloseTo((FOOT[p.model] ?? 0) * p.scale + 0.004, 9);
      expect(Math.abs(p.y - (FOOT[p.model] ?? 0) * p.scale), p.id).toBeLessThanOrEqual(0.05);
    }
  });
  it('still show above the snow: most of each stone is above the ice even when tilted and sunk', () => {
    for (const s of stones) {
      const info = MODELS[s.model];
      const top = s.y + info.h * s.scale * Math.cos(Math.max(Math.abs(s.tilt![0]), Math.abs(s.tilt![1])));
      expect(top, s.id).toBeGreaterThan(info.h * s.scale * 0.8 - MAX_SINK);
    }
  });
});

describe('the icicles', () => {
  it('are the same for the same seed, and a different set for another', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(icicleSet(stones, seed)).toEqual(icicleSet(stones, seed));
      }),
      { numRuns: 6 },
    );
    expect(icicleSet(stones, 1)).not.toEqual(icicleSet(stones, 2));
  });
  it('are seven per stone, hang from near the top of their stone and point down inside its height', () => {
    const set = icicleSet(stones, 5);
    expect(set).toHaveLength(stones.length * ICICLES_PER_STONE);
    set.forEach((ic, n) => {
      const s = stones[Math.floor(n / ICICLES_PER_STONE)]!;
      const info = MODELS[s.model];
      const reach = Math.hypot(info.hx, info.hz) * s.scale;
      expect(Math.hypot(ic.x - s.x, ic.z - s.z), `icicle ${n} is at its stone`).toBeLessThanOrEqual(reach + info.h * s.scale * 0.5);
      // Under the top: in the upper part of the stone, above its foot, with its tip still above the ice level of the stone's own foot.
      expect(ic.y, `icicle ${n} hangs from the upper part`).toBeGreaterThan(s.y + info.h * s.scale * 0.35);
      expect(ic.y, `icicle ${n} hangs from below the top`).toBeLessThan(s.y + info.h * s.scale * 1.01);
      expect(ic.length).toBeGreaterThan(0);
      expect(ic.radius).toBeGreaterThan(0);
      expect(ic.y - ic.length, `icicle ${n} tip`).toBeGreaterThan(s.y);
    });
  });
  it('turn points like the drawing turns the props: no turn leaves a point alone, and a quarter turn about y swaps x and z', () => {
    expect(turnLikeCompose([1, 2, 3], 0, undefined)).toEqual([1, 2, 3]);
    const [x, y, z] = turnLikeCompose([1, 2, 0], Math.PI / 2, [0, 0]);
    expect([x, y, z].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 2, -1]);
  });
  it('count within the budget the spec declared', () => {
    expect(spec.ice!.icicles.length * ICICLE_TRIS).toBeLessThanOrEqual(FROST_PARTS.icicleTris);
  });
});

describe('the snow mounds', () => {
  it('are the same for the same seed', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(moundSet(seed)).toEqual(moundSet(seed));
      }),
      { numRuns: 6 },
    );
    expect(moundSet(1)).not.toEqual(moundSet(2));
  });
  it('are scattered: many of them, off the ice, off the stones, apart from each other and inside the ground', () => {
    const mounds = spec.ice!.mounds;
    expect(mounds.length).toBeGreaterThanOrEqual(MOUND_COUNT * 0.6);
    expect(mounds.length).toBeLessThanOrEqual(MOUND_COUNT);
    for (const m of mounds) {
      expect(onLake(m.x, m.z, m.radius), 'on the ice').toBe(false);
      expect(Math.abs(m.x)).toBeLessThanOrEqual(30);
      expect(m.z).toBeGreaterThanOrEqual(-40);
      expect(m.z).toBeLessThanOrEqual(12);
      for (const s of stones) expect(Math.hypot(m.x - s.x, m.z - s.z), 'on a stone').toBeGreaterThan(m.radius);
    }
    for (let i = 0; i < mounds.length; i++) {
      for (let j = i + 1; j < mounds.length; j++) {
        expect(Math.hypot(mounds[i]!.x - mounds[j]!.x, mounds[i]!.z - mounds[j]!.z)).toBeGreaterThanOrEqual(mounds[i]!.radius + mounds[j]!.radius - 1e-9);
      }
    }
  });
  it('stay out of the near corners, so no mound is cut by the screen edge', () => {
    for (const m of spec.ice!.mounds) {
      expect(m.z).toBeLessThanOrEqual(4);
      expect(Math.abs(m.x - 0.5) + m.radius).toBeLessThanOrEqual(0.62 * (16 - m.z));
    }
  });
  it('respect a blocked area', () => {
    const set = moundSet(3, (x) => x > 0);
    for (const m of set) expect(m.x).toBeLessThanOrEqual(0);
    expect(MOUND_TRIS).toBe(20);
  });
});

describe('the aurora', () => {
  it('is off over the moon disc and its surroundings, and full far from it', () => {
    for (const scale of [1, FROST_MOON.scale, 2]) {
      const disc = MOON.discDeg * scale;
      expect(auroraClearance(0, scale)).toBe(0);
      expect(auroraClearance(disc, scale)).toBe(0);
      expect(auroraClearance(disc * AURORA_OFF_DISCS, scale)).toBe(0);
      expect(auroraClearance(disc * AURORA_FULL_DISCS, scale)).toBe(1);
      expect(auroraClearance(180, scale)).toBe(1);
      expect(auroraCeiling(disc, scale)).toBe(0);
    }
  });
  it('never brightens the sky by more than its faint peak, and fades monotonically away from the moon', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 180, noNaN: true }), fc.double({ min: 0, max: 180, noNaN: true }), fc.double({ min: 0.5, max: 2, noNaN: true }), (a, b, scale) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(auroraCeiling(hi, scale)).toBeLessThanOrEqual(AURORA_PEAK + 1e-12);
        expect(auroraCeiling(lo, scale)).toBeLessThanOrEqual(auroraCeiling(hi, scale) + 1e-12);
        expect(auroraCeiling(lo, scale)).toBeGreaterThanOrEqual(0);
      }),
    );
    expect(AURORA_PEAK).toBeLessThanOrEqual(0.35);
  });
  it('uses the same numbers in its shader, and is a single pass of arithmetic', () => {
    expect(AURORA_FRAGMENT).toContain(`disc * ${AURORA_OFF_DISCS.toFixed(4)}`);
    expect(AURORA_FRAGMENT).toContain(`disc * ${AURORA_FULL_DISCS.toFixed(4)}`);
    expect(AURORA_FRAGMENT).toContain(`* ${AURORA_PEAK.toFixed(4)} * clear`);
    expect(AURORA_FRAGMENT).toContain(`${MOON.discDeg.toFixed(4)} * uMoonScale`);
    expect(spec.sky).toEqual(['aurora']);
  });
});

describe('the Frozen Cemetery spec', () => {
  it('has the brief: pines both sides, ice boulders, snow, no path, a cold silver moon, icy ghosts, falling snow', () => {
    const count = (m: string) => spec.placements.filter((p) => p.model === m).length;
    expect(count('frost_pine_a') + count('frost_pine_b')).toBeGreaterThanOrEqual(20);
    expect(count('frost_pines')).toBeGreaterThanOrEqual(2);
    expect(count('frost_rock')).toBeGreaterThanOrEqual(6);
    const pines = spec.placements.filter((p) => p.model.startsWith('frost_pine'));
    expect(pines.filter((p) => p.x < LAKE.x).length).toBeGreaterThanOrEqual(8);
    expect(pines.filter((p) => p.x > LAKE.x).length).toBeGreaterThanOrEqual(8);
    expect(spec.ground.kind).toBe('snow');
    expect(spec.path.kind).toBe('none');
    expect(spec.path.centre).toEqual([]);
    expect(spec.weather!.kind).toBe('snow');
    expect(spec.layers.ghostTint).toBe(FROST_GHOST_TINT);
    expect(spec.layers.ghosts).toBe(true);
    expect(spec.lights.length).toBeLessThanOrEqual(6);
  });
  it('uses exactly these model files, all with a file', () => {
    expect([...spec.models].sort()).toEqual(['frost_pine_a', 'frost_pine_b', 'frost_pines', 'frost_rock', 'grave_B', 'gravestone']);
    for (const m of spec.models) expect(hasFile(m)).toBe(true);
  });
  it('puts the moon in open sky at scale about 1', () => {
    expect(FROST_MOON.scale).toBeGreaterThanOrEqual(1);
    expect(FROST_MOON.scale).toBeLessThanOrEqual(1.1);
    for (const a of VIEW_ASPECTS) {
      const t = FROST_MOON.target(a);
      expect(t.y).toBeLessThan(0.3);
      expect(t.y).toBeGreaterThan(0.15);
    }
  });
  it('has ghost spots over the ice or among the pines', () => {
    expect(spec.ghostSpots.length).toBeGreaterThanOrEqual(2);
    for (const g of spec.ghostSpots) expect(g.y).toBeGreaterThan(2);
  });
  it('keeps the triangles of the placements, and of its own parts, inside the plan', () => {
    expect(planTriangles(spec.placements)).toBeLessThanOrEqual(FROST_TRI_LIMIT);
    expect(spec.extras.tris).toBeLessThan(5000);
    expect(spec.extras.calls).toBe(FROST_PARTS.calls);
  });
  it('is the same scene for the same seed', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(buildFrozenCemetery(seed)).toEqual(buildFrozenCemetery(seed));
      }),
      { numRuns: 4 },
    );
  });
  it('has a cold silver-white moon and keeps every palette colour valid', () => {
    const p = themeById('frost').scene;
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return (((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255;
    };
    expect(lum(p.moon)).toBeGreaterThan(0.9);
    const [r, g, b] = p.moonLight;
    expect(b).toBeGreaterThanOrEqual(r);
    expect(Math.min(r, g, b)).toBeGreaterThan(0.7);
    expect(sceneColorsFor('frost').moonLight.b).toBeGreaterThan(0);
  });
});
