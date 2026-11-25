// The Frozen Cemetery, a simple clear scene (see `frostPlan.ts` for the three layers): a ruined chapel on the right, a round frozen pond on
// the left, a snowy path with lanterns and neat rows of tombstones, one big pine and a bare tree in the foreground corners. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { AURORA_TRIS } from '../aurora';
import { type ModelId, type Placement } from '../layout';
import { WEATHER } from '../weather';
import { ICICLE_TRIS, LAKE_SEGMENTS, MOUND_TRIS, moundSet } from './frostIce';
import { PATH_HALF_WIDTH, PINE_SPOT, TREE_SPOT, attachToPlacements, buildFrostPlan, LANTERN_POST } from './frostPlan';
import { distToPath as distToPathOf, Placer, modelsOf, type UniqueMoon, type UniqueSceneSpec } from './types';
/** Added to the caller's seed, so this theme has its own random stream. */
export const FROST_SEED = 7321;

/** A cold silver-white moon in the open sky at the upper right, right of the search box and below the header buttons. Crisp: sharp patches and a firm edge. */
export const FROST_MOON: UniqueMoon = {
  target: () => ({ x: 0.85, y: 0.27 }),
  scale: 1.05,
  crisp: true,
};
/** The icy blue the ghosts are tinted (the shared Ghosts layer reads it from the spec). */
export const FROST_GHOST_TINT = '#9fd8ff';
/** Draw calls of the parts the scene draws itself, counted from the real scene by `tests/ui/themeSceneRoot.test.tsx` (a mesh that casts a shadow counts twice). */
export const FROST_PARTS = {
  groundTris: 2,
  lakeTris: LAKE_SEGMENTS,
  calls: 46,
  /** Triangles of everything the scene draws itself, apart from the aurora, the pond, the icicles, the drifts and the ground. */
  partsTris: 30_000,
};
/** Triangles of the placements (shadow pass counted). */
export const FROST_TRI_LIMIT = 60_000;
/** How far below y = 0 the lowest point of each model is in its file (per unit of scale): each is lifted by this much, so it stands on the snow. */
export const FOOT: Partial<Record<ModelId, number>> = { frost_pine_a: 0.2351, tree_dead_large: 0.2722 };
const lift = (model: ModelId, scale: number): number => (FOOT[model] ?? 0) * scale + 0.004;
/** The look of the bare tree: near-black with a frosty blue edge (the scene passes it to the model batch). */
export const FROST_TREE_LOOK = { color: '#5d7396', emissive: '#16305a', emissiveIntensity: 0.5 } as const;
/** Soft bloom for this theme: only HDR glows (the pond, the chapel door) bloom; lit snow and lanterns never reach the threshold. */
export const FROST_BLOOM = { threshold: 1.2, intensity: 0.55 } as const;
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
  const placements: Placement[] = placer.placements;
  const attached = attachToPlacements(placements, seed);
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
      { x: 9.5, y: 2.0, z: -15 },
      { x: -8, y: 2.0, z: -9 },
    ],
    weather: WEATHER.snow,
    layers: { clouds: false, witch: false, bats: 0, ghosts: true, mist: false, embers: false, ghostTint: FROST_GHOST_TINT },
    extras: {
      tris:
        FROST_PARTS.groundTris + FROST_PARTS.lakeTris + AURORA_TRIS + (plan.chapelIcicles.length + plan.stoneIcicles.length + attached.treeIcicles.length) * ICICLE_TRIS +
        (drifts.length + 1) * MOUND_TRIS + FROST_PARTS.partsTris,
      calls: FROST_PARTS.calls,
    },
    frost: { plan, attached, drifts, lanternSpots: lanterns },
    fogScale: 0.8,
  };
}
