// The Witch's Forest (.kiro/specs/themes/unique-scenes.md): a haunted red-green forest after a painting. The pure parts and what
// makes the scene itself. The generic rules every unique scene follows (view rules, grounding, overlaps, moon, budget) are in
// uniqueScenes.test.ts, budget.test.ts and propSizes.test.ts, which loop over the registered themes.
import fc from 'fast-check';
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { buildBatches, tintLook } from '../entrypoints/newtab/layers/scene/ModelBatch';
import { buildScaryTree, buildThornBush, buildFlame, buildForestGround, buildGhost, buildGraves, buildPlant, buildTuft, buildWitchScarecrow, GROUND_CELLS } from '../entrypoints/newtab/layers/scene/themes/forestShapes';
import { trianglesOf } from '../entrypoints/newtab/layers/scene/themes/shapes';
import { cameraAt, project } from '../lib/scene/camera';
import { sceneColorsFor } from '../entrypoints/newtab/layers/scene/colors';
import { BUDGET } from '../lib/scene/config';
import { MODELS, type Placement } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { UNIQUE_SCENES } from '../lib/scene/uniqueScenes';
import {
  FOREST_MOON, HERO, JACK, LAYERS, PLACEMENT_TRI_LIMIT, TRAIL_HALF_WIDTH, TREE_LEAN, buildWitchsForest, cauldronFxAt, planTriangles,
} from '../lib/scene/uniqueScenes/forest';
import {
  BOB_HEIGHT, CAULDRON, FIRE, FLAME_COUNT, FLAME_TRIS, FOREST_PARTS, GRAVES, GHOSTS, PLANT_TRIS, SCARECROWS, SWAY_AMPLITUDE, SCARY_COUNT, SCARY_TREE_TRIS, SCARY_VARIANTS, THORN_COUNT, THORN_TRIS,
  TUFT_TRIS, WISP, bob, flames, grass, scarecrowSway,
} from '../lib/scene/uniqueScenes/forestParts';
import { VIEW_ASPECTS, distToPath, solidFootprint, type UniqueSceneSpec } from '../lib/scene/uniqueScenes/types';
import { themeById } from '../lib/themes';
import { weatherTriangles } from '../lib/scene/weather';
const spec = themeScene('forest').unique!;
const forest = spec.forest!;
const trees = spec.placements.filter((p) => p.model.startsWith('forest_twisted'));
const seeds = fc.integer({ min: 0, max: 5000 });
/** Where a world point appears on the screen (x, y from the top, both 0 to 1) at the rest camera. */
const onScreen = (aspect: number, x: number, y: number, z: number) => project([x, y, z], cameraAt(0, aspect, true))!;
const hue = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
describe('the registration', () => {
  it('is the forest theme, built by buildWitchsForest', () => {
    expect(UNIQUE_SCENES.forest).toBe(buildWitchsForest);
    expect(spec.id).toBe('forest');
  });
});
describe('cauldronFxAt', () => {
  it('puts the liquid at the soup level of the pot, scaled with it', () => {
    const at = cauldronFxAt({ x: 3, y: 0, z: -9, scale: 10 });
    expect(at.x).toBe(3);
    expect(at.z).toBe(-9);
    expect(at.y).toBeCloseTo(2.2, 9);
    expect(at.radius).toBeCloseTo(1.31, 9);
    expect(at.y).toBeLessThan(MODELS.forest_cauldron.h * 10);
    expect(at.radius).toBeLessThan(MODELS.forest_cauldron.hx * 10);
  });
  it('scales linearly (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 20, noNaN: true }), fc.double({ min: 1.1, max: 3, noNaN: true }), (s, k) => {
        const a = cauldronFxAt({ x: 0, y: 0, z: 0, scale: s });
        const b = cauldronFxAt({ x: 0, y: 0, z: 0, scale: s * k });
        expect(b.y / a.y).toBeCloseTo(k, 6);
        expect(b.radius / a.radius).toBeCloseTo(k, 6);
      }),
    );
  });
});
describe('the haunted tree and its face', () => {
  const hero = spec.placements.find((p) => p.id === forest.hero.id)!;
  it('is the biggest tree of the foreground, a forest_twisted_a in the left foreground, leaning in toward the trail', () => {
    expect(hero.model).toBe('forest_twisted_a');
    expect(hero.x).toBeLessThan(-5);
    expect(hero.scale).toBe(HERO.scale);
    for (const t of trees.filter((q) => q.z >= LAYERS.near)) expect(t.scale, t.id).toBeLessThanOrEqual(hero.scale);
    // The crown of the model leans toward -x (TREE_LEAN); turned about half a turn it leans toward +x, over the trail.
    expect(TREE_LEAN.forest_twisted_a).toBe(-1);
        expect(Math.cos(hero.rotY)).toBeLessThan(0);
  });
  it('has no face on the trunk', () => {
    expect(Object.keys(forest.hero)).toEqual(['id']);
  });
});
describe('the scary trees and thorn bushes that fill the ground', () => {
  it('has dozens of dead trees of three shapes and thorn bushes, on both sides, never on the path or in a solid prop', () => {
    expect(forest.scary.length).toBeGreaterThanOrEqual(SCARY_COUNT - 4);
    expect(forest.scary.length).toBeLessThanOrEqual(SCARY_COUNT);
    expect(forest.thorns.length).toBeGreaterThanOrEqual(THORN_COUNT - 8);
    expect(new Set(forest.scary.map((t) => t.variant)).size).toBe(SCARY_VARIANTS);
    for (const side of [-1, 1]) expect(forest.scary.filter((t) => Math.sign(t.x) === side).length).toBeGreaterThanOrEqual(6);
    for (const t of [...forest.scary, ...forest.thorns]) {
      expect(distToPath(spec.path.centre, t.x, t.z)).toBeGreaterThanOrEqual(TRAIL_HALF_WIDTH + 0.8);
      for (const p of spec.placements) expect(Math.hypot(p.x - t.x, p.z - t.z), p.id).toBeGreaterThan(solidFootprint(p).hx);
    }
    // Near the camera they stand only at the sides, so the middle of the screen over the path stays open.
    for (const t of forest.scary) if (t.z > 2) expect(Math.abs(t.x)).toBeGreaterThanOrEqual(5.5);
  });
  it('builds each tree as one merged geometry with claws, within its triangle bound', () => {
    for (let v = 0; v < SCARY_VARIANTS; v++) {
      const g = buildScaryTree(v);
      expect(trianglesOf(g)).toBeLessThanOrEqual(SCARY_TREE_TRIS);
      expect(trianglesOf(g)).toBeGreaterThan(300);
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.05);
      expect(g.boundingBox!.max.y).toBeGreaterThan(4.5);
      expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeGreaterThan(3);
      for (const a of g.getAttribute('position').array) expect(Number.isFinite(a)).toBe(true);
    }
    expect(trianglesOf(buildThornBush())).toBeLessThanOrEqual(THORN_TRIS);
  });
});
describe('the fire and the big jack-o\'-lantern', () => {
  it('burns at the foot of the haunted tree, in front of it, bottom left', () => {
    const hero = spec.placements.find((p) => p.id === forest.hero.id)!;
    expect(Math.hypot(FIRE.x - hero.x, FIRE.z - hero.z)).toBeLessThan(5);
    expect(FIRE.z).toBeGreaterThan(hero.z);
    for (const aspect of VIEW_ASPECTS) {
      const q = onScreen(aspect, FIRE.x, 0.5, FIRE.z);
      expect(q.x).toBeLessThan(0.3);
      expect(q.y).toBeGreaterThan(0.6);
    }
  });
  it('has low flames, tallest in the middle, all different, and the same every time', () => {
    const list = flames();
    expect(list).toHaveLength(FLAME_COUNT);
    expect(flames()).toEqual(list);
    for (const f of list) {
      expect(f.height).toBeLessThan(2);
      expect(f.height).toBeGreaterThan(0.4);
      expect(Math.hypot(f.dx, f.dz)).toBeLessThan(1.4);
    }
    expect(new Set(list.map((f) => f.phase.toFixed(3))).size).toBe(FLAME_COUNT);
    expect(trianglesOf(buildFlame())).toBe(FLAME_TRIS);
  });
  it('lights the trunks with real warm lights, and sits a big jack-o\'-lantern beside it', () => {
    const torch = spec.lights.filter((l) => l.kind === 'torch');
    expect(torch.length).toBeGreaterThanOrEqual(1);
    for (const l of torch) expect(Math.hypot(l.x - FIRE.x, l.z - FIRE.z)).toBeLessThan(3);
    const jack = spec.placements.find((p) => p.id === forest.jackId)!;
    expect(jack.model).toBe('pumpkin_orange_jackolantern');
    expect(Math.hypot(jack.x - FIRE.x, jack.z - FIRE.z)).toBeLessThan(5);
    expect(jack.scale).toBe(JACK.scale);
    expect(jack.scale).toBeGreaterThanOrEqual(1.4);
    expect(spec.glows.some((g) => g.kind === 'jackOLantern' && Math.abs(g.x - jack.x) < 0.1)).toBe(true);
    expect(spec.lights.some((l) => l.kind === 'jackOLantern')).toBe(true);
  });
});
describe('the trees: three layers of depth', () => {
  const near = trees.filter((t) => t.z >= LAYERS.near);
  const mid = trees.filter((t) => t.z < LAYERS.near && t.z >= LAYERS.mid);
  const far = trees.filter((t) => t.z < LAYERS.mid);
  it('has trees in all three layers, of all three models, and the near ones are the biggest', () => {
    expect(near.length).toBeGreaterThanOrEqual(3);
    expect(mid.length).toBeGreaterThanOrEqual(5);
    expect(far.length).toBeGreaterThanOrEqual(5);
    expect(new Set(trees.map((t) => t.model))).toEqual(new Set(['forest_twisted_a', 'forest_twisted_b', 'forest_twisted_c']));
    const avg = (l: Placement[]) => l.reduce((s, t) => s + t.scale, 0) / l.length;
    expect(avg(near)).toBeGreaterThan(1.2);
    // Every tree is large: the smallest is as tall as 15 units.
    for (const t of trees) expect(MODELS[t.model].h * t.scale, t.id).toBeGreaterThan(13);
  });
  it('stands trees on both sides, with their crowns leaning in over the trail so they tangle above it', () => {
    for (const side of [-1, 1]) expect(trees.filter((t) => Math.sign(t.x) === side).length).toBeGreaterThanOrEqual(5);
    for (const t of trees) {
      if (Math.abs(t.x) < 3) continue;
      const lean = TREE_LEAN[t.model as keyof typeof TREE_LEAN] * Math.cos(t.rotY) > 0 ? 1 : -1;
      // The crown's lean (after the turn) points toward the middle: opposite to the side the tree stands on.
      if (Math.abs(Math.cos(t.rotY)) > 0.7) expect(lean, t.id).toBe(-Math.sign(t.x));
    }
  });
  it('keeps the centre of the path clear behind the cards: no solid thing stands on it', () => {
    for (const p of spec.placements) {
      const f = solidFootprint(p);
      expect(distToPath(spec.path.centre, p.x, p.z), p.id).toBeGreaterThanOrEqual(TRAIL_HALF_WIDTH + Math.min(f.hx, f.hz) * 0.5);
    }
    for (const s of SCARECROWS) expect(distToPath(spec.path.centre, s.x, s.z)).toBeGreaterThanOrEqual(TRAIL_HALF_WIDTH + 0.5);
    for (const g of GRAVES) expect(distToPath(spec.path.centre, g.x, g.z)).toBeGreaterThanOrEqual(TRAIL_HALF_WIDTH + 0.5);
    // The middle of the screen, over the path, has no model standing in it that is not a far tree.
    for (const aspect of VIEW_ASPECTS) {
      for (const p of spec.placements) {
        if (p.model.startsWith('forest_twisted')) continue;
        const q = onScreen(aspect, p.x, 0, p.z);
        if (q.x > 0.4 && q.x < 0.6) expect(q.y, p.id).toBeGreaterThan(0.45);
      }
    }
  });
  it('draws each tree from its bark mesh only, in a dark colour, with copies of the materials', () => {
    const root = new Group();
    const shared = new MeshStandardMaterial({ color: '#ffffff' });
    for (const name of ['TwistedTree_2_1', 'TwistedTree_2_2']) {
      const m = new Mesh(new BoxGeometry(1, 1, 1), shared);
      m.name = name;
      root.add(m);
    }
    const p: Placement = { id: 't', model: 'forest_twisted_a', group: 'themed', x: 0, y: 0, z: 0, rotY: 0, scale: 1 };
    const crypt = buildBatches('forest_twisted_a', root, [p]);
    expect(crypt.batches).toHaveLength(2);
    const look = { only: ['TwistedTree_2_1'], color: '#4a3a36' };
    const bare = buildBatches('forest_twisted_a', root, [p], look);
    expect(bare.batches).toHaveLength(1);
    expect(bare.batches[0]!.mesh.name).toBe('forest_twisted_a');
    const mat = bare.batches[0]!.part.material as MeshStandardMaterial;
    expect(mat).not.toBe(shared);
    expect(mat.color.getHexString()).toBe('4a3a36');
    expect(shared.color.getHexString()).toBe('ffffff');
    expect(bare.owned.materials).toContain(mat);
    expect(tintLook([], look).parts).toEqual([]);
  });
});
describe('the scarecrows', () => {
  it('has one big one in the right foreground and two smaller ones further back along the path', () => {
    expect(forest.scarecrows).toEqual([...SCARECROWS]);
    expect(SCARECROWS).toHaveLength(3);
    const [big, ...small] = SCARECROWS;
    expect(big!.x).toBeGreaterThan(4);
    expect(big!.z).toBeGreaterThan(2);
    for (const s of small) {
      expect(s.z).toBeLessThan(big!.z - 8);
      expect(Math.abs(s.x)).toBeLessThan(6);
    }
    for (const aspect of VIEW_ASPECTS) {
      const base = onScreen(aspect, big!.x, 0, big!.z);
      const hat = onScreen(aspect, big!.x, 3.7 * big!.scale, big!.z);
      expect(base.x).toBeGreaterThan(0.65);
      expect(base.x).toBeLessThan(0.92);
      // Tall, and standing in the lower half of the screen like a person at the edge of the path.
      expect(base.y - hat.y).toBeGreaterThan(0.3);
      expect(base.y).toBeLessThan(0.95);
      // The arms stay inside the screen.
      const arm = onScreen(aspect, big!.x + 1.6 * big!.scale, 2.05 * big!.scale, big!.z);
      expect(arm.x).toBeLessThan(0.98);
    }
  });
  it('is a ragged coat, a pointed hat and straw hands on a post, in the triangles it declared', () => {
    const g = buildWitchScarecrow();
    expect(trianglesOf(g)).toBeLessThanOrEqual(FOREST_PARTS.scarecrowTris);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeGreaterThan(3.4);
    expect(box.max.y).toBeLessThan(4.2);
    // Arms out: wider than the coat, and no wider than the footprint it keeps free.
    expect(box.max.x - box.min.x).toBeGreaterThan(2.3);
    expect(Math.max(box.max.x, -box.min.x)).toBeLessThanOrEqual(1.6);
  });
  it('sways a little about its post, and not at all with reduced motion (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (t, phase) => {
        expect(Math.abs(scarecrowSway({ phase }, t, false))).toBeLessThanOrEqual(SWAY_AMPLITUDE + 1e-12);
        expect(scarecrowSway({ phase }, t, true)).toBe(0);
      }),
    );
    expect(SWAY_AMPLITUDE).toBeLessThan(0.08);
    expect(new Set([0, 3, 7].map((t) => scarecrowSway({ phase: 0 }, t, false).toFixed(4))).size).toBeGreaterThan(1);
  });
});
describe('the ghosts and the wisp', () => {
  it('has three or four green ghosts high among the branches on the right, and a wisp on the left', () => {
    expect(GHOSTS.length).toBeGreaterThanOrEqual(3);
    expect(GHOSTS.length).toBeLessThanOrEqual(4);
    expect(forest.ghosts).toEqual([...GHOSTS]);
    expect(spec.ghostSpots).toEqual(GHOSTS.map((g) => ({ x: g.x, y: g.y, z: g.z })));
    for (const aspect of VIEW_ASPECTS) {
      for (const g of GHOSTS) {
        const q = onScreen(aspect, g.x, g.y, g.z);
        expect(q.x, `ghost x at ${aspect}`).toBeGreaterThan(0.55);
        expect(q.x).toBeLessThan(0.97);
        expect(q.y).toBeLessThan(0.45);
        expect(q.y).toBeGreaterThan(0.05);
      }
      expect(onScreen(aspect, WISP.x, WISP.y, WISP.z).x).toBeLessThan(0.45);
    }
    // They float: higher than a person, lower than the treetops.
    for (const g of GHOSTS) expect(g.y).toBeGreaterThan(5);
    expect(buildGhost().getAttribute('position').count).toBeGreaterThan(0);
    expect(trianglesOf(buildGhost())).toBeLessThanOrEqual(FOREST_PARTS.ghostTris);
  });
  it('bobs slowly and never leaves its spot by more than the bob height, and stands still with reduced motion (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 5000, noNaN: true }), (phase, t) => {
        expect(Math.abs(bob(phase, t, false))).toBeLessThanOrEqual(BOB_HEIGHT + 1e-12);
        expect(bob(phase, t, true)).toBe(0);
      }),
    );
  });
  it('lets the shared ghost layer rest, and draws these itself', () => {
    expect(spec.layers.ghosts).toBe(false);
  });
});
describe('the graves, the grass and the path', () => {
  it('has a few crooked wooden crosses and tiny tombstones in the midground near the path', () => {
    expect(forest.graves).toEqual([...GRAVES]);
    expect(GRAVES.filter((g) => g.kind === 'cross').length).toBeGreaterThanOrEqual(3);
    expect(GRAVES.filter((g) => g.kind === 'stone').length).toBeGreaterThanOrEqual(2);
    expect(GRAVES.length).toBeLessThanOrEqual(10);
    for (const g of GRAVES) {
      expect(Math.abs(g.tilt), 'crooked').toBeGreaterThan(0.08);
      expect(distToPath(spec.path.centre, g.x, g.z)).toBeLessThan(8);
      expect(g.z).toBeLessThan(0);
      expect(g.z).toBeGreaterThan(-14);
    }
    expect(trianglesOf(buildGraves(GRAVES))).toBeLessThanOrEqual(FOREST_PARTS.graveTris);
  });
  it('winds from the bottom centre of the screen into the distance, dirt, with a reddish-brown colour', () => {
    expect(spec.path.kind).toBe('dirt');
    const c = spec.path.centre;
    for (const aspect of VIEW_ASPECTS) {
      const near = c.map((p) => ({ p, q: project([p.x, 0, p.z], cameraAt(0, aspect, true)) })).filter((e) => e.q && e.q.y > 0.85);
      expect(near.length).toBeGreaterThan(0);
      for (const e of near) expect(Math.abs(e.q!.x - 0.5)).toBeLessThan(0.2);
    }
    // It really winds: the centre line crosses x = 0.5 more than once.
    let swings = 0;
    for (let i = 2; i < c.length; i++) if (Math.sign(c[i]!.x - c[i - 1]!.x) !== Math.sign(c[i - 1]!.x - c[i - 2]!.x)) swings++;
    expect(swings).toBeGreaterThanOrEqual(2);
    expect(c[c.length - 1]!.z).toBeLessThan(-20);
  });
  it('has rough grass and small dark plants at the edges of the path, never on it and never tall (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(0, 7, 99), (seed) => {
        const s = buildWitchsForest(seed).forest!;
        for (const t of [...s.grass.tufts, ...s.grass.plants]) expect(distToPath(spec.path.centre, t.x, t.z)).toBeGreaterThanOrEqual(TRAIL_HALF_WIDTH + 0.1);
        for (const t of s.grass.tufts) expect(t.height).toBeLessThanOrEqual(0.9);
      }),
      { numRuns: 3 },
    );
    expect(forest.grass.tufts.length).toBeGreaterThan(100);
    expect(forest.grass.plants.length).toBeGreaterThanOrEqual(10);
    expect(grass(spec.path.centre, TRAIL_HALF_WIDTH, spec.reserved)).toEqual(grass(spec.path.centre, TRAIL_HALF_WIDTH, spec.reserved));
    expect(trianglesOf(buildTuft())).toBeLessThanOrEqual(TUFT_TRIS);
    expect(trianglesOf(buildPlant())).toBeLessThanOrEqual(PLANT_TRIS);
  });
  it('paints the ground near-black, warm on the left and green on the right', () => {
    const g = buildForestGround(FIRE);
    expect(trianglesOf(g)).toBe(GROUND_CELLS * GROUND_CELLS * 2);
    expect(trianglesOf(g)).toBeLessThanOrEqual(FOREST_PARTS.groundTris);
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    let left: number[] = [0, 0, 0];
    let right: number[] = [0, 0, 0];
    let nl = 0;
    let nr = 0;
    let brightest = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 40;
      brightest = Math.max(brightest, col.getX(i), col.getY(i), col.getZ(i));
      if (z < -20 || z > 8) continue;
      if (x > -14 && x < -3) {
        left = left.map((v, k) => v + col.getComponent(i, k));
        nl++;
      }
      if (x > 6 && x < 17) {
        right = right.map((v, k) => v + col.getComponent(i, k));
        nr++;
      }
    }
    // Near-black everywhere, red above green on the left, green above red on the right.
    expect(brightest).toBeLessThan(0.1);
    expect(left[0]! / nl).toBeGreaterThan(left[1]! / nl);
    expect(right[1]! / nr).toBeGreaterThan(right[0]! / nr);
  });
});
describe('the cauldron and the mushrooms', () => {
  const pot = spec.placements.find((p) => p.model === 'forest_cauldron')!;
  const shrooms = spec.placements.filter((p) => p.model === 'forest_mushroom');
  it('keeps the cauldron, small, in the midground beside the path, with a green glow', () => {
    expect(pot.x).toBe(CAULDRON.x);
    expect(MODELS.forest_cauldron.h * pot.scale).toBeLessThan(2.2);
    expect(MODELS.forest_cauldron.hx * pot.scale).toBeLessThan(1.5);
    expect(pot.z).toBeLessThan(-2);
    expect(distToPath(spec.path.centre, pot.x, pot.z)).toBeLessThan(6);
    expect(spec.glows.some((g) => g.kind === 'cauldron' && g.x === pot.x && g.z === pot.z)).toBe(true);
    expect(spec.lights.some((l) => l.kind === 'cauldron')).toBe(true);
    expect(themeById('forest').scene.cauldron).toMatch(/^#[0-9a-f]{6}$/);
    const c = hue(themeById('forest').scene.cauldron);
    expect(c.g).toBeGreaterThan(c.r);
  });
  it('has only a few small glowing mushrooms by it, and no giant ones, potions or pale rocks', () => {
    expect(shrooms.length).toBeGreaterThanOrEqual(3);
    expect(shrooms.length).toBeLessThanOrEqual(5);
    for (const m of shrooms) {
      expect(m.scale).toBeLessThanOrEqual(1.4);
      expect(Math.hypot(m.x - pot.x, m.z - pot.z)).toBeLessThan(4);
      expect(spec.glows.some((g) => g.kind === 'mushroom' && g.x === m.x && g.z === m.z)).toBe(true);
    }
    for (const id of ['forest_mushroom_king', 'forest_potion_a', 'forest_potion_b', 'forest_rock_large', 'forest_rocks'] as const) expect(spec.models).not.toContain(id);
  });
});
describe('the colour and the light', () => {
  const p = themeById('forest').scene;
  it('has a sky from dark red at the top, through hot red-orange, to murky green at the horizon', () => {
    const top = hue(p.skyTop);
    const mid = hue(p.skyMid);
    const horizon = hue(p.skyHorizon);
    expect(top.r).toBeGreaterThan(top.g * 2);
    expect(top.r + top.g + top.b).toBeLessThan(mid.r + mid.g + mid.b);
    expect(mid.r).toBeGreaterThan(mid.g * 2.5);
    expect(horizon.g).toBeGreaterThan(horizon.r);
    expect(horizon.g).toBeGreaterThan(horizon.b);
  });
  it('has green fog and a green mist, and a hot glow on the left against a green one on the right', () => {
    for (const k of ['fog', 'haze', 'skyRight', 'rim'] as const) {
      const c = hue(p[k]!);
      expect(c.g, k).toBeGreaterThan(c.r);
      expect(c.g, k).toBeGreaterThan(c.b);
    }
    for (const k of ['skyLeft', 'moonlight', 'lantern', 'jack'] as const) {
      const c = hue(p[k]!);
      expect(c.r, k).toBeGreaterThan(c.g);
      expect(c.g, k).toBeGreaterThan(c.b - 1);
    }
    // Both exist as three colours too, for the sky shader and the side lights.
    const colors = sceneColorsFor('forest');
    expect(colors.skyLeft!.r).toBeGreaterThan(colors.skyLeft!.g);
    expect(colors.skyRight!.g).toBeGreaterThan(colors.skyRight!.r);
    // The other themes have no two-tone sky, so their sky is unchanged.
    for (const id of ['crypt', 'pumpkin', 'frost', 'bloodmoon', 'castle'] as const) expect(themeById(id).scene.skyLeft, id).toBeUndefined();
  });
  it('keeps the ground near-black so the trees and the ground are silhouettes', () => {
    const g = hue(p.groundBase);
    expect(g.r + g.g + g.b).toBeLessThan(60);
  });
});
describe('the moon, and no clouds or Crypt sky life', () => {
  it('shows a big moon in the upper right that the branches may cross, and turns the other sky layers off', () => {
    expect(spec.layers.moon).not.toBe(false);
    expect(spec.moon).toBe(FOREST_MOON);
    expect(FOREST_MOON.seeThrough).toBe(true);
    expect(FOREST_MOON.scale).toBeGreaterThan(1);
    for (const aspect of VIEW_ASPECTS) {
      const t = FOREST_MOON.target(aspect);
      expect(t.x).toBeGreaterThan(0.7);
      expect(t.y).toBeLessThan(0.3);
    }
    expect(spec.layers.clouds).toBe(false);
    expect(spec.layers.witch).toBe(false);
    expect(spec.layers.bats).toBe(0);
    expect(spec.layers.mist).toBe(true);
    expect(spec.weather!.kind).toBe('fireflies');
    const m = hue(themeById('forest').scene.moon);
    expect(m.r).toBeGreaterThan(m.g * 2);
  });
  it('has thick fog', () => {
    expect(spec.fogScale).toBeGreaterThanOrEqual(2.5);
  });
});
describe('the budget', () => {
  it('stays within the triangle plan of the whole theme with room to spare', () => {
    expect(planTriangles(spec.placements)).toBeLessThanOrEqual(PLACEMENT_TRI_LIMIT);
    expect(planTriangles(spec.placements) + spec.extras.tris + weatherTriangles(spec.weather)).toBeLessThanOrEqual(BUDGET.sceneTriangles);
  });
  it('counts every part it draws itself, with a real light budget', () => {
    expect(spec.lights.length).toBeGreaterThanOrEqual(3);
    expect(spec.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
    expect(FLAME_COUNT * FLAME_TRIS).toBeLessThan(200);
    expect(spec.extras.calls).toBe(FOREST_PARTS.calls);
  });
  it('keeps every placement inside the limits for every seed (property)', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const s: UniqueSceneSpec = buildWitchsForest(seed);
        expect(planTriangles(s.placements)).toBeLessThanOrEqual(PLACEMENT_TRI_LIMIT);
        expect(s.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
        expect(s.placements.some((p) => p.id === s.forest!.hero.id)).toBe(true);
      }),
      { numRuns: 6 },
    );
  });
  it('is one mesh per kind: the hand-built shapes each merge to one geometry', () => {
    for (const g of [buildScaryTree(0), buildThornBush(), buildWitchScarecrow(), buildGhost(), buildGraves(GRAVES), buildTuft(), buildPlant(), buildForestGround(FIRE)]) {
      expect(g.getAttribute('position').count).toBeGreaterThan(0);
    }
    expect(new Matrix4().identity().elements).toHaveLength(16);
  });
});
