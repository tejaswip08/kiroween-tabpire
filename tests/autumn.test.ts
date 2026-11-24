// The Pumpkin Patch's autumn lane: the big tree, the trick-or-treaters, the dry corn lane, the crooked fence and the
// jack-o'-lanterns, the grass, the leaves, the twilight sky, the crisp harvest moon, smooth pumpkins and the windmill sails.
import { describe, expect, it } from 'vitest';
import { Color, type Mesh, type MeshStandardMaterial } from 'three';
import {
  buildBanks, buildDryStalk, buildFence, buildFlatLeaf, buildGhostKid, buildTreeLeaves, buildTreeWood, buildTuft, buildWitchKid, trianglesOf,
} from '../entrypoints/newtab/layers/scene/themes/autumnBuild';
import { cornerIndices, worldPositions } from '../entrypoints/newtab/layers/scene/geometryTools';
import { collectParts, shadePumpkin } from '../entrypoints/newtab/layers/scene/ModelBatch';
import { cameraAt, project } from '../lib/scene/camera';
import { MODELS } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import {
  BANK, FRAME_WINDOWS, KID_HEIGHT, KID_PAUSE_S, KID_SPEED, LANE, LANE_Z, ballBlocks, ballOnScreen, bankHeight, kidsAt, pointAlong, tubeBalls, uiRects,
} from '../lib/scene/uniqueScenes/autumn';
import { BARN, PUMPKIN_PARTS } from '../lib/scene/uniqueScenes/pumpkin';
import { distToPath } from '../lib/scene/uniqueScenes/types';
import { SAIL_CENTRE, SAIL_RADIUS, splitBlades } from '../lib/scene/windmill';
import { themeById } from '../lib/themes';
import { loadGlbGeometry } from './helpers/glb';

const spec = themeScene('pumpkin').unique!;
const plan = spec.autumn!;
const tree = plan.tree;
const REF: readonly [number, number] = [1695, 723];
const visibleIn = (c: { x: number; y: number; z: number; r: number }, [w, h]: readonly [number, number]) => {
  const s = ballOnScreen(c.x, c.y, c.z, c.r, w / h)!;
  return s.cx + s.rx > 0 && s.cx - s.rx < 1 && s.cy + s.ry > 0 && s.cy - s.ry < 1 ? s : null;
};

describe('the big autumn tree', () => {
  it('stands in the left foreground, with a thick trunk, a knot hole, limbs and many leaf clusters in red, orange and gold', () => {
    expect(tree.base.x).toBeLessThan(-3);
    expect(tree.base.z).toBeGreaterThan(5);
    expect(tree.trunk.radii[0]).toBeGreaterThanOrEqual(1);
    expect(tree.branches.length).toBeGreaterThanOrEqual(4);
    expect(tree.clusters.length).toBeGreaterThan(120);
    const tones = new Set(tree.clusters.map((c) => c.tone));
    for (const t of ['red', 'orange', 'gold'] as const) expect(tones.has(t), t).toBe(true);
    // The knot hole is on the trunk's surface, low on the trunk.
    expect(tree.knot.y).toBeGreaterThan(1);
    expect(tree.knot.y).toBeLessThan(3.5);
  });
  it('frames the top-left and the top edge, and a red branch peeks in from the top-right corner (reference window)', () => {
    const shown = tree.clusters.map((c) => visibleIn(c, REF)).filter((s) => s !== null);
    expect(shown.length).toBeGreaterThan(30);
    // Leaves on the left, under the brand.
    expect(shown.filter((s) => s.cx < 0.3 && s.cy > 0.15).length).toBeGreaterThan(10);
    // Leaves hanging in along the top edge, reaching toward the centre.
    const top = shown.filter((s) => s.cy - s.ry < 0.01);
    expect(top.length).toBeGreaterThan(8);
    expect(Math.max(...top.map((s) => s.cx))).toBeGreaterThan(0.25);
    const corner = tree.cornerClusters.map((c) => visibleIn(c, REF)).filter((s) => s !== null);
    expect(corner.length).toBeGreaterThan(3);
    for (const s of corner) expect(s.cx).toBeGreaterThan(0.7);
    expect(tree.cornerClusters.every((c) => c.tone === 'red' || c.tone === 'deep' || c.tone === 'orange')).toBe(true);
  });
  it('never sits behind the header, the search box, the pinned pages, the chips or the moon, in any window', () => {
    for (const c of [...tree.clusters, ...tree.cornerClusters]) expect(ballBlocks(c.x, c.y, c.z, c.r), `leaves at ${c.x},${c.y},${c.z}`).toBeNull();
    for (const t of [tree.trunk, ...tree.branches, tree.corner]) {
      for (const b of tubeBalls(t)) expect(ballBlocks(b.x, b.y, b.z, b.r, false), `wood at ${b.x},${b.y},${b.z}`).toBeNull();
    }
  });
  it('keeps the leaves above the cards: no leaf hangs below 330 px from the top', () => {
    for (const [w, h] of FRAME_WINDOWS) {
      for (const c of tree.clusters) {
        const s = visibleIn(c, [w, h]);
        if (s) expect(s.cy + s.ry).toBeLessThanOrEqual(330 / h + 1e-9);
      }
    }
  });
  it('places the controls from the page CSS: a centred 1400 px column', () => {
    const r = uiRects(1920, 1080);
    const stats = r.find((x) => x.name === 'stats')!;
    expect((stats.x0 + stats.x1) / 2).toBeCloseTo(0.5, 9);
    expect(r.find((x) => x.name === 'brand')!.x0 * 1920).toBeCloseTo(260 - 8, 6);
  });
});

describe('the trick-or-treaters', () => {
  const { route } = plan;
  it('walk the trail toward the barn, on the path', () => {
    expect(route.length).toBeGreaterThan(10);
    const end = route.points[route.points.length - 1]!;
    const start = route.points[0]!;
    expect(start.z).toBeGreaterThan(end.z);
    expect(Math.hypot(end.x - BARN.x, end.z - BARN.z)).toBeLessThan(9);
    for (const p of route.points) expect(distToPath(spec.path.centre, p.x, p.z)).toBeLessThan(0.01);
  });
  it('move slowly away, then loop back to the start after a pause', () => {
    const walk = route.length / KID_SPEED;
    const a = kidsAt(route, walk * 0.2, false);
    const b = kidsAt(route, walk * 0.6, false);
    expect(b.s).toBeGreaterThan(a.s);
    expect(KID_SPEED).toBeLessThanOrEqual(0.8);
    expect(kidsAt(route, walk + KID_PAUSE_S / 2, false).scale).toBe(0);
    const again = kidsAt(route, walk + KID_PAUSE_S + walk * 0.2, false);
    expect(again.s).toBeCloseTo(a.s, 6);
    expect(kidsAt(route, walk * 0.5, false).scale).toBe(1);
  });
  it('stand still under reduced motion', () => {
    const first = kidsAt(route, 0, true);
    for (const t of [3, 40, 999]) expect(kidsAt(route, t, true)).toEqual(first);
    expect(first.scale).toBe(1);
    expect(pointAlong(route, first.s).z).toBeLessThan(route.points[0]!.z);
  });
  it('are small: a bedsheet ghost and a little witch with a pointed hat, each with a pumpkin bucket', () => {
    const ghost = buildGhostKid();
    const witch = buildWitchKid();
    ghost.computeBoundingBox();
    witch.computeBoundingBox();
    expect(ghost.boundingBox!.max.y).toBeCloseTo(KID_HEIGHT.ghost, 0);
    expect(witch.boundingBox!.max.y).toBeGreaterThan(1.5);
    expect(witch.boundingBox!.max.y).toBeLessThan(1.8);
    // Orange bucket colours on both.
    const hasOrange = (g: ReturnType<typeof buildGhostKid>) => {
      const c = g.getAttribute('color');
      const o = new Color('#f08a1c');
      for (let i = 0; i < c.count; i++) if (Math.abs(c.getX(i) - o.r) < 1e-3 && Math.abs(c.getY(i) - o.g) < 1e-3) return true;
      return false;
    };
    expect(hasOrange(ghost)).toBe(true);
    expect(hasOrange(witch)).toBe(true);
  });
});

describe('the corn lane', () => {
  const line = plan.line.filter((c) => c.z <= LANE_Z.from && c.z >= LANE_Z.to);
  const sideOfPoint = (x: number, z: number) => {
    let best = line[0]!;
    for (const c of line) if (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z)) best = c;
    return Math.sign((x - best.x) * best.dz - (z - best.z) * best.dx);
  };
  it('has tall dry stalks on both sides, taller than the children, leaning a little, between the fence and the green corn', () => {
    const stalk = buildDryStalk();
    stalk.computeBoundingBox();
    const h = stalk.boundingBox!.max.y;
    expect(plan.stalks.length).toBeGreaterThan(60);
    for (const s of plan.stalks) {
      expect(h * s.scale).toBeGreaterThan(KID_HEIGHT.witch + 0.6);
      const lean = Math.hypot(s.leanX, s.leanZ);
      expect(lean).toBeGreaterThan(0.03);
      expect(lean).toBeLessThan(0.25);
      const d = distToPath(spec.path.centre, s.x, s.z);
      expect(d).toBeGreaterThan(LANE.fence);
    }
    const sides = new Set(plan.stalks.map((s) => sideOfPoint(s.x, s.z)));
    expect(sides).toEqual(new Set([-1, 1]));
    // The green corn field stays further out than the dry lane.
    for (const p of spec.placements.filter((q) => q.model === 'farm_corn')) expect(distToPath(spec.path.centre, p.x, p.z)).toBeGreaterThan(LANE.corn[0]);
  });
  it('has a crooked rustic fence on both sides, with a row of glowing jack-o-lanterns at its base', () => {
    expect(plan.fence[0]!.length).toBeGreaterThan(4);
    expect(plan.fence[1]!.length).toBeGreaterThan(4);
    const posts = plan.fence.flat();
    expect(new Set(posts.map((p) => p.height.toFixed(2))).size).toBeGreaterThan(posts.length / 2);
    expect(posts.some((p) => Math.abs(p.leanX) > 0.05 || Math.abs(p.leanZ) > 0.05)).toBe(true);
    expect(trianglesOf(buildFence(plan.fence))).toBeGreaterThan(posts.length * 12);
    const row = spec.placements.filter((p) => p.model === 'pumpkin_orange_jackolantern' && Math.abs(distToPath(spec.path.centre, p.x, p.z) - LANE.jack) < 0.4);
    expect(row.length).toBeGreaterThanOrEqual(8);
    expect(new Set(row.map((p) => sideOfPoint(p.x, p.z)))).toEqual(new Set([-1, 1]));
    for (const j of row) expect(spec.glows.some((g) => g.kind === 'jackOLantern' && g.x === j.x && g.z === j.z)).toBe(true);
    // At most the real-light budget: the row glows with pools and flames, not with more point lights.
    expect(spec.lights.length).toBeLessThanOrEqual(6);
  });
});

describe('the grass, the trail and the leaves', () => {
  it('has a green-yellow grass ground and banks on both sides of a winding dirt trail', () => {
    expect(spec.ground.kind).toBe('grass');
    const base = new Color(themeById('pumpkin').scene.groundBase);
    expect(base.g).toBeGreaterThan(base.r * 0.9);
    expect(base.g).toBeGreaterThan(base.b);
    expect(bankHeight(0)).toBe(0);
    expect(bankHeight(2.8)).toBeGreaterThan(0.1);
    expect(bankHeight(BANK.outer)).toBe(0);
    expect(trianglesOf(buildBanks(plan.line))).toBeGreaterThan(100);
    // Winding: the trail turns one way and then the other.
    const turns = plan.line.slice(1).map((c, i) => Math.sign(c.dx * plan.line[i]!.dz - c.dz * plan.line[i]!.dx)).filter((v) => v !== 0);
    expect(new Set(turns)).toEqual(new Set([-1, 1]));
    expect(plan.patches.length).toBeGreaterThan(6);
    for (const p of plan.patches) expect(distToPath(spec.path.centre, p.x, p.z)).toBeLessThan(spec.path.halfWidth);
  });
  it('has grass tufts on both banks and fallen leaves on the trail and the grass', () => {
    expect(plan.tufts.length).toBeGreaterThan(300);
    expect(trianglesOf(buildTuft())).toBe(7);
    const onTrail = plan.leaves.filter((l) => distToPath(spec.path.centre, l.x, l.z) < spec.path.halfWidth);
    expect(onTrail.length).toBeGreaterThan(60);
    expect(plan.leaves.length - onTrail.length).toBeGreaterThan(60);
    expect(new Set(plan.leaves.map((l) => l.tone)).size).toBeGreaterThanOrEqual(4);
  });
  it('lets leaves fall in red and orange', () => {
    expect(spec.weather!.kind).toBe('leaves');
    const pal = themeById('pumpkin').scene;
    for (const c of [new Color(pal.weatherA), new Color(pal.weatherB)]) {
      expect(c.r).toBeGreaterThan(0.6);
      expect(c.b).toBeLessThan(0.15);
    }
  });
});

describe('the sky and the moon', () => {
  it('blends orange dusk at the horizon into purple-blue twilight at the top', () => {
    const pal = themeById('pumpkin').scene;
    const top = new Color(pal.skyTop);
    const horizon = new Color(pal.skyHorizon);
    expect(top.b).toBeGreaterThan(top.r);
    expect(top.b).toBeGreaterThan(top.g);
    expect(horizon.r).toBeGreaterThan(horizon.b * 3);
  });
  it('is a crisp pale gold harvest moon with no halo', () => {
    expect(spec.moon.crisp).toBe(true);
    const pal = themeById('pumpkin').scene;
    const [r, g, b] = pal.moonLight;
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(g / r).toBeGreaterThan(0.65);
    expect(pal.moonDark[0]).toBeGreaterThan(0.4);
  });
});

describe('the budget of the lane', () => {
  it('fits in the triangles the plan counts', () => {
    const tris =
      trianglesOf(buildTreeWood(tree)) + trianglesOf(buildTreeLeaves([...tree.clusters, ...tree.cornerClusters])) + trianglesOf(buildGhostKid()) +
      trianglesOf(buildWitchKid()) + trianglesOf(buildDryStalk()) * plan.stalks.length + trianglesOf(buildFence(plan.fence)) +
      trianglesOf(buildBanks(plan.line)) + trianglesOf(buildTuft()) * plan.tufts.length + trianglesOf(buildFlatLeaf()) * plan.leaves.length + 2 * plan.patches.length;
    expect(tris).toBeLessThanOrEqual(PUMPKIN_PARTS.autumnTris);
    expect(spec.extras.tris).toBeGreaterThanOrEqual(PUMPKIN_PARTS.autumnTris);
  });
  it('keeps the lane out of the barn and the moon', () => {
    const cam = cameraAt(0, 16 / 9, true);
    for (const s of plan.stalks) expect(project([s.x, 3, s.z], cam)).not.toBeNull();
    expect(MODELS.farm_barn).toBeDefined();
  });
});

describe('the fixes', () => {
  it('splits the windmill sails without the door, steps and posts at the foot (no loose debris turning in the sky)', async () => {
    const gltf = await loadGlbGeometry('quaternius/farm_windmill.glb');
    gltf.scene.updateMatrixWorld(true);
    let mesh: Mesh | undefined;
    gltf.scene.traverse((o) => {
      if ((o as Mesh).isMesh) mesh = o as Mesh;
    });
    const pos = worldPositions(mesh!);
    const { blades } = splitBlades(pos, cornerIndices(mesh!.geometry));
    for (const i of blades) {
      expect(pos[i * 3 + 1]!).toBeGreaterThan(0.2);
      expect(Math.hypot(pos[i * 3]! - SAIL_CENTRE.x, pos[i * 3 + 1]! - SAIL_CENTRE.y)).toBeLessThan(SAIL_RADIUS + 0.1);
    }
  });
  it('shades the farm pumpkin smooth, with darker ribs and no flat checker facets', async () => {
    const gltf = await loadGlbGeometry('quaternius/farm_pumpkin.glb');
    const parts = collectParts(gltf.scene);
    const body = parts.find((p) => (p.material as MeshStandardMaterial).name === 'Orange')!;
    const { parts: out, owned } = shadePumpkin(parts);
    const shaded = out.find((p) => p.material !== body.material && (p.material as MeshStandardMaterial).vertexColors)!;
    expect(shaded).toBeDefined();
    // Welded: far fewer corners than the file's flat triangles, so the normals are smooth.
    expect(shaded.geometry.getAttribute('position').count).toBeLessThan(body.geometry.getAttribute('position').count / 2);
    const col = shaded.geometry.getAttribute('color');
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < col.count; i++) {
      lo = Math.min(lo, col.getX(i));
      hi = Math.max(hi, col.getX(i));
      // Always orange: red over green over blue.
      expect(col.getX(i)).toBeGreaterThan(col.getY(i));
      expect(col.getY(i)).toBeGreaterThan(col.getZ(i));
    }
    expect(hi - lo).toBeGreaterThan(0.15);
    // The file's material is not changed.
    expect((body.material as MeshStandardMaterial).vertexColors).toBe(false);
    for (const m of owned.materials) m.dispose();
  });
});
