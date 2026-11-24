// The Pumpkin Patch: a farm at dusk. The barn is the centrepiece, with the silo and the windmill behind it, corn on
// both sides like a field, hay bales, a fence along a dirt track, dozens of pumpkins, a few jack-o'-lanterns and a
// scarecrow. Pure and seeded. Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { MODELS, type Footprint, type ModelId, type Placement, type WarmSource } from '../layout';
import { WINDMILL_FOOT } from '../windmill';
import { WEATHER } from '../weather';
import { LANE, LANE_Z, MOON_SCALE, TREE_FOOTPRINT, bankHeight, buildAutumnPlan, buildTreeVariant, moonSpot, sideOf, smoothPolyline, type TreeSpot } from './autumn';
import { HILL, HOUSE } from './house';
import { skeletonFootprints } from './skeletons';
import { Placer, modelsOf, sampleLine, type UniqueMoon, type UniqueSceneSpec } from './types';

/** Added to the caller's seed, so this theme has its own random stream. */
export const PUMPKIN_SEED = 7101;

/** A pale gold harvest moon in the clear sky on the right, beside the windmill, its whole disc above the horizon. */
export const PUMPKIN_MOON: UniqueMoon = {
  target: moonSpot,
  scale: MOON_SCALE,
  crisp: true,
};

/** The winding dirt trail from the bottom of the screen to the barn door (a smooth curve through these points). */
const TRACK: [number, number][] = [[2.0, 14], [0.3, 9], [1.0, 3.5], [-0.9, -1.5], [-1.4, -7.5], [-3.0, -12.5], [-3.6, -17.4]];
const TRACK_HALF_WIDTH = 1.3;
/** Props keep this far from the trail's centre line: the lane (jack-o'-lanterns, fence and dry corn) is theirs. */
const LANE_KEEP = 4.6;

/** The barn faces the camera; the silo stands behind it on the left, and the windmill on the right, turned toward the camera. */
export const BARN = { x: -3.8, z: -23, rotY: 0.1, scale: 1.25 };
export const SILO = { x: -13, z: -27.5, rotY: 0, scale: 1.1 };
export const WINDMILL = { x: 14, z: -30, rotY: -0.28, scale: 5 };
/** The scarecrow (drawn by `ScarecrowShape`): standing guard in the pumpkin patch on the right. */
export const SCARECROW = { x: 7.4, z: 1.2, rotY: -0.35, scale: 1, hx: 0.9, hz: 0.9, h: 3.3 };

/**
 * Four more autumn trees, each its own size and turn: one beside the haunted house (left of its hill, between the windmill and
 * the moon), one at the far right edge behind the house, and two small ones in the distance behind the corn field, on the left. Each keeps clear
 * of the moon, the cards, the controls and the barn (`tests/house.test.ts`).
 */
export const EXTRA_TREE_SPOTS: readonly TreeSpot[] = [
  { x: 19.5, z: -28, scale: 0.58, rotY: 2.4, seed: 4201, clusters: 40 },
  { x: 31, z: -27, scale: 1.05, rotY: 0.9, seed: 4202, clusters: 64 },
  { x: -25.5, z: -46, scale: 0.6, rotY: 4.1, seed: 4203, clusters: 36 },
  { x: -31, z: -49, scale: 0.42, rotY: 5.3, seed: 4204, clusters: 30 },
];
/** Upper bounds for the parts the scene draws itself, for the budget test (`tests/uniqueScenes.test.ts` checks the real shapes). */
export const PUMPKIN_PARTS = {
  scarecrowTris: 320,
  groundTris: 2,
  /** The tree, the little witch, the dry and field corn, the fence, the grass banks and tufts, the leaves and the light patches (checked in `tests/autumn.test.ts`). */
  autumnTris: 30500,
  /** Scarecrow, ground, trail, windmill sails, then the tree (wood and leaves), the witch, dry corn, field corn, fence, banks, tufts, fallen leaves, light patches; then the skeletons (hung, sitting, rising and the skulls, two each for bone and eyes) and the boneyard. */
  calls: 23,
  /** The skeletons: two hung, one sitting, four rising, a skull for every fence post, the mounds and loose bones (checked in `tests/skeletons.test.ts`). */
  skeletonTris: 15000,
  /** The haunted house (hill, walls, roof, tower, porch, shutters, panes) and the four extra trees (checked in `tests/house.test.ts`); 3 + 4 x 2 draw calls. */
  houseTris: 1500,
  extraTreeTris: 12000,
  houseCalls: 11,
};

const JACK: ModelId = 'pumpkin_orange_jackolantern';

export function buildPumpkinPatch(seed: number): UniqueSceneSpec {
  const line = sampleLine(smoothPolyline(TRACK, 8), 1.5);
  const centre = line.map(({ x, z }) => ({ x, z }));
  const placer = new Placer({ id: 'pumpkin', seed: PUMPKIN_SEED + seed, moon: PUMPKIN_MOON, path: { centre, halfWidth: LANE_KEEP } });
  const { between } = placer;
  const lights: WarmSource[] = [];
  const glows: WarmSource[] = [];

  // ----- the barn, the silo and the windmill -----
  const barn = placer.fixed(placer.make('farm_barn', 'centre', BARN.x, BARN.z, BARN.rotY, BARN.scale), { onPath: true }, true);
  // The silo's base is 0.049 below y = 0 in its file: lifted by that much so its lowest point is on the ground.
  const silo = placer.fixed(placer.make('farm_silo', 'themed', SILO.x, SILO.z, SILO.rotY, SILO.scale, 0.0494 * SILO.scale));
  // The windmill body sits a little below y = 0 in its file, so it is lifted to stand on the ground.
  const windmill = placer.fixed(placer.make('farm_windmill', 'themed', WINDMILL.x, WINDMILL.z, WINDMILL.rotY, WINDMILL.scale, WINDMILL_FOOT * WINDMILL.scale));
  placer.reserve({ x: SCARECROW.x, z: SCARECROW.z, hx: SCARECROW.hx, hz: SCARECROW.hz, rotY: SCARECROW.rotY });
  // The big tree stands in the left foreground: its trunk and roots are kept clear.
  placer.reserve(TREE_FOOTPRINT);
  // The skeletons: posts, dirt mounds and loose bones (drawn by `PumpkinSkeletons`).
  for (const f of skeletonFootprints()) placer.reserve(f);

  // A warm lantern glow at the barn door.
  const door = { kind: 'lantern' as const, x: barn.x + 0.4, y: 2.1, z: barn.z + MODELS.farm_barn.hz * barn.scale + 0.6 };
  glows.push(door);
  lights.push(door);

  // ----- the rustic fence along the trail is drawn by the scene (crooked posts); the fence models edge the corn fields -----
  for (const [x, z0, z1] of [[-8.6, -3, -22], [12.4, -3, -24]] as const) {
    for (let z = z0; z >= z1; z -= 2.6) placer.tryAdd(placer.make('farm_fence', 'themed', x + between(-0.2, 0.2), z, Math.PI / 2 + between(-0.12, 0.12), 0.68 + between(-0.06, 0.06)), { margin: 0.05 });
  }
  // ----- the jack-o'-lanterns: two in the pumpkin patch and two beside the fence on the left -----
  ([[5.2, 3.2, 1.0], [-5.2, -5.5, 0.95], [6.8, -9.5, 0.9], [-5.6, -13, 0.9]] as const).forEach(([x, z, scale]) => {
    for (let r = 0; r < 14; r++) {
      const j = placer.tryAdd(
        placer.make(JACK, 'themed', x + (r % 2 ? 1 : -1) * r * 0.25, z - r * 0.2, between(-0.4, 0.4), scale),
        { anyMoon: true },
      );
      if (!j) continue;
      const src = { kind: 'jackOLantern' as const, x: j.x, y: 0.65 * j.scale, z: j.z };
      glows.push(src);
      lights.push(src);
      break;
    }
  });

  // ----- a row of small jack-o'-lanterns at the foot of the fence, on both sides of the trail -----
  const laneLine = line.filter((c) => c.z <= LANE_Z.from && c.z >= LANE_Z.to);
  laneLine.forEach((c, i) => {
    if (i % 2 === 0) return;
    for (const side of [-1, 1]) {
      const p = sideOf(c, side, LANE.jack + between(-0.12, 0.12));
      const scale = between(0.55, 0.72);
      const y = bankHeight(LANE.jack);
      const j = placer.tryAdd(placer.make(JACK, 'themed', p.x, p.z, between(-0.5, 0.5) + (side > 0 ? -0.5 : 0.5), scale, y), { onPath: true, anyMoon: true, margin: 0.05 });
      if (j) glows.push({ kind: 'jackOLantern', x: j.x, y: y + 0.65 * j.scale, z: j.z, size: 0.55 });
    }
  });
  // ----- hay bales: near the barn, along the fields and beside the track -----
  const hay = (x0: number, x1: number, z0: number, z1: number, n: number) =>
    placer.scatter('farm_hay', 'themed', n, () => ({ x: between(x0, x1), z: between(z0, z1), rotY: between(0, Math.PI * 2), scale: between(6, 8) }));
  hay(-9.5, -7, -21, -16, 2);
  hay(1, 3.5, -21, -16, 2);
  hay(-9.5, -5, -12, -4, 3);
  hay(5, 8, -22, -14, 2);
  hay(7, 12, 3, 8, 2);
  hay(-8, -5, 0, 6, 2);
  hay(14, 20, -4, 3, 1);

  // ----- corn: rows on both sides, like a field -----
  const row = (x: number, zFrom: number, zTo: number, step: number) => {
    for (let z = zFrom; z >= zTo; z -= step) {
      placer.tryAdd(placer.make('farm_corn', 'themed', x + between(-0.2, 0.2), z + between(-0.25, 0.25), between(0, Math.PI * 2), between(0.95, 1.15)), { margin: 0.05 });
    }
  };
  [-10, -12.2, -14.4, -16.6, -18.8].forEach((x) => row(x, -2, -24, 1.9));
  [13.5, 15.7, 17.9, 20.1].forEach((x) => row(x, -2, -26, 1.9));

  // ----- pumpkins of many sizes: a patch on the right, and scattered along the track and the fields -----
  const small = () => between(0.45, 0.8);
  const big = () => between(0.8, 1.35);
  placer.scatter('farm_pumpkin', 'themed', 30, () => ({ x: between(4, 11.5), z: between(-12, 7), scale: placer.rng() < 0.6 ? small() : big() }), { margin: 0.05 }, 80);
  placer.scatter('farm_pumpkin', 'themed', 8, () => ({ x: between(-9, -5.5), z: between(-14, -4), scale: placer.rng() < 0.5 ? small() : big() }), { margin: 0.05 }, 60);
  placer.scatter('farm_pumpkin', 'themed', 8, () => ({ x: between(-2, 6), z: between(-26, -17.5), scale: placer.rng() < 0.5 ? small() : big() }), { margin: 0.05 }, 60);
  placer.scatter('farm_pumpkin', 'themed', 6, () => ({ x: between(8, 13), z: between(-25, -14), scale: placer.rng() < 0.5 ? small() : big() }), { margin: 0.05 }, 60);

  // Kept clear of the field corn only (so no placed prop moves): the haunted house on its hill and the extra trees.
  const cornClear: Footprint[] = [
    ...placer.reserved,
    { x: HOUSE.x, z: HOUSE.z, hx: HILL.rx * HOUSE.scale, hz: HILL.rz * HOUSE.scale, rotY: HOUSE.rotY },
    ...EXTRA_TREE_SPOTS.map((t) => ({ x: t.x, z: t.z, hx: 1.6 * t.scale, hz: 1.6 * t.scale, rotY: 0 })),
  ];
  const placements: Placement[] = placer.placements;
  return {
    id: 'pumpkin',
    seed,
    centrepiece: { placement: barn, ids: [barn.id, silo.id, windmill.id] },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'grass' },
    path: { kind: 'dirt', centre, halfWidth: TRACK_HALF_WIDTH },
    moon: PUMPKIN_MOON,
    sky: [],
    lights,
    glows,
    anchors: [],
    // No floating ghosts in the Pumpkin Patch: the little witch walking the lane is its only figure.
    ghostSpots: [],
    weather: WEATHER.leaves,
    layers: { clouds: true, witch: true, bats: 1.6, ghosts: false, mist: true, embers: true },
    // The scarecrow, the ground plane, the track and the windmill's sails (a second draw for the same model).
    extras: {
      tris: PUMPKIN_PARTS.scarecrowTris + PUMPKIN_PARTS.groundTris + 2 * centre.length + PUMPKIN_PARTS.autumnTris + PUMPKIN_PARTS.skeletonTris + PUMPKIN_PARTS.houseTris + PUMPKIN_PARTS.extraTreeTris,
      calls: PUMPKIN_PARTS.calls + PUMPKIN_PARTS.houseCalls,
    },
    autumn: { ...buildAutumnPlan(PUMPKIN_SEED + seed, line, placements, cornClear), extraTrees: EXTRA_TREE_SPOTS.map(buildTreeVariant) },
  };
}
