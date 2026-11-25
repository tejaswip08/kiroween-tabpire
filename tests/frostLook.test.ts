// The Frozen Cemetery is not washed out: a dark navy sky and fog, little haze, bright snow, dark stones and trees.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './helpers/contrast';
import { themeById } from '../lib/themes';
import { themeScene } from '../lib/scene/themeLayout';
import { FROST } from '../entrypoints/newtab/layers/scene/ModelBatch';

const pal = themeById('frost').scene;
const lum = (hex: string) => contrast(hex, '#000000') * 0.05 - 0.05;

describe('Frozen Cemetery look', () => {
  it('has a dark navy sky, horizon, haze and fog', () => {
    for (const c of [pal.skyTop, pal.skyMid, pal.skyHorizon, pal.haze, pal.fog]) {
      expect(lum(c), c).toBeLessThan(0.03);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      expect(b!, `${c} is blue`).toBeGreaterThan(r!);
      expect(b!).toBeGreaterThan(g!);
    }
  });
  it('keeps little haze, so the chapel and the pond read clearly', () => {
    expect(themeScene('frost').unique!.fogScale).toBeLessThanOrEqual(0.5);
  });
  it('lights bright snow and keeps the stones and pines dark', () => {
    expect(lum(pal.groundTint)).toBeGreaterThan(0.6);
    expect(contrast(pal.groundTint, '#3d4d68')).toBeGreaterThan(5); // the stone colour of the graves and the chapel
    expect(Math.max(...FROST.body)).toBeLessThan(0.6);
    expect(FROST.emissiveIntensity).toBeLessThanOrEqual(0.25);
    const graveyard = readFileSync('entrypoints/newtab/layers/scene/themes/FrostGraveyard.tsx', 'utf8');
    expect(graveyard).toMatch(/buildSlab\(\), litMaterial\('#0c1d38', 0\.22\)/);
  });
});
