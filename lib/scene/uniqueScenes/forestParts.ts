// The parts the Witch's Forest draws itself, as pure data: the face on the haunted tree, the fire, the scarecrows, the
// ghosts, the graves and the grass. No three, no browser APIs. The drawing is in `entrypoints/newtab/layers/scene/themes/`.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import type { Footprint, Placement } from '../layout';
import { mulberry32 } from '../rng';
export type Point = readonly [number, number];
export type Polygon = readonly Point[];
// ---------- the face on the haunted tree ----------
/**
 * The jack-o'-lantern face, in face space: x to the right, y up, centred on the nose, about 1.3 wide and 1.2 tall. Angry triangle eyes slant down toward the nose; the mouth is a
 * wide jagged grin. Each polygon is a simple outline (the mouth is concave).
 */
export const FACE: { eyes: readonly Polygon[]; nose: Polygon; mouth: Polygon } = {
  eyes: [
    [[-0.56, 0.5], [-0.12, 0.22], [-0.46, 0.02]],
    [[0.56, 0.5], [0.12, 0.22], [0.46, 0.02]],
  ],
  nose: [[0, 0.1], [-0.1, -0.12], [0.1, -0.12]],
  mouth: [
    [-0.62, -0.2], [-0.4, -0.1], [-0.26, -0.3], [-0.1, -0.12], [0.06, -0.3], [0.22, -0.12], [0.38, -0.3], [0.62, -0.2],
    [0.5, -0.5], [0.34, -0.4], [0.22, -0.62], [0.06, -0.46], [-0.1, -0.64], [-0.24, -0.44], [-0.4, -0.58],
  ],
};
/** Triangles of the face with every polygon triangulated: a polygon of n points has n - 2. */
export const FACE_TRIS = [...FACE.eyes, FACE.nose, FACE.mouth].reduce((sum, poly) => sum + poly.length - 2, 0);
/** Where the face sits on the trunk of `forest_twisted_a`, in the model's own units: the centre of the trunk at that height, and the radii of its cross-section. */
export const TRUNK_FACE = { x: -0.35, y: 2.3, z: -0.66, radiusX: 0.64, radiusZ: 0.8 } as const;
/** The face is drawn this much smaller than `FACE` (which is drawn for a trunk 1.7 across): the trunk is 1.3 across at that height. */
export const FACE_SCALE = 0.8;
/** The face stands this far (model units) in front of the trunk's surface. */
export const FACE_LIFT = 0.05;
export interface FacePose {
  x: number;
  y: number;
  z: number;
  /** Turn about the vertical axis. The face is built facing +z, so this includes the half turn onto the back of the model. */
  rotY: number;
  scale: number;
}
/**
 * Where the face goes for a placed `forest_twisted_a`. The face is on the model's -z side (its trunk is straight there), so
 * a tree turned about half a turn shows it to the camera.
 */
export function facePose(tree: Pick<Placement, 'x' | 'y' | 'z' | 'rotY' | 'scale'>): FacePose {
  const c = Math.cos(tree.rotY);
  const s = Math.sin(tree.rotY);
  const { x: lx, y: ly, z: lz } = TRUNK_FACE;
  return {
    x: tree.x + (lx * c + lz * s) * tree.scale,
    y: tree.y + ly * tree.scale,
    z: tree.z + (-lx * s + lz * c) * tree.scale,
    rotY: tree.rotY + Math.PI,
    scale: tree.scale,
  };
}
// ---------- the fire ----------
export interface Flame {
  /** Offset from the middle of the fire on the ground. */
  dx: number;
  dz: number;
  /** Radius of the base and height. */
  radius: number;
  height: number;
  /** Where in its flicker the flame starts (0 to 1). */
  phase: number;
}
/** The middle of the fire: at the foot of the haunted tree, on the camera's side of it. */
export const FIRE = { x: -5.9, z: 3.1 } as const;
/** How many flames, and how many sparks rise from them. */
export const FLAME_COUNT = 13;
export const SPARK_COUNT = 40;
/** Triangles of one flame: a cone with 6 sides and no base. */
export const FLAME_TRIS = 6;
/** Low flames in a ring and a heap: tall ones in the middle, small ones at the edge. Seeded, so the same every time. */
export function flames(): Flame[] {
  const rng = mulberry32(4321);
  const out: Flame[] = [];
  for (let i = 0; i < FLAME_COUNT; i++) {
    const a = (i / FLAME_COUNT) * Math.PI * 2 + rng() * 0.4;
    const ring = i < 4 ? 0.2 : 0.55 + rng() * 0.45;
    const middle = 1 - ring;
    out.push({
      dx: Math.cos(a) * ring * 1.15,
      dz: Math.sin(a) * ring * 0.9,
      radius: 0.2 + rng() * 0.16 + middle * 0.08,
      height: 0.55 + middle * 0.8 + rng() * 0.35,
      phase: rng(),
    });
  }
  return out;
}
// ---------- the scarecrows ----------
export interface ScarecrowSpot {
  x: number;
  z: number;
  rotY: number;
  scale: number;
  /** Where in its sway it starts (0 to 1). */
  phase: number;
}
/** One big scarecrow in the right foreground, two smaller ones further along the path in the fog. */
export const SCARECROWS: readonly ScarecrowSpot[] = [
  { x: 5.2, z: 4.6, rotY: -0.3, scale: 1.15, phase: 0 },
  { x: -3.4, z: -7.6, rotY: 0.35, scale: 1.0, phase: 0.35 },
  { x: 3.7, z: -15.5, rotY: -0.2, scale: 1.2, phase: 0.7 },
];
/** Half the width of the arms and the depth of the post at scale 1: the footprint a scarecrow keeps free. */
export const SCARECROW_REACH = { hx: 1.6, hz: 0.5 } as const;
export const scarecrowFootprint = (s: ScarecrowSpot): Footprint => ({ x: s.x, z: s.z, hx: SCARECROW_REACH.hx * s.scale, hz: SCARECROW_REACH.hz * s.scale, rotY: s.rotY });
/** Sway of a scarecrow about its post, in radians, at time `t` (seconds). Zero for reduced motion. */
export const SWAY_AMPLITUDE = 0.045;
export function scarecrowSway(s: Pick<ScarecrowSpot, 'phase'>, t: number, reduced: boolean): number {
  return reduced ? 0 : SWAY_AMPLITUDE * Math.sin(t * 0.7 + s.phase * Math.PI * 2);
}
// ---------- the ghosts ----------
export interface GhostSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
}
/** Small bright green ghosts high among the branches on the right. */
export const GHOSTS: readonly GhostSpot[] = [
  { x: 6.2, y: 6.2, z: -9, scale: 1.25, phase: 0 },
  { x: 8.8, y: 7.2, z: -11, scale: 1.0, phase: 0.3 },
  { x: 4.8, y: 8.4, z: -14, scale: 1.0, phase: 0.55 },
  { x: 11, y: 6.0, z: -13, scale: 0.9, phase: 0.8 },
];
/** The faint orange wisp on the left. */
export const WISP: GhostSpot = { x: -4.6, y: 4.6, z: -9, scale: 1, phase: 0.5 };
export const BOB_HEIGHT = 0.35;
/** Height offset of something that bobs, at time `t` (seconds). Zero for reduced motion. */
export function bob(phase: number, t: number, reduced: boolean): number {
  return reduced ? 0 : BOB_HEIGHT * Math.sin(t * 0.8 + phase * Math.PI * 2);
}
// ---------- the graves ----------
export interface Grave {
  kind: 'cross' | 'stone';
  x: number;
  z: number;
  rotY: number;
  /** Lean in radians, toward the side. */
  tilt: number;
  scale: number;
}
/** A few crooked wooden crosses and tiny tombstones in the midground near the path. */
export const GRAVES: readonly Grave[] = [
  { kind: 'cross', x: 3.4, z: -2.4, rotY: 0.3, tilt: 0.22, scale: 1.0 },
  { kind: 'stone', x: 4.6, z: -3.4, rotY: -0.2, tilt: -0.1, scale: 0.9 },
  { kind: 'cross', x: -3.2, z: -3.8, rotY: -0.4, tilt: -0.18, scale: 1.1 },
  { kind: 'stone', x: -4.4, z: -4.9, rotY: 0.25, tilt: 0.14, scale: 1.0 },
  { kind: 'cross', x: 2.9, z: -8.6, rotY: 0.2, tilt: 0.3, scale: 1.0 },
  { kind: 'cross', x: -5.2, z: -9.8, rotY: -0.3, tilt: -0.25, scale: 1.0 },
  { kind: 'stone', x: 5.2, z: -11, rotY: 0.4, tilt: 0.12, scale: 0.9 },
];
/** Size of a grave at scale 1: its footprint radius and height. */
export const GRAVE_SIZE = { radius: 0.5, height: 1.1 } as const;
export const graveFootprint = (g: Grave): Footprint => ({ x: g.x, z: g.z, hx: GRAVE_SIZE.radius * g.scale, hz: GRAVE_SIZE.radius * g.scale, rotY: g.rotY });
// ---------- the cauldron and its mushrooms ----------
/** The cauldron stands small in the midground beside the path. Its file stands on y = 0. */
export const CAULDRON = { x: 4.3, z: -5.6, rotY: -0.5, scale: 6.5 };
/** Where, in the file, the soup surface is: its height and radius (the liquid is drawn by `CauldronFx`). */
export const SOUP_LEVEL = 0.22;
export const SOUP_RADIUS = 0.131;
/** The few small mushrooms by the cauldron: offsets from it and the scale. */
export const MUSHROOMS: readonly { dx: number; dz: number; scale: number }[] = [
  { dx: -2.3, dz: 0.9, scale: 1.3 },
  { dx: 2.1, dz: 1.4, scale: 1.0 },
  { dx: 1.6, dz: -1.9, scale: 1.2 },
  { dx: -1.4, dz: -1.6, scale: 0.9 },
];
// ---------- the grass ----------
export interface Tuft {
  x: number;
  z: number;
  rotY: number;
  /** Height and width scale. */
  height: number;
  width: number;
}
/** Triangles of one tuft (three blades of 3 sides, open ended: 3 triangles each, plus the base 3: 9 per blade is the bound). */
export const TUFT_TRIS = 18;
export const PLANT_TRIS = 24;
export interface Grass {
  tufts: Tuft[];
  plants: Tuft[];
}
/**
 * Rough grass along both edges of the trail, more in patches further out, and a few small dark plants at the edge. Nothing
 * stands on the trail itself, and nothing in the middle of the screen is tall (the tallest tuft is about 0.9).
 */
export function grass(path: readonly { x: number; z: number }[], halfWidth: number, keepOut: readonly Footprint[]): Grass {
  const rng = mulberry32(8123);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const dist = (x: number, z: number) => path.reduce((m, c) => Math.min(m, Math.hypot(c.x - x, c.z - z)), Infinity);
  const clear = (x: number, z: number) => keepOut.every((f) => Math.hypot(f.x - x, f.z - z) > Math.max(f.hx, f.hz) + 0.2);
  const tufts: Tuft[] = [];
  const plants: Tuft[] = [];
  for (let n = 0; n < 700 && tufts.length < 230; n++) {
    // Mostly along the edge of the trail, some in patches out to the sides.
    const c = path[Math.floor(rng() * path.length)]!;
    const near = rng() < 0.7;
    const a = rng() * Math.PI * 2;
    const r = halfWidth + 0.2 + (near ? between(0, 1.6) : between(1.6, 7));
    const x = c.x + Math.cos(a) * r;
    const z = c.z + Math.sin(a) * r;
    if (dist(x, z) < halfWidth + 0.15 || z > 9 || z < -30 || Math.abs(x) > 18 || !clear(x, z)) continue;
    tufts.push({ x, z, rotY: between(0, Math.PI * 2), height: between(0.4, 0.9), width: between(0.8, 1.3) });
  }
  for (let n = 0; n < 200 && plants.length < 22; n++) {
    const c = path[Math.floor(rng() * path.length)]!;
    const a = rng() * Math.PI * 2;
    const r = halfWidth + 0.6 + between(0, 3.2);
    const x = c.x + Math.cos(a) * r;
    const z = c.z + Math.sin(a) * r;
    if (dist(x, z) < halfWidth + 0.5 || z > 8 || z < -26 || Math.abs(x) > 15 || !clear(x, z)) continue;
    plants.push({ x, z, rotY: between(0, Math.PI * 2), height: between(0.7, 1.3), width: between(0.8, 1.2) });
  }
  return { tufts, plants };
}
// ---------- everything together ----------
/** What the scene draws itself, for the spec, the scene component and the tests. */
export interface ForestParts {
  /** The id of the haunted tree (a placement), and where its face goes. */
  hero: { id: string; face: FacePose };
  fire: { x: number; z: number; flames: Flame[]; sparks: number };
  /** The big jack-o'-lantern beside the fire (the id of its placement). */
  jackId: string;
  scarecrows: ScarecrowSpot[];
  ghosts: GhostSpot[];
  wisp: GhostSpot;
  graves: Grave[];
  grass: Grass;
}
/** The two colours the whole scene pivots on: a hot red-orange on the left and an eerie green on the right. */
export const TWO_TONE = { left: '#ff5a1c', right: '#35e08a' } as const;
/** Upper bounds for the parts the scene draws itself, for the budget test (`tests/forest.test.ts` checks the real shapes). */
export const FOREST_PARTS = {
  /** Ground plane: 36 x 36 cells of two triangles. */
  groundTris: 36 * 36 * 2,
  /** One scarecrow, from the merged shapes. */
  scarecrowTris: 900,
  /** The ghost body: a lathe with a wavy hem, plus two eyes. */
  ghostTris: 360,
  /** The graves (all merged), and the liquid disc of the cauldron (32 segments). */
  graveTris: 700,
  liquidTris: 32,
  /** Ground, trail, face, flames, sparks, tufts, plants, graves, three scarecrows, ghosts, wisp, liquid. */
  calls: 15,
};
