// The Frozen Cemetery (.kiro/specs/themes/unique-scenes.md, brief 3): the spec, the aurora and the palette. The scene rules (house, pond,
// graveyard, creatures, backdrop) are in tests/frostScene.test.ts and the shared rules for every unique theme in tests/uniqueScenes.test.ts.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AURORA_FULL_DISCS, AURORA_OFF_DISCS, AURORA_PEAK, auroraCeiling, auroraClearance } from '../lib/scene/aurora';
import { LAYOUT_SEED } from '../lib/scene/layout';
import { MOON } from '../lib/scene/sky';
import { themeScene } from '../lib/scene/themeLayout';
import { FOOT, FROST_BLOOM, FROST_GHOST_TINT, FROST_MOON, FROST_PARTS, FROST_TRI_LIMIT, buildFrozenCemetery } from '../lib/scene/uniqueScenes/frost';
import { planTriangles } from '../lib/scene/uniqueScenes/forest';
import { hasFile } from '../lib/scene/uniqueScenes/types';
import { AURORA_FRAGMENT } from '../entrypoints/newtab/layers/scene/themes/Aurora';
import { sceneColorsFor } from '../entrypoints/newtab/layers/scene/colors';
import { LOOK } from '../lib/scene/config';
import { themeById } from '../lib/themes';
const spec = themeScene('frost').unique!;
const seeds = fc.constantFrom(LAYOUT_SEED, 7, 99, 2024);
describe('the aurora', () => {
  it('is off over the moon disc and its surroundings, and full far from it', () => {
    for (const scale of [1, FROST_MOON.scale, 2]) {
      const disc = MOON.discDeg * scale;
      expect(auroraClearance(0, scale)).toBe(0);
      expect(auroraClearance(disc * AURORA_OFF_DISCS, scale)).toBe(0);
      expect(auroraClearance(disc * AURORA_FULL_DISCS, scale)).toBe(1);
      expect(auroraCeiling(disc, scale)).toBe(0);
    }
  });
  it('is a soft ribbon: never brighter than its peak, and the peak is under the Bloom threshold of the theme', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 180, noNaN: true }), fc.double({ min: 0, max: 180, noNaN: true }), fc.double({ min: 0.5, max: 2, noNaN: true }), (a, b, scale) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(auroraCeiling(hi, scale)).toBeLessThanOrEqual(AURORA_PEAK + 1e-12);
        expect(auroraCeiling(lo, scale)).toBeLessThanOrEqual(auroraCeiling(hi, scale) + 1e-12);
      }),
    );
    expect(AURORA_PEAK).toBeLessThanOrEqual(0.4);
    expect(AURORA_PEAK).toBeLessThan(FROST_BLOOM.threshold);
  });
  it('uses the same numbers in its shader', () => {
    expect(AURORA_FRAGMENT).toContain(`disc * ${AURORA_OFF_DISCS.toFixed(4)}`);
    expect(AURORA_FRAGMENT).toContain(`disc * ${AURORA_FULL_DISCS.toFixed(4)}`);
    expect(AURORA_FRAGMENT).toContain(`* ${AURORA_PEAK.toFixed(4)} * clear`);
    expect(AURORA_FRAGMENT).toContain(`${MOON.discDeg.toFixed(4)} * uMoonScale`);
    expect(spec.sky).toEqual(['aurora']);
  });
});
describe('the Frozen Cemetery spec', () => {
  it('is a simple scene: model pines and bare trees, snow ground, a snowy path, blowing snow, icy ghosts in the wind, no clouds, witch, bats or shared mist', () => {
    const count = (m: string) => spec.placements.filter((p) => p.model === m).length;
    // Two model pines (the far one and the big corner one); the cluster pines are light shapes of their own (spec.frost.pines).
    expect(count('frost_pine_a')).toBe(2);
    expect(count('tree_dead_large')).toBeGreaterThanOrEqual(4);
    expect(spec.placements).toHaveLength(2 + count('tree_dead_large'));
    expect(count('frost_rock')).toBe(0);
    expect(spec.ground.kind).toBe('snow');
    expect(spec.path.kind).toBe('snow');
    expect(spec.weather!.kind).toBe('snow');
    expect(spec.layers.ghostTint).toBe(FROST_GHOST_TINT);
    expect(spec.layers.ghosts).toBe(true);
    expect(spec.layers).toMatchObject({ clouds: false, witch: false, bats: 0, mist: false, embers: false, ghostWind: 1 });
  });
  it('has no real point lights and no shared glow sprites: the lanterns carry their own small flame', () => {
    expect(spec.lights).toEqual([]);
    expect(spec.glows).toEqual([]);
  });
  it('uses exactly these model files, all with a file', () => {
    expect([...spec.models].sort()).toEqual(['frost_pine_a', 'tree_dead_large']);
    for (const m of spec.models) expect(hasFile(m)).toBe(true);
  });
  it('puts a crisp moon in the clear sky at the upper right', () => {
    expect(FROST_MOON.crisp).toBe(true);
    for (const a of [16 / 10, 16 / 9, 21 / 9]) {
      const t = FROST_MOON.target(a);
      expect(t.x).toBeGreaterThan(0.7);
      expect(t.y).toBeGreaterThan(0.15);
    }
  });
  it('has two ghosts (a third when the data asks) in the open between the chips and the cards', () => {
    expect(spec.ghostSpots.length).toBeGreaterThanOrEqual(2);
    for (const g of spec.ghostSpots) expect(g.y).toBeGreaterThan(1.5);
  });
  it('keeps the triangles of the placements inside the plan, and declares its own parts', () => {
    expect(planTriangles(spec.placements)).toBeLessThanOrEqual(FROST_TRI_LIMIT);
    expect(spec.extras.calls).toBe(FROST_PARTS.calls);
    expect(spec.extras.tris).toBeGreaterThan(FROST_PARTS.partsTris);
    expect(spec.extras.tris).toBeLessThan(80_000);
  });
  it('lifts every model so it stands on the snow, and has a lighter fog than before', () => {
    for (const p of spec.placements) expect(p.y).toBeCloseTo((FOOT[p.model] ?? 0) * p.scale + 0.004, 9);
    expect(spec.sunk).toBeUndefined();
    expect(spec.fogScale).toBeLessThanOrEqual(0.9);
    expect(spec.fogScale).toBeGreaterThan(0.3);
  });
  it('is the same scene for the same seed', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(buildFrozenCemetery(seed)).toEqual(buildFrozenCemetery(seed));
      }),
      { numRuns: 4 },
    );
  });
});
describe('the look', () => {
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
  it('has a deep navy night: the sky is dark, and the fog is the colour of the horizon so no hard line shows', () => {
    const p = themeById('frost').scene;
    expect(p.fog).toBe(p.skyHorizon);
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return (((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255;
    };
    expect(lum(p.skyTop)).toBeLessThan(0.08);
    expect(lum(p.fog)).toBeLessThan(0.3);
  });
  it('blooms only what is far brighter than lit snow: the threshold is higher than the Crypt, and the lantern colour is under it', () => {
    expect(FROST_BLOOM.threshold).toBeGreaterThan(LOOK.bloom.threshold);
    expect(FROST_BLOOM.intensity).toBeLessThan(LOOK.bloom.intensity);
  });
});
