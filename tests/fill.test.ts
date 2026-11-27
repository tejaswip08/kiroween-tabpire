// The fill of the four enabled themes (lib/scene/uniqueScenes/fill.ts): seeded, spread out, behind the cards, inside the budget.
import { describe, expect, it } from 'vitest';
import { LAYOUT_SEED, MODELS, footprintOf, footprintsOverlap, insideGround, type ModelId } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { BUDGET } from '../lib/scene/config';
import { weatherTriangles } from '../lib/scene/weather';
import { VIEW_ASPECTS, solidFootprint, viewOf } from '../lib/scene/uniqueScenes/types';
import { FILL_MAX_HEIGHT, FILL_TOP_Y, OPEN_SCREEN, groundAt, type FillTheme } from '../lib/scene/uniqueScenes/fill';
import { fillGeometry } from '../entrypoints/newtab/layers/scene/fillShapes';
import { trianglesOf } from '../entrypoints/newtab/layers/scene/themes/shapes';
import { planTriangles } from '../lib/scene/uniqueScenes/forest';

// Requirement changed: the Crypt's layout (lib/scene/layout.ts) is complete in itself, with its backdrop behind the fence, so it has no
// separate fill. The other three enabled themes keep theirs.
const THEMES: FillTheme[] = ['pumpkin', 'forest', 'frost'];
describe('the crypt', () => {
  it('has no separate fill: its tombstones, trees and backdrop are its own placements', () => {
    expect(themeScene('crypt').fill).toBeUndefined();
  });
});
const FLAT: ModelId[] = ['fill_fog', 'fill_print'];

describe.each(THEMES)('the %s fill', (theme) => {
  const scene = themeScene(theme);
  const fill = scene.fill!;
  it('exists and adds a good number of props', () => {
    expect(fill.placements.length).toBeGreaterThanOrEqual(25);
  });
  it('is the same on every load', () => {
    const again = themeScene(theme, LAYOUT_SEED).fill!;
    expect(again.placements).toEqual(fill.placements);
  });
  it('has unique ids and every prop inside the ground and below the chips row', () => {
    expect(new Set(fill.placements.map((p) => p.id)).size).toBe(fill.placements.length);
    for (const p of fill.placements) {
      expect(insideGround(footprintOf(p)), p.id).toBe(true);
      expect(MODELS[p.model].h * p.scale, p.id).toBeLessThanOrEqual(FILL_MAX_HEIGHT);
      for (const a of VIEW_ASPECTS) {
        const v = viewOf(p, a)!;
        expect(v.top, `${p.id} at ${a}`).toBeGreaterThanOrEqual(FILL_TOP_Y);
        expect(v.left).toBeGreaterThanOrEqual(0);
        expect(v.right).toBeLessThanOrEqual(1);
      }
    }
  });
  it('does not overlap a solid prop of the scene or another fill prop', () => {
    const base = scene.unique ? scene.unique.placements : scene.layout.placements.filter((p) => p.group !== 'path' && p.group !== 'ground');
    const solid = fill.placements.filter((p) => !FLAT.includes(p.model));
    for (const p of solid) {
      for (const q of base) if (!['path', 'ground'].includes(q.group)) expect(footprintsOverlap(footprintOf(p), solidFootprint(q), 0), `${p.id} ${q.id}`).toBe(false);
    }
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) expect(footprintsOverlap(footprintOf(solid[i]!), footprintOf(solid[j]!), 0), `${solid[i]!.id} ${solid[j]!.id}`).toBe(false);
    }
  });
  it('lists the files it needs, and only those', () => {
    const files = new Set(fill.placements.map((p) => p.model).filter((m) => MODELS[m].source !== 'procedural'));
    expect(new Set(fill.models)).toEqual(files);
  });
  it('stays inside the triangle budget together with the scene', () => {
    const own = scene.unique ? planTriangles(scene.unique.placements) + scene.unique.extras.tris + weatherTriangles(scene.weather) : 0;
    expect(own + fill.tris).toBeLessThanOrEqual(BUDGET.sceneTriangles);
    expect(fill.tris).toBeLessThan(40_000);
    expect(fill.calls).toBeLessThanOrEqual(40);
  });
});

describe('the fill draws what the catalogue promises', () => {
  it('every small shape has a geometry no bigger than its catalogue triangles', () => {
    for (const id of Object.keys(MODELS).filter((m) => m.startsWith('fill_') && m !== 'fill_fog') as ModelId[]) {
      const g = fillGeometry(id, 'crypt')!;
      expect(g, id).not.toBeNull();
      expect(trianglesOf(g), id).toBeLessThanOrEqual(MODELS[id].tris);
    }
  });
});

describe('the open screen', () => {
  it('maps back to the ground', () => {
    for (const r of OPEN_SCREEN) expect(groundAt(r.sx[0], r.sy[1])).not.toBeNull();
  });
  it('is filled in each theme: props show in the lower part of the screen where the second row of cards ends', () => {
    for (const theme of THEMES) {
      const lower = themeScene(theme).fill!.placements.filter((p) => {
        const v = viewOf(p, 1.6)!;
        return v.cx > 0.28 && v.bottom > 0.72;
      });
      // The Pumpkin Patch's lower screen is its lane (track, fence, lanterns and dry corn), which already has props of its own.
      expect(lower.length, theme).toBeGreaterThanOrEqual(theme === 'pumpkin' ? 2 : 4);
    }
  });
  it('keeps the other themes untouched: Blood Moon and Haunted Castle have no fill of their own', () => {
    expect(themeScene('bloodmoon').fill).toBe(themeScene('crypt').fill);
  });
});
