// The Frozen Cemetery: a snowy graveyard at night. A ruined chapel stands half-buried at the end of a snowy path, a frozen lake lies
// in the middle distance with bones under its ice and tilted gravestones stuck in it, and tilted tombstones, open graves, iron
// lanterns, ice pillars with frozen skeletons, a broken fence and bare dead trees fill the snow on both sides of the path. Frosted
// pines stand heavy at the sides, wolves watch from a far ridge, aurora ribbons wave in a deep navy sky, snow falls and the ghosts
// are icy blue. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { AURORA_TRIS } from '../aurora';
import { MODELS, type ModelId, type Placement } from '../layout';
import { WEATHER } from '../weather';
import { planTriangles } from './forest';
import {
  ICICLES_PER_STONE, ICICLE_TRIS, LAKE, LAKE_SEGMENTS, MAX_SINK, MOUND_TRIS, icicleSet, lakeDistance, moundSet, onLake,
} from './frostIce';
import { PATH_HALF_WIDTH, attachToPlacements, buildFrostPlan, LANTERN_POST } from './frostPlan';
import { distToPath, Placer, modelsOf, type UniqueMoon, type UniqueSceneSpec } from './types';
import type { WarmSource } from '../layout';
/** Added to the caller's seed, so this theme has its own random stream. */
export const FROST_SEED = 7321;

/** A cold silver-white moon in the open sky at the far right, clear of the stones and the pines. Crisp: sharp patches and a firm edge. */
export const FROST_MOON: UniqueMoon = {
  target: () => ({ x: 0.86, y: 0.22 }),
  scale: 1.05,
  crisp: true,
};
/** The icy blue the ghosts are tinted (the shared Ghosts layer reads it from the spec). */
export const FROST_GHOST_TINT = '#9fd8ff';
/**
 * The gravestones in the ice, each stuck at an angle and partly sunk. `sink` is how far its foot goes below the snow (at most `MAX_SINK`),
 * `tilt` is the lean about x and z. They stand in the back half of the lake, so the hands and the skull under the ice stay in view.
 */
export interface IceStone {
  model: Extract<ModelId, 'gravestone' | 'grave_B'>;
  x: number;
  z: number;
  rotY: number;
  scale: number;
  tilt: [number, number];
  sink: number;
}
/** The first stone is the centrepiece: tall, near the middle of the lake. */
export const ICE_STONES: readonly IceStone[] = [
  { model: 'grave_B', x: -4.0, z: -21.4, rotY: 0, scale: 2.6, tilt: [-0.1, 0.2], sink: 0.5 },
  { model: 'gravestone', x: -10.0, z: -20.4, rotY: 0.3, scale: 2.4, tilt: [0.1, -0.32], sink: 0.4 },
  { model: 'grave_B', x: 2.4, z: -20.6, rotY: 0, scale: 1.6, tilt: [-0.2, 0.28], sink: 0.55 },
  { model: 'gravestone', x: -8.4, z: -22.8, rotY: 0.2, scale: 2.0, tilt: [0.15, 0.22], sink: 0.3 },
  { model: 'gravestone', x: 0.4, z: -22.9, rotY: 0, scale: 1.6, tilt: [-0.25, -0.18], sink: 0.45 },
];
/** How many of the first stones form the centrepiece. */
export const CENTRE_STONES = 3;
/** Models of the stones in the ice. They are the only Crypt gravestones this theme uses, and only these. */
export const ICE_STONE_MODELS: readonly ModelId[] = ['gravestone', 'grave_B'];
/**
 * Draw calls of the parts the scene draws itself, counted by `tests/ui/themeSceneRoot.test.tsx` from the real scene (a mesh that casts a
 * shadow counts twice): 42 meshes, 17 of them in the shadow pass as well, the aurora included. Instancing keeps every repeat to one call.
 */
export const FROST_PARTS = {
  groundTris: 2,
  lakeTris: LAKE_SEGMENTS,
  icicleTris: ICE_STONES.length * ICICLES_PER_STONE * ICICLE_TRIS,
  calls: 59,
  /** Triangles of everything the scene draws itself, apart from the aurora, the lake and the ground (the real counts are checked in `tests/ui/themeSceneRoot.test.tsx`). */
  partsTris: 30_000,
};
/** Triangles of the placements (shadow pass counted) the scene may reach; its own parts and the snow add under 40,000. */
export const FROST_TRI_LIMIT = 150_000;
const PINE_LIMIT = 118_000;
/** How far below y = 0 the lowest point of each model is in its file (per unit of scale): each is lifted by this much, so it stands on the snow. */
export const FOOT: Partial<Record<ModelId, number>> = { frost_rock: 0.0509, frost_pine_a: 0.2351, frost_pine_b: 0.2351, frost_pines: 0.0039, tree_dead_large: 0.2722 };
const lift = (model: ModelId, scale: number): number => (FOOT[model] ?? 0) * scale + 0.004;
/** The middle of the yard, where the camera looks: the rows of pines are laid out about it. */
const CX = 0.5;
type Pine = 'frost_pine_a' | 'frost_pine_b';
/** The look of the bare dead trees: near-black, frosted blue (the scene passes it to the model batch). */
export const FROST_TREE_LOOK = { color: '#6f86a8', emissive: '#16305a', emissiveIntensity: 0.55 } as const;
export function buildFrozenCemetery(seed: number): UniqueSceneSpec {
  const plan = buildFrostPlan(seed);
  const placer = new Placer({ id: 'frost', seed: FROST_SEED + seed, moon: FROST_MOON, path: { centre: plan.path, halfWidth: PATH_HALF_WIDTH } });
  const { between, rng } = placer;
  for (const c of plan.claims) placer.reserve(c);
  const sunk: Record<string, number> = {};
  // ----- the gravestones in the ice -----
  const stones: Placement[] = ICE_STONES.map((s, i) => {
    const p = placer.fixed(
      { ...placer.make(s.model, i < CENTRE_STONES ? 'centre' : 'themed', s.x, s.z, s.rotY, s.scale, -s.sink), tilt: s.tilt },
      { margin: 0.3 },
      i === 0,
    );
    if (s.sink > MAX_SINK) throw new Error(`Ice stone ${p.id} sinks ${s.sink}, more than ${MAX_SINK}`);
    if (lakeDistance(p.x, p.z) >= 0.9) throw new Error(`Ice stone ${p.id} is not in the ice`);
    sunk[p.id] = s.sink;
    return p;
  });
  const centre = stones.slice(0, CENTRE_STONES);
  // Whatever stands on the shore must stay off the ice, and off the open middle of the view behind the lake.
  const offLake = (x: number, z: number, reach: number) => !onLake(x, z, reach + 1.0);
  const clearOfBackCentre = (x: number, z: number, reach: number) => z > -22 || Math.abs(x - CX) > 12 + reach;
  // ----- bare dead trees, tinted frosty, on both sides (a lantern and crows hang from their branches) -----
  const dead = (x: number, z: number, scale: number) => ({ x, z, scale, y: lift('tree_dead_large', scale), rotY: between(-0.5, 0.5) });
  for (const side of [-1, 1]) {
    placer.scatter(
      'tree_dead_large', 'themed', 3,
      () => {
        const scale = between(1.2, 1.6);
        const x = CX + side * between(14, 22);
        const z = between(-18, -3);
        return offLake(x, z, 1.4 * scale) ? dead(x, z, scale) : dead(40, z, scale);
      },
      { margin: 0.3 },
      60,
    );
  }
  // ----- smaller ice boulders along the shore of the lake (their snow caps are drawn by the scene) -----
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + between(-0.2, 0.2);
    // The side of the shore nearest the camera is kept open, so the ice shows between the cards and the pines.
    if (Math.sin(a) > 0.5) continue;
    const scale = between(0.7, 1.2);
    const reach = MODELS.frost_rock.hx * scale;
    const gap = 1.8 + reach;
    placer.tryAdd(placer.make('frost_rock', 'themed', LAKE.x + (LAKE.rx + gap) * Math.cos(a), LAKE.z + (LAKE.rz + gap) * Math.sin(a), between(0, Math.PI * 2), scale, lift('frost_rock', scale)), { margin: 0.2 });
  }
  // ----- the pines, heavy on both sides (first, then clusters and boulders fill the gaps) -----
  let used = planTriangles(placer.placements);
  const addPine = (x: number, z: number, model: Pine | 'frost_pines'): boolean => {
    const scale = model === 'frost_pines' ? between(3.2, 4.8) : between(0.5, 0.8);
    const reach = Math.max(MODELS[model].hx, MODELS[model].hz) * scale;
    if (!offLake(x, z, reach) || !clearOfBackCentre(x, z, reach)) return false;
    if (used + MODELS[model].tris * (MODELS[model].shadow ? 2 : 1) > PINE_LIMIT) return false;
    const p = placer.tryAdd(placer.make(model, 'themed', x, z, between(0, Math.PI * 2), scale, lift(model, scale)), { margin: 0.1 });
    if (p) used += MODELS[model].tris * (MODELS[model].shadow ? 2 : 1);
    return p !== null;
  };
  // Small pine groves first, at both sides; the big pines then fill the gaps between them.
  for (let n = 0; n < 8; n++) {
    for (let t = 0; t < 60; t++) if (addPine(CX + (n % 2 ? 1 : -1) * between(11, 25), between(-30, -2), 'frost_pines')) break;
  }
  const pick = (): Pine => (rng() < 0.55 ? 'frost_pine_a' : 'frost_pine_b');
  // Close rows at both sides from the front to the back, then an outer row, then the back corners.
  for (const side of [-1, 1] as const) {
    for (let z = 4; z > -34; z -= 3.1) {
      for (let t = 0; t < 30 && !addPine(CX + side * between(9.5, 16), z + between(-1, 1), pick()); t++);
    }
    for (let z = 2; z > -34; z -= 4.3) {
      for (let t = 0; t < 30 && !addPine(CX + side * between(16, 28), z + between(-1.5, 1.5), pick()); t++);
    }
  }
  for (let n = 0; n < 500; n++) addPine(CX + (rng() < 0.5 ? -1 : 1) * between(8, 29), between(-34, 3), pick());
  // ----- small ice boulders in the snow (a few close to the camera at the sides) -----
  const rock = (x: number, z: number, scale: number) => ({ x, z, scale, y: lift('frost_rock', scale) });
  placer.scatter(
    'frost_rock', 'themed', 8,
    () => {
      const scale = between(0.6, 1.1);
      const x = CX + (rng() < 0.5 ? -1 : 1) * between(7, 26);
      const z = between(-32, 2);
      return rock(offLake(x, z, MODELS.frost_rock.hx * scale) && clearOfBackCentre(x, z, MODELS.frost_rock.hx * scale) ? x : 40, z, scale);
    },
    { margin: 0.15 },
    40,
  );
  for (const side of [-1, 1]) {
    placer.scatter('frost_rock', 'themed', 2, () => rock(CX + side * between(3.5, 6.5), between(3.6, 7), between(0.4, 0.65)), { margin: 0.15 }, 40);
  }
  const placements: Placement[] = placer.placements;
  const attached = attachToPlacements(placements, seed);
  // ----- lights: four warm iron lanterns along the path; candles on some stones -----
  const lanterns: WarmSource[] = plan.lanterns.map((l) => ({ kind: 'lantern', x: l.x, y: LANTERN_POST.flameY, z: l.z }));
  const candles: WarmSource[] = plan.candles.map((c) => ({ kind: 'candle', x: c.x, y: 0.34, z: c.z, size: 0.45 }));
  const icicles = icicleSet(stones, FROST_SEED + seed + 1);
  const blockedByStone = (x: number, z: number, r: number) =>
    stones.some((s) => Math.hypot(s.x - x, s.z - z) < r + Math.max(MODELS[s.model].hx, MODELS[s.model].hz) * s.scale + 0.5) ||
    distToPath(plan.path, x, z) < PATH_HALF_WIDTH + r + 0.4 ||
    plan.claims.some((c) => Math.hypot(c.x - x, c.z - z) < r + Math.max(c.hx, c.hz) * 0.8) ||
    plan.stones.some((st) => Math.hypot(st.x - x, st.z - z) < r + 1.2) ||
    plan.hands.some((h) => Math.hypot(h.x - x, h.z - z) < r + 2);
  const mounds = moundSet(FROST_SEED + seed + 2, blockedByStone);
  const partIcicles = plan.chapelIcicles.length + attached.treeIcicles.length;
  return {
    id: 'frost',
    seed,
    centrepiece: { placement: stones[0]!, ids: centre.map((s) => s.id) },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'snow' },
    path: { kind: 'snow', centre: plan.path, halfWidth: PATH_HALF_WIDTH },
    moon: FROST_MOON,
    sky: ['aurora'],
    lights: lanterns,
    glows: [...lanterns, ...candles],
    anchors: [],
    // Two ghosts over the ice and the graves and one by the pines on the left, in the open.
    ghostSpots: [
      { x: -6.5, y: 3.3, z: -12.5 },
      { x: 7.4, y: 3.7, z: -13.0 },
      { x: -15.5, y: 3.5, z: -17 },
    ],
    weather: WEATHER.snow,
    layers: { clouds: true, witch: true, bats: 0.6, ghosts: true, mist: true, embers: true, ghostTint: FROST_GHOST_TINT },
    // Everything the scene draws itself: see `FROST_PARTS`.
    extras: {
      tris: FROST_PARTS.groundTris + FROST_PARTS.lakeTris + (icicles.length + partIcicles) * ICICLE_TRIS + (mounds.length + plan.drifts.length + 1) * MOUND_TRIS + AURORA_TRIS + FROST_PARTS.partsTris,
      calls: FROST_PARTS.calls,
    },
    sunk,
    ice: { stones: stones.map((s) => s.id), icicles, mounds },
    frost: { plan, attached },
    fogScale: 0.55,
  };
}
