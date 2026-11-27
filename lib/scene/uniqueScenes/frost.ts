// The Frozen Cemetery, a simple clear scene (see `frostPlan.ts` for the three layers): a haunted snow-covered house right of the middle, a
// round frozen pond on the left, a snowy path with hanging lanterns and a few tombstones, one big pine and a bare tree in the foreground
// corners, all in a cold wind. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { AURORA_TRIS } from '../aurora';
import { MODELS, type ModelId, type Placement } from '../layout';
import { WEATHER } from '../weather';
import { ICICLE_TRIS, LAKE_SEGMENTS, MOUND_TRIS, moundSet } from './frostIce';
import { buildFill } from './fill';
import { FROST_MOON_SCALE, PATH_HALF_WIDTH, PINE_SPOT, TREE_SPOT, attachToPlacements, buildFrostPlan, frostMoonTarget, LANTERN_POST } from './frostPlan';
import { distToPath as distToPathOf, Placer, VIEW_ASPECTS, modelsOf, viewOf, type UniqueMoon, type UniqueSceneSpec } from './types';
/** Added to the caller's seed, so this theme has its own random stream. */
export const FROST_SEED = 7321;

/**
 * A cold silver-white moon in the open sky at the upper right, right of the search box and below the header buttons, a little in from
 * the right edge. Nothing stands over it: no pine of the backdrop, no house, no ghost. Crisp: sharp patches and a firm edge.
 */
export const FROST_MOON: UniqueMoon = {
  target: frostMoonTarget,
  scale: FROST_MOON_SCALE,
  crisp: true,
};
/** The icy blue the ghosts are tinted (the shared Ghosts layer reads it from the spec). */
export const FROST_GHOST_TINT = '#9fd8ff';
/** Draw calls of the parts the scene draws itself, counted from the real scene by `tests/ui/themeSceneRoot.test.tsx` (a mesh that casts a shadow counts twice). */
export const FROST_PARTS = {
  groundTris: 2,
  lakeTris: LAKE_SEGMENTS,
  calls: 66,
  /** Triangles of everything the scene draws itself, apart from the aurora, the pond, the icicles, the drifts and the ground. */
  partsTris: 42_000,
};
/** Triangles of one light snowy cluster pine (shadow pass counted): checked against the real geometry by the scene test. */
export const SNOW_PINE_TRIS = 460;
/** Triangles of the placements (shadow pass counted). */
export const FROST_TRI_LIMIT = 60_000;
/** How far below y = 0 the lowest point of each model is in its file (per unit of scale): each is lifted by this much, so it stands on the snow. */
export const FOOT: Partial<Record<ModelId, number>> = { frost_pine_a: 0.2351, tree_dead_large: 0.2722 };
const lift = (model: ModelId, scale: number): number => (FOOT[model] ?? 0) * scale + 0.004;
/** The look of the bare tree: near-black with a frosty blue edge (the scene passes it to the model batch). */
export const FROST_TREE_LOOK = { color: '#5d7396', emissive: '#16305a', emissiveIntensity: 0.5 } as const;
/** Soft bloom for this theme: only HDR glows (the pond, the house windows) bloom; lit snow and lanterns never reach the threshold. */
export const FROST_BLOOM = { threshold: 1.2, intensity: 0.55 } as const;
/** Clusters of extra pines: middle (x, z), how many, and the range of their scale (the pine is 10 tall at scale 1). */
export const PINE_CLUSTERS: readonly (readonly [number, number, number, number, number])[] = [
  [-17, -9, 3, 0.3, 0.5], [-24, -17, 3, 0.35, 0.55], [-27, -30, 3, 0.4, 0.6], [-6.5, -34, 2, 0.18, 0.26],
  [15, -8.5, 2, 0.2, 0.3], [19, -17, 3, 0.2, 0.32], [13.5, -33, 3, 0.14, 0.22], [17.5, -2, 2, 0.25, 0.4], [24, -27, 3, 0.2, 0.32],
];
/** Extra bare twisted trees (with frost and icicles): spot and scale (the tree is 4.8 tall at scale 1). */
export const DEAD_TREES: readonly (readonly [number, number, number])[] = [
  [-12.5, -12, 0.75], [-21, -6, 0.65], [9.8, -6.5, 0.5], [-6.5, -31, 0.55], [17, -25, 0.55], [14.5, -14.5, 0.45],
];
/**
 * True when a tall prop's top keeps clear of the page's controls at every usual window shape: below the chips in the middle, and
 * under the header at the sides (the moon is checked by the placer).
 */
export function clearOfUi(p: Placement): boolean {
  return VIEW_ASPECTS.every((a) => {
    const v = viewOf(p, a);
    if (!v) return false;
    if (v.top < 0.19) return false;
    const middle = v.right > 0.24 && v.left < 0.76;
    return !middle || v.top > 0.4;
  });
}
const same = (c: { x: number; z: number }, s: { x: number; z: number }) => Math.abs(c.x - s.x) < 0.01 && Math.abs(c.z - s.z) < 0.01;
export function buildFrozenCemetery(seed: number): UniqueSceneSpec {
  const plan = buildFrostPlan(seed);
  const placer = new Placer({ id: 'frost', seed: FROST_SEED + seed, moon: FROST_MOON, path: { centre: plan.path, halfWidth: PATH_HALF_WIDTH } });
  // The foreground corners and the far pine are fixed; the claims of the plan keep everything else clear.
  const reserved = plan.claims.filter((c) => !same(c, PINE_SPOT) && !same(c, TREE_SPOT));
  for (const c of reserved) placer.reserve(c);
  // The focal pine far away at the horizon, left of the middle (small, below the chips).
  const far = placer.fixed(placer.make('frost_pine_a', 'centre', -9, -37.5, 0.4, 0.45, lift('frost_pine_a', 0.45)), { margin: 0.2 }, true);
  // One big snow-covered pine in the left corner.
  placer.fixed(placer.make('frost_pine_a', 'themed', PINE_SPOT.x, PINE_SPOT.z, 1.1, PINE_SPOT.scale, lift('frost_pine_a', PINE_SPOT.scale)), { margin: 0.2 });
  // One bare black frosty tree in the right corner (the first spot where it fits in the open sky).
  let tree: Placement | null = null;
  for (const [x, z, scale] of [[TREE_SPOT.x, TREE_SPOT.z, TREE_SPOT.scale], [6, -3, 0.7], [5, -1, 0.7], [7, -5, 0.7]] as const) {
    tree = placer.tryAdd(placer.make('tree_dead_large', 'themed', x, z, 0, scale, lift('tree_dead_large', scale)), { margin: 0.2 });
    if (tree) break;
  }
  if (!tree) throw new Error('The bare tree of the Frozen Cemetery does not fit');
  // Clusters of tall snowy pines and a few bare twisted trees on the empty snow, both sides, each cluster a few trees of different
  // heights. A tree only goes in where its top stays clear of the header, the search box, the pinned pages and the chips.
  const tall = (model: ModelId, x: number, z: number, scale: number): Placement | null => {
    const p = placer.make(model, 'themed', x, z, placer.between(0, Math.PI * 2), scale, lift(model, scale));
    if (!clearOfUi(p)) return null;
    return placer.tryAdd(p, { margin: 0.25 });
  };
  // The cluster pines are drawn as light low-poly snowy pines (about 200 triangles each, instead of the 3,164 of the model file), so a
  // whole forest of them stays inside the triangle budget. They are placed with the model's size, so every check still holds.
  const extraPines = new Set<Placement>();
  for (const [cx, cz, n, lo, hi] of PINE_CLUSTERS) {
    for (let k = 0, put = 0; k < n * 6 && put < n; k++) {
      const a = placer.between(0, Math.PI * 2);
      const r = placer.between(0, 2.6);
      const pine = tall('frost_pine_a', cx + Math.cos(a) * r, cz + Math.sin(a) * r, placer.between(lo, hi));
      if (pine) {
        extraPines.add(pine);
        put++;
      }
    }
  }
  for (const [x, z, scale] of DEAD_TREES) {
    for (let k = 0; k < 6; k++) if (tall('tree_dead_large', x + (k ? placer.between(-1.5, 1.5) : 0), z + (k ? placer.between(-1.5, 1.5) : 0), scale)) break;
  }
  const pines = [...extraPines].map((p) => ({ x: p.x, z: p.z, rotY: p.rotY, height: MODELS.frost_pine_a.h * p.scale }));
  const solid: Placement[] = placer.placements;
  const placements: Placement[] = solid.filter((p) => !extraPines.has(p));
  const attached = attachToPlacements(placements, seed, plan.stones);
  const lanterns = plan.lanterns.map((l) => ({ kind: 'lantern' as const, x: l.x, y: LANTERN_POST.flameY, z: l.z }));
  // The random mounds keep off the path, the middle behind the cards and everything the plan claims.
  const mounds = moundSet(
    FROST_SEED + seed + 2,
    (x, z, r) =>
      distToPathOf(plan.path, x, z) < PATH_HALF_WIDTH + r + 0.6 ||
      (z > -9 && Math.abs(x - 0.5) < 10) ||
      plan.claims.some((c) => Math.hypot(c.x - x, c.z - z) < r + Math.max(c.hx, c.hz) * 0.9) ||
      plan.stones.some((st) => Math.hypot(st.x - x, st.z - z) < r + 1.2),
    14,
  );
  const drifts = [...mounds, ...plan.drifts];
  return {
    id: 'frost',
    seed,
    centrepiece: { placement: far, ids: [far.id] },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'snow' },
    path: { kind: 'snow', centre: plan.path, halfWidth: PATH_HALF_WIDTH },
    moon: FROST_MOON,
    sky: ['aurora'],
    // No real point lights and no shared glow sprites: the lanterns carry their own small flame (a sprite that big would bloom into a white blob).
    lights: [],
    glows: [],
    anchors: [],
    // Two ghosts drift near the graves, in the open sky between the chips and the cards (never behind the header); the third shows when the data asks.
    ghostSpots: [
      { x: -2.5, y: 2.0, z: -12 },
      { x: 13.5, y: 2.0, z: -13 },
      { x: -8, y: 2.0, z: -9 },
    ],
    weather: WEATHER.snow,
    // The shared mist stays off: the scene draws its own thin, low mist that rolls with the wind. The ghosts drift with the wind.
    layers: { clouds: false, witch: false, bats: 0, ghosts: true, mist: false, embers: false, ghostTint: FROST_GHOST_TINT, ghostWind: 1 },
    extras: {
      tris:
        FROST_PARTS.groundTris + FROST_PARTS.lakeTris + AURORA_TRIS + (plan.houseIcicles.length + plan.stoneIcicles.length + attached.treeIcicles.length) * ICICLE_TRIS +
        (drifts.length + 1) * MOUND_TRIS + FROST_PARTS.partsTris + pines.length * SNOW_PINE_TRIS,
      calls: FROST_PARTS.calls,
    },
    frost: { plan, attached, drifts, lanternSpots: lanterns, pines },
    fill: buildFill({
      theme: 'frost',
      seed,
      // The cluster pines count as solid, so the fill keeps off them.
      placements: solid,
      keepOut: [
        ...placer.reserved,
        ...drifts.filter((d) => d.radius <= 2.5).map((d) => ({ x: d.x, z: d.z, hx: d.radius * 0.8 * (d.stretch ?? 1), hz: d.radius * 0.8, rotY: d.rotY })),
      ],
      path: { centre: plan.path, halfWidth: PATH_HALF_WIDTH },
      moon: FROST_MOON,
    }),
    // Little haze, so the house on the right and the pond on the left read clearly.
    fogScale: 0.45,
  };
}
