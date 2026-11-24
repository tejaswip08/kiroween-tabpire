// The Blood Moon: ancient ruins under a huge red moon. The ruins stand on a stepped stone platform at the back, with a huge
// moon rising directly behind them. In front, a ritual circle of columns (some leaning, some broken stumps) surrounds a
// pedestal with a red flame. Cracks in the dark red ground glow like lava, a few dead trees stand at the sides, ash falls and
// bats fly in a bigger flock. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { MODELS, type Placement, type WarmSource } from '../layout';
import { WEATHER } from '../weather';
import {
  PEDESTAL, PLATFORM_TOP, PLATFORM_TRIS, RING, RING_PIECES, RUINS, crackNetwork, crackRibbon, onPlatform, platformSteps, ribbonTriangles, ringSlots, sinkOf,
} from './bloodmoonParts';
import { MAX_SINK } from './frostIce';
import { Placer, modelsOf, type UniqueMoon, type UniqueSceneSpec } from './types';

/** Added to the caller's seed, so this theme has its own random stream. */
export const BLOOD_SEED = 7431;

/**
 * A huge blood-red moon (twice the Crypt's disc) directly behind the ruins. It may sit behind the search box and the pinned
 * row. Only the centrepiece group (the ruins, the columns and the pedestal) may stand in front of it.
 */
export const BLOOD_MOON: UniqueMoon = {
  target: () => ({ x: 0.5, y: 0.3 }),
  scale: 2,
  inFront: true,
};

/** Upper bounds for the parts the scene draws itself, for the budget test (`tests/bloodmoon.test.ts` checks the real shapes). */
export const BLOOD_PARTS = {
  groundTris: 2,
  /** Ground plane, platform, crack ribbon. */
  calls: 3,
};
/** How high above the top of the pedestal the flame burns. */
export const FLAME_LIFT = 0.45;

export function buildBloodMoon(seed: number): UniqueSceneSpec {
  const placer = new Placer({ id: 'bloodmoon', seed: BLOOD_SEED + seed, moon: BLOOD_MOON, path: { centre: [], halfWidth: 0 } });
  const { between } = placer;
  const lights: WarmSource[] = [];
  const glows: WarmSource[] = [];
  const sunk: Record<string, number> = {};

  // ----- the ruins on the stepped platform -----
  const info = MODELS.blood_ruins;
  const platform = platformSteps({ x: RUINS.x, z: RUINS.z }, { hx: info.hx * RUINS.scale, hz: info.hz * RUINS.scale });
  const ruins = placer.fixed(placer.make('blood_ruins', 'centre', RUINS.x, RUINS.z, RUINS.rotY, RUINS.scale, PLATFORM_TOP), { margin: 0 }, true);

  // ----- the ritual circle: a pedestal with a red flame, and the ring of columns around it -----
  const pedestal = placer.fixed(placer.make('blood_pedestal', 'centre', PEDESTAL.x, PEDESTAL.z, 0.3, PEDESTAL.scale), { margin: 0.3 });
  const slots = ringSlots(PEDESTAL, RING.radius, RING.count, RING.start);
  const columns: Placement[] = slots.map((slot, i) => {
    const piece = RING_PIECES[i % RING_PIECES.length]!;
    const sink = sinkOf(piece.model, piece.scale, piece.tilt);
    if (sink > MAX_SINK) throw new Error(`Column ${i} sinks ${sink}, more than ${MAX_SINK}`);
    const base = placer.make(piece.model, 'centre', slot.x, slot.z, -slot.angle + between(-0.2, 0.2), piece.scale, -sink);
    const p = placer.fixed(sink > 0 ? { ...base, tilt: piece.tilt } : base, { margin: 0.3 });
    if (sink > 0) sunk[p.id] = sink;
    return p;
  });
  // The flame burns above the pedestal: a red glow and the one real light of the scene.
  const flame: WarmSource = { kind: 'cauldron', x: pedestal.x, y: MODELS.blood_pedestal.h * pedestal.scale + FLAME_LIFT, z: pedestal.z };
  glows.push(flame);
  lights.push(flame);

  // ----- dead trees at the sides, in front of the ruins and beside them -----
  const left = (lo: number, hi: number) => -between(lo, hi) + 0.5;
  const right = (lo: number, hi: number) => between(lo, hi) + 0.5;
  for (const x of [left, right]) {
    placer.scatter('tree_dead_large', 'themed', 2, () => ({ x: x(9, 13), z: between(-14, -7), scale: between(1.3, 1.9) }), { margin: 0.3 }, 50);
    placer.scatter('tree_dead_medium', 'themed', 2, () => ({ x: x(9, 13.5), z: between(-16, -5), scale: between(1.3, 1.9) }), { margin: 0.3 }, 80);
    placer.scatter('tree_dead_large', 'themed', 1, () => ({ x: x(17, 19), z: between(-31, -22), scale: between(1.4, 2) }), { margin: 0.3 }, 50);
  }

  // Two small dead trees close to the camera, one on each side of the ring, low enough to stay under the cards.
  placer.scatter('tree_dead_medium', 'themed', 1, () => ({ x: 0.5 - between(3.4, 4.2), z: between(4.5, 6), scale: between(0.6, 0.8) }), { margin: 0.3 }, 40);
  placer.scatter('tree_dead_medium', 'themed', 1, () => ({ x: 0.5 + between(3.4, 4.2), z: between(4.5, 6), scale: between(0.6, 0.8) }), { margin: 0.3 }, 40);

  const placements: Placement[] = placer.placements;
  const blocked = (x: number, z: number) => onPlatform(platform, x, z, 0.5) || Math.hypot(x - pedestal.x, z - pedestal.z) < 1.8;
  const cracks = crackNetwork(BLOOD_SEED + seed + 1, blocked);
  const crackTris = ribbonTriangles(crackRibbon(cracks));
  return {
    id: 'bloodmoon',
    seed,
    centrepiece: { placement: ruins, ids: [ruins.id, pedestal.id, ...columns.map((c) => c.id)] },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'rock' },
    path: { kind: 'none', centre: [], halfWidth: 0 },
    moon: BLOOD_MOON,
    sky: [],
    lights,
    glows,
    anchors: [],
    // Ghosts drift around the ritual circle, high enough to show above the cards.
    ghostSpots: [
      { x: PEDESTAL.x - 7.4, y: 4.4, z: PEDESTAL.z - 3 },
      { x: PEDESTAL.x + 7.2, y: 5.0, z: PEDESTAL.z - 4.5 },
      { x: PEDESTAL.x + 0.6, y: 6.4, z: PEDESTAL.z - 6.5 },
    ],
    weather: WEATHER.ash,
    layers: { clouds: true, witch: true, bats: 2, ghosts: true, mist: true, embers: true },
    // The ground plane, the platform and the crack ribbon.
    extras: { tris: BLOOD_PARTS.groundTris + PLATFORM_TRIS + crackTris, calls: BLOOD_PARTS.calls },
    sunk,
    raised: { [ruins.id]: PLATFORM_TOP },
    blood: { platform, cracks, ring: { x: PEDESTAL.x, z: PEDESTAL.z, radius: RING.radius } },
    fogScale: 1,
  };
}
