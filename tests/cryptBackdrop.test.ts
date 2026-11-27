// The Crypt's backdrop behind the fence (lib/scene/layout.ts), the far village on the hills (lib/scene/depth.ts) and the ground fog
// between them (lib/scene/depthFog.ts): layered, balanced on both sides, seeded, and never behind the page's controls or over the moon.
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { CONTROL_BOXES, FENCE_Z, behindControls, buildLayout, layout, overCryptMoon } from '../lib/scene/layout';
import { FAR_SINK } from '../lib/scene/depth';
import { FOG_BANDS } from '../lib/scene/depthFog';
import { moonScreenRadius, moonTarget } from '../lib/scene/sky';
import { loadGlbGeometry } from './helpers/glb';
const L = layout();
const behind = L.placements.filter((p) => p.z < FENCE_Z - 1);
const side = (sign: 1 | -1) => behind.filter((p) => p.x * sign > 3);
describe('the Crypt backdrop behind the fence', () => {
  it('has bare dead trees of different heights and rust pines on both sides', () => {
    for (const s of [-1, 1] as const) {
      const dead = side(s).filter((p) => p.group === 'tree' && (p.model.startsWith('tree_dead') || p.model.startsWith('forest_twisted')));
      expect(dead.length, `side ${s}`).toBeGreaterThanOrEqual(3);
      expect(new Set(dead.map((p) => p.scale.toFixed(2))).size).toBeGreaterThanOrEqual(3);
      expect(side(s).filter((p) => p.model.startsWith('tree_pine') && p.z < -15).length).toBeGreaterThanOrEqual(1);
    }
    // Lanterns hang from two of the back trees.
    expect(L.placements.filter((p) => p.model === 'lantern_hanging' && p.z < -15).length).toBeGreaterThanOrEqual(2);
  });
  it('has two more mausoleums, broken fence sections, a lone lamp post and leaning tombstones peeking over the fence', () => {
    const crypts = L.placements.filter((p) => p.model === 'crypt');
    expect(crypts).toHaveLength(3);
    expect(crypts.filter((p) => p.x < 0)).toHaveLength(1);
    expect(behind.filter((p) => p.model === 'fence_broken').length).toBeGreaterThanOrEqual(4);
    expect(behind.some((p) => p.model === 'post_lantern' && p.z < -10)).toBe(true);
    const peek = behind.filter((p) => p.group === 'oldGrave' && p.z > -12);
    for (const s of [-1, 1]) expect(peek.filter((p) => p.x * s > 0).length).toBeGreaterThanOrEqual(4);
    expect(peek.filter((p) => p.tilt && Math.hypot(...p.tilt) > 0.02).length).toBeGreaterThanOrEqual(6);
  });
  it('never stands behind the header, stats, search box, Add page or chips, nor over the moon', () => {
    for (const p of behind) {
      if (p.group === 'crypt') continue;
      expect(behindControls(p), p.id).toBe(false);
      expect(overCryptMoon(p), p.id).toBe(false);
    }
  });
  it('is the same on every load', () => {
    expect(JSON.parse(JSON.stringify(buildLayout()))).toEqual(JSON.parse(JSON.stringify(L)));
  });
});
describe('the far village on the hills', () => {
  it('shows over the fence only at the sides and in the low hill line: never behind a control, never over the moon', async () => {
    const { buildFarVillage } = await import('../entrypoints/newtab/layers/scene/farBuild');
    const load = async (f: string) => (await loadGlbGeometry(`quaternius/${f}.glb`)).scene;
    const built = buildFarVillage({ barn: await load('farm_barn'), windmill: await load('farm_windmill'), fortress: await load('castle_fortress'), ruins: await load('blood_ruins') });
    const pos = built.village.getAttribute('position');
    for (const { aspect, boxes } of CONTROL_BOXES) {
      const cam = cameraAt(0, aspect, true);
      const moon = moonTarget(aspect);
      const r = moonScreenRadius(aspect).disc;
      let sides = 0;
      for (let i = 0; i < pos.count; i++) {
        const q = project([pos.getX(i), pos.getY(i) - FAR_SINK, pos.getZ(i)], cam);
        if (!q || q.x < 0 || q.x > 1) continue;
        for (const b of boxes) if (q.x > b.x0 && q.x < b.x1) expect(q.y, `vertex ${i} at x ${q.x.toFixed(2)}`).toBeGreaterThan(b.y1);
        expect(Math.hypot((q.x - moon.x) * aspect, q.y - moon.y), `vertex ${i}`).toBeGreaterThan(r);
        if (q.y < 0.34) sides++;
      }
      // The church steeple, the fortress and the houses rise over the hills at the sides.
      expect(sides).toBeGreaterThan(50);
    }
  });
});
describe('the ground fog between the layers', () => {
  it('lies behind the fence, wider and taller farther back, and stays light', () => {
    for (let i = 0; i < FOG_BANDS.length; i++) {
      const b = FOG_BANDS[i]!;
      expect(b.z).toBeLessThan(FENCE_Z);
      expect(b.alpha).toBeLessThanOrEqual(0.5);
      if (i > 0) {
        expect(b.z).toBeLessThan(FOG_BANDS[i - 1]!.z);
        expect(b.w).toBeGreaterThan(FOG_BANDS[i - 1]!.w);
        expect(b.h).toBeGreaterThan(FOG_BANDS[i - 1]!.h);
      }
    }
  });
});
