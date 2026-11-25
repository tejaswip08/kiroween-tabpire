// The Haunted Castle: a castle courtyard under a stormy sky. The fortress fills the back, with a courtyard wall running out to
// both sides (gate towers, then stone wall). Banners stand on the end towers and flags hang on their faces. A straight flagstone
// path leads between rows of torches to the door of the keep, and the windows of the fortress glow yellow. The sky flashes with
// soft lightning now and then, the moon is pale and half behind a corner tower, and embers rise from the torches. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { cameraAt, project } from '../camera';
import type { Placement, WarmSource } from '../layout';
import { clearSkyMoon, moonScreenRadiusScaled } from '../sky';
import { WEATHER } from '../weather';
import {
  CORNER_TOWER, DOOR_Z, FORTRESS, LIGHTNING_SEED, PATH, bannerSpots, facadeWindows, flagSpots, torchRow, torchTop, wallPieces, windowTris,
} from './castleParts';
import { Placer, modelsOf, sampleLine, type UniqueMoon, type UniqueSceneSpec } from './types';

/** Added to the caller's seed, so this theme has its own random stream. */
export const CASTLE_SEED = 7541;

/** The pale moon: a little bigger than the Crypt's, its lower part hidden by the top of the left corner tower of the fortress. */
export const CASTLE_MOON_SCALE = 1.1;
/** How far above the top of the tower the middle of the moon sits, as a fraction of the moon's radius (the rest of the disc is behind the tower). */
export const MOON_OVER_TOWER = 0.3;
export const CASTLE_MOON: UniqueMoon = {
  target: (aspect) => clearSkyMoon(aspect, CASTLE_MOON_SCALE),
  scale: CASTLE_MOON_SCALE,
  inFront: true,
};

/** Upper bounds for the parts the scene draws itself, for the budget test: the ground plane, the path ribbon and the windows. */
export const CASTLE_PARTS = { groundTris: 2, calls: 3 };

export function buildHauntedCastle(seed: number): UniqueSceneSpec {
  const line = sampleLine([[PATH.x, PATH.from], [PATH.x, PATH.to]], 1.5);
  const centre = line.map(({ x, z }) => ({ x, z }));
  const placer = new Placer({ id: 'castle', seed: CASTLE_SEED + seed, moon: CASTLE_MOON, path: { centre, halfWidth: PATH.halfWidth } });
  const lights: WarmSource[] = [];
  const glows: WarmSource[] = [];

  // ----- the fortress and the courtyard wall (one group: the centrepiece) -----
  const fortress = placer.fixed(placer.make('castle_fortress', 'centre', FORTRESS.x, FORTRESS.z, FORTRESS.rotY, FORTRESS.scale, FORTRESS.y), { onPath: true, margin: 0 }, true);
  const pieces = wallPieces();
  const walls: Placement[] = pieces.map((w) => placer.fixed(placer.make(w.model, 'centre', w.x, w.z, w.rotY, w.scale, w.y), { margin: 0 }));

  // ----- banners on the end towers and flags on their faces: they stand on the wall, so the wall is what they overlap -----
  const raised: Record<string, number> = {};
  const mounted: Record<string, string> = {};
  bannerSpots(pieces).forEach((b) => {
    const host = walls[b.hostIndex]!;
    const p = placer.fixed(placer.make('castle_banner', 'centre', b.x, b.z, 0, b.scale, b.y), { on: [host], margin: 0 });
    raised[p.id] = b.y;
    mounted[p.id] = host.id;
  });
  flagSpots(pieces).forEach((f) => {
    const host = walls[f.hostIndex]!;
    const p = placer.fixed(placer.make('castle_wall_flag', 'centre', f.x, f.z, 0, f.scale, f.y), { on: [host], margin: 0 });
    raised[p.id] = f.y;
    mounted[p.id] = host.id;
  });

  // ----- the torches along the path: all glow, six of them also hold a real light -----
  const slots = torchRow();
  // The farthest torches first: the embers use the first four anchors, and those are the ones above the cards.
  const farFirst = [...slots].sort((a, b) => a.z - b.z || a.side - b.side);
  const torches = farFirst.map((s) => placer.fixed(placer.make('castle_torch', 'themed', s.x, s.z, 0, s.scale), { margin: 0.15 }));
  const anchors = torches.map((t) => torchTop(t));
  torches.forEach((t, i) => {
    const flame: WarmSource = { kind: 'torch', ...anchors[i]! };
    glows.push(flame);
    if (farFirst[i]!.lit) lights.push(flame);
  });
  // A warm lantern glows in the doorway of the keep.
  glows.push({ kind: 'lantern', x: FORTRESS.x, y: 1.5, z: DOOR_Z + 0.4 });

  const placements = placer.placements;
  const windows = facadeWindows(fortress);
  return {
    id: 'castle',
    seed,
    centrepiece: { placement: fortress, ids: [fortress.id, ...walls.map((w) => w.id)] },
    placements,
    reserved: placer.reserved,
    models: modelsOf(placements),
    ground: { kind: 'flagstone' },
    path: { kind: 'flagstone', centre, halfWidth: PATH.halfWidth },
    moon: CASTLE_MOON,
    sky: ['lightning'],
    lights,
    glows,
    anchors,
    // Ghosts drift in the courtyard, high enough to show above the cards.
    ghostSpots: [
      { x: FORTRESS.x - 6.5, y: 5.2, z: -10 },
      { x: FORTRESS.x + 7, y: 5.6, z: -13 },
      { x: FORTRESS.x + 0.5, y: 6.6, z: -16.5 },
    ],
    weather: WEATHER.embers,
    layers: { clouds: true, witch: true, bats: 1, ghosts: true, mist: true, embers: true },
    // The ground plane, the path ribbon (two triangles per centre point at most) and the windows (one instanced mesh).
    extras: { tris: CASTLE_PARTS.groundTris + 2 * centre.length + windowTris(windows), calls: CASTLE_PARTS.calls },
    raised,
    mounted,
    castle: { windows, walls: pieces, torches: anchors, lightningSeed: LIGHTNING_SEED },
    fogScale: 1.2,
  };
}
