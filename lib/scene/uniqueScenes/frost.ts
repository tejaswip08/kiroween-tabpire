// The Frozen Cemetery: a snowy graveyard at night. A frozen lake lies in the middle distance, with a few tilted gravestones
// stuck in the ice and icicles under their tops. Frosted pines stand heavy on both sides, ice boulders and snow mounds lie
// about, faint aurora bands move in a dark navy sky, snow falls and the ghosts are icy blue. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { AURORA_CALLS, AURORA_TRIS } from '../aurora';
import { MODELS, type ModelId, type Placement } from '../layout';
import { WEATHER } from '../weather';
import { planTriangles } from './forest';
import {
  ICICLES_PER_STONE, ICICLE_TRIS, LAKE, LAKE_SEGMENTS, MAX_SINK, MOUND_TRIS, icicleSet, lakeDistance, moundSet, onLake,
} from './frostIce';
import { Placer, modelsOf, type UniqueMoon, type UniqueSceneSpec } from './types';

/** Added to the caller's seed, so this theme has its own random stream. */
export const FROST_SEED = 7321;

/** A cold silver-white moon in the open sky at the far right, clear of the stones and the pines, a little bigger than the Crypt's. */
export const FROST_MOON: UniqueMoon = {
  target: () => ({ x: 0.86, y: 0.22 }),
  scale: 1.05,
};
/** The icy blue the ghosts are tinted (the shared Ghosts layer reads it from the spec). */
export const FROST_GHOST_TINT = '#9fd8ff';

/**
 * The gravestones in the ice, each stuck at an angle and partly sunk. `sink` is how far its foot goes below the ice (at most `MAX_SINK`),
 * `tilt` is the lean about x and z. Only two kinds are used, so the prop set stays distinct from the other themes.
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
  { model: 'grave_B', x: 0.5, z: -19.8, rotY: 0, scale: 3.1, tilt: [-0.1, 0.2], sink: 0.5 },
  { model: 'gravestone', x: -6.0, z: -17.6, rotY: 0.3, scale: 2.7, tilt: [0.1, -0.32], sink: 0.4 },
  { model: 'grave_B', x: 6.6, z: -17.4, rotY: -0.4, scale: 2.0, tilt: [-0.2, 0.28], sink: 0.55 },
  { model: 'gravestone', x: -3.4, z: -23.4, rotY: 0.2, scale: 2.3, tilt: [0.15, 0.22], sink: 0.3 },
  { model: 'gravestone', x: 4.6, z: -23.6, rotY: -0.2, scale: 2.6, tilt: [-0.25, -0.18], sink: 0.45 },
  { model: 'grave_B', x: -8.6, z: -21.4, rotY: 0.6, scale: 1.9, tilt: [0.05, 0.35], sink: 0.5 },
  { model: 'gravestone', x: 8.6, z: -22.2, rotY: 0.1, scale: 2.1, tilt: [0.2, -0.25], sink: 0.35 },
  { model: 'gravestone', x: -0.4, z: -15.4, rotY: -0.15, scale: 1.9, tilt: [0.12, 0.18], sink: 0.3 },
];
/** How many of the first stones form the centrepiece. */
export const CENTRE_STONES = 3;
/** Models of the stones in the ice. They are the only Crypt gravestones this theme uses, and only these. */
export const ICE_STONE_MODELS: readonly ModelId[] = ['gravestone', 'grave_B'];

/** The upper bounds of the parts the scene draws itself, for the budget test (`tests/frost.test.ts` checks the real shapes). */
export const FROST_PARTS = {
  groundTris: 2,
  lakeTris: LAKE_SEGMENTS,
  icicleTris: ICE_STONES.length * ICICLES_PER_STONE * ICICLE_TRIS,
  /** Ground, lake, icicles, mounds, aurora. */
  calls: 4 + AURORA_CALLS,
};
/** Triangles of the placements (shadow pass counted) the scene may reach; its own parts and the snow add under 3,000. */
export const FROST_TRI_LIMIT = 150_000;
const PINE_LIMIT = 128_000;

/** How far below y = 0 the lowest point of each model is in its file (per unit of scale): each is lifted by this much, so it stands on the snow. */
export const FOOT: Partial<Record<ModelId, number>> = { frost_rock: 0.0509, frost_pine_a: 0.2351, frost_pine_b: 0.2351, frost_pines: 0.0039 };
const lift = (model: ModelId, scale: number): number => (FOOT[model] ?? 0) * scale + 0.004;

type Pine = 'frost_pine_a' | 'frost_pine_b';
export function buildFrozenCemetery(seed: number): UniqueSceneSpec {
  const placer = new Placer({ id: 'frost', seed: FROST_SEED + seed, moon: FROST_MOON, path: { centre: [], halfWidth: 0 } });
  const { between, rng } = placer;
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
  const blockedByStone = (x: number, z: number, r: number) => stones.some((s) => Math.hypot(s.x - x, s.z - z) < r + Math.max(MODELS[s.model].hx, MODELS[s.model].hz) * s.scale + 0.5);

  // Whatever stands on the shore must stay off the ice, and off the open centre of the view behind the lake.
  const offLake = (x: number, z: number, reach: number) => !onLake(x, z, reach + 0.6);
  const clearOfBackCentre = (x: number, z: number, reach: number) => z > -27 || Math.abs(x - LAKE.x) > 9 + reach;

  // ----- ice boulders along the shore -----
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + between(-0.2, 0.2);
    // The side of the shore nearest the camera is kept open, so the ice shows between the cards and the pines.
    if (Math.sin(a) > 0.55) continue;
    const scale = between(1.5, 2.4);
    const reach = MODELS.frost_rock.hx * scale;
    const gap = 1.2 + reach;
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
    for (let t = 0; t < 60; t++) if (addPine(LAKE.x + (n % 2 ? 1 : -1) * between(11, 25), between(-30, -2), 'frost_pines')) break;
  }
  const pick = (): Pine => (rng() < 0.55 ? 'frost_pine_a' : 'frost_pine_b');
  // Close rows at both sides from the front to the back, then an outer row, then the back corners.
  for (const side of [-1, 1] as const) {
    for (let z = 4; z > -34; z -= 3.1) {
      for (let t = 0; t < 30 && !addPine(LAKE.x + side * between(8.5, 15), z + between(-1, 1), pick()); t++);
    }
    for (let z = 2; z > -34; z -= 4.3) {
      for (let t = 0; t < 30 && !addPine(LAKE.x + side * between(15, 28), z + between(-1.5, 1.5), pick()); t++);
    }
  }
  for (let n = 0; n < 200; n++) addPine(LAKE.x + (rng() < 0.5 ? -1 : 1) * between(8, 29), between(-34, 3), pick());

  // ----- ice boulders in the snow, a few of them close to the camera at the sides -----
  const rock = (x: number, z: number, scale: number) => ({ x, z, scale, y: lift('frost_rock', scale) });
  placer.scatter(
    'frost_rock', 'themed', 8,
    () => {
      const scale = between(1.3, 2.3);
      const x = LAKE.x + (rng() < 0.5 ? -1 : 1) * between(7, 26);
      const z = between(-32, 2);
      return rock(offLake(x, z, MODELS.frost_rock.hx * scale) && clearOfBackCentre(x, z, MODELS.frost_rock.hx * scale) ? x : 40, z, scale);
    },
    { margin: 0.15 },
    40,
  );
  for (const side of [-1, 1]) {
    placer.scatter('frost_rock', 'themed', 2, () => {
      const scale = between(0.5, 0.8);
      return rock(LAKE.x + side * between(3, 5.5), between(3.6, 7), scale);
    }, { margin: 0.15 }, 40);
  }

  const placements: Placement[] = placer.placements;
  const icicles = icicleSet(stones, FROST_SEED + seed + 1);
  const mounds = moundSet(FROST_SEED + seed + 2, blockedByStone);
  return {
    id: 'frost',
    seed,
    centrepiece: { placement: stones[0]!, ids: centre.map((s) => s.id) },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'snow' },
    path: { kind: 'none', centre: [], halfWidth: 0 },
    moon: FROST_MOON,
    sky: ['aurora'],
    lights: [],
    glows: [],
    anchors: [],
    // Two ghosts over the ice and one by the pines on the left, in the open.
    ghostSpots: [
      { x: -5.5, y: 3.3, z: -13.5 },
      { x: 6.8, y: 3.9, z: -15.5 },
      { x: -14.5, y: 3.5, z: -21 },
    ],
    weather: WEATHER.snow,
    layers: { clouds: true, witch: true, bats: 0.6, ghosts: true, mist: true, embers: true, ghostTint: FROST_GHOST_TINT },
    // Ground, lake, icicles, snow mounds and the aurora dome, drawn by the scene itself.
    extras: {
      tris: FROST_PARTS.groundTris + FROST_PARTS.lakeTris + icicles.length * ICICLE_TRIS + mounds.length * MOUND_TRIS + AURORA_TRIS,
      calls: FROST_PARTS.calls,
    },
    sunk,
    ice: { stones: stones.map((s) => s.id), icicles, mounds },
    fogScale: 1,
  };
}
