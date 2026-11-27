// Shapes of the Frozen Cemetery, built from simple low-poly parts (boxes, cones, spheres, prisms), each merged into one geometry with
// flat vertex colours, so every shape is one draw call (or one instanced mesh). No image files, no new models.
import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, ExtrudeGeometry, IcosahedronGeometry, Matrix4, Quaternion, Shape,
  PlaneGeometry, SphereGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CROSS, HOUSE, LANTERN_POST, SLAB } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { coloured } from './shapes';
/** A part: the shape turned about x, y, z (in that order), then moved, in one flat colour. */
export function put(g: BufferGeometry, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): BufferGeometry {
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ')), new Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  return coloured(g, color);
}
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => put(new BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
const cyl = (r0: number, r1: number, h: number, seg: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  put(new CylinderGeometry(r0, r1, h, seg), color, x, y, z, rx, ry, rz);
const ball = (r: number, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, seg = 7) => put(new SphereGeometry(r, seg, Math.max(3, seg - 2)), color, x, y, z, 0, 0, 0, sx, sy, sz);
const cone = (r: number, h: number, seg: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => put(new ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz);
/** A flat polygon (x, y points) pushed out `depth` along z, centred on z = 0. */
function prism(points: readonly (readonly [number, number])[], depth: number, color: string, x = 0, y = 0, z = 0): BufferGeometry {
  const shape = new Shape(points.map(([px, py]) => new Vector2(px, py)));
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return put(g, color, x, y, z);
}
/** Triangles of a geometry (counts the index when there is one). */
export const trisOf = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts)!;
const STONE = '#3d4d68';
const STONE_DARK = '#2b3850';
const STONE_LIGHT = '#516383';
const SNOW = '#f3f8ff';
const SNOW_BLUE = '#dbe8fb';
// ---------------------------------------------------------------------------------------------------------------------------------
// Tombstones, graves, lanterns, fence
// ---------------------------------------------------------------------------------------------------------------------------------
const GRAVE = '#4a5a77';
const GRAVE_LIGHT = '#5f7396';
/**
 * A tombstone with a round top, a snow cap on the top and a drift at its foot, and a small skull cut into its face: a dark pair of eyes and a
 * nose. The foot is at y = 0. Size `SLAB` (1 wide, 1.65 tall).
 */
export function buildSlab(): BufferGeometry {
  const { w, h, d } = SLAB;
  const r = w / 2;
  const sh = h - r;
  const p: BufferGeometry[] = [
    box(w, sh, d, GRAVE, 0, sh / 2, 0),
    put(new CylinderGeometry(r, r, d, 9, 1), GRAVE_LIGHT, 0, sh, 0, Math.PI / 2, 0, 0),
    put(new CylinderGeometry(r * 1.07, r * 1.07, 0.1, 9, 1), SNOW, 0, h - 0.01, 0, Math.PI / 2, 0, 0, 1, 1, 0.8),
    put(new IcosahedronGeometry(0.42, 0), SNOW_BLUE, 0.1, 0.02, d * 0.9, 0, 0.5, 0, 1.3, 0.55, 0.9),
    // The skull.
    ball(0.15, '#a9bad4', 0, h * 0.62, d / 2 + 0.005, 1, 0.95, 0.35),
    ball(0.045, '#0a111f', -0.055, h * 0.64, d / 2 + 0.05, 1, 1.2, 0.5, 5),
    ball(0.045, '#0a111f', 0.055, h * 0.64, d / 2 + 0.05, 1, 1.2, 0.5, 5),
    box(0.1, 0.06, 0.02, '#a9bad4', 0, h * 0.55, d / 2 + 0.03),
  ];
  return merge(p);
}
/** A cross-shaped stone with snow on its arms. The foot is at y = 0. Size `CROSS`. */
export function buildCross(): BufferGeometry {
  const { w, h, d } = CROSS;
  return merge([
    box(0.36, h, d, GRAVE, 0, h / 2, 0),
    box(w, 0.3, d, GRAVE_LIGHT, 0, h * 0.7, 0),
    box(0.42, 0.1, d + 0.04, SNOW, 0, h + 0.03, 0),
    box(w + 0.05, 0.1, d + 0.04, SNOW, 0, h * 0.7 + 0.19, 0),
    box(0.5, 0.18, d + 0.1, GRAVE_LIGHT, 0, 0.09, 0),
    put(new IcosahedronGeometry(0.4, 0), SNOW_BLUE, -0.1, 0.02, 0.1, 0, 0.3, 0, 1.3, 0.5, 0.9),
  ]);
}
/**
 * An open grave: a dark hole in the snow, a lip of snow round it, a mound of dug-up earth and snow at one end, and a plank across the
 * middle. Lies flat (centred, long side along z); 1.4 by 2.7.
 */
export function buildOpenGrave(): BufferGeometry {
  return merge([
    box(1.2, 0.05, 2.5, '#03050b', 0, 0.075, 0),
    box(1.5, 0.09, 0.22, SNOW, 0, 0.06, 1.38),
    box(1.5, 0.09, 0.22, SNOW, 0, 0.06, -1.38),
    box(0.22, 0.09, 2.6, SNOW, 0.74, 0.06, 0),
    box(0.22, 0.09, 2.6, SNOW, -0.74, 0.06, 0),
    put(new IcosahedronGeometry(0.9, 1), '#4c5870', 0.2, 0.0, -2.0, 0, 0.4, 0, 1.4, 0.55, 1.0),
    put(new IcosahedronGeometry(0.55, 0), SNOW, 0.0, 0.2, -1.95, 0, 0.9, 0, 1.2, 0.5, 1.0),
    box(0.1, 0.07, 1.7, '#3a2a22', -0.3, 0.14, 0.2, 0, 0.1, 0),
  ]);
}
const IRON = '#161d2c';
/** A short thin candle. */
export const buildCandle = (): BufferGeometry => new CylinderGeometry(0.06, 0.07, 0.26, 6).translate(0, 0.13, 0);
/** One bar of the iron fence: a thin post with a spear point and a ring, standing 1.7 tall. Foot at y = 0. */
export function buildBar(): BufferGeometry {
  return merge([box(0.07, 1.7, 0.07, IRON, 0, 0.85, 0), cone(0.07, 0.24, 4, '#2a3550', 0, 1.82, 0, 0, Math.PI / 4, 0), box(0.14, 0.05, 0.14, '#2a3550', 0, 1.2, 0), cone(0.1, 0.07, 4, SNOW, 0, 1.9, 0)]);
}
/** A rail of the fence: a thin bar of length 1 along x with a line of snow on top. */
export function buildRail(): BufferGeometry {
  return merge([box(1, 0.06, 0.06, IRON, 0, 0, 0), box(1, 0.04, 0.09, SNOW, 0, 0.05, 0)]);
}
// ---------------------------------------------------------------------------------------------------------------------------------
// Bones
// ---------------------------------------------------------------------------------------------------------------------------------
const BONE = '#d4ebff';
const BONE_DARK = '#8fb7dc';
/**
 * A skeletal hand with its forearm, reaching up (+y), the palm facing +z: a flat palm, four long fingers with a bend, a thumb, and two thin
 * bones in the forearm. The wrist is at y = 0.3, the fingertips at about y = 1.15. The forearm goes down to y = -0.5.
 */
export function buildHand(): BufferGeometry {
  const p: BufferGeometry[] = [box(0.5, 0.42, 0.1, BONE, 0, 0.5, 0), box(0.54, 0.07, 0.12, BONE_DARK, 0, 0.3, 0)];
  const lengths = [0.5, 0.58, 0.54, 0.4];
  lengths.forEach((len, i) => {
    const x = -0.18 + i * 0.12;
    const lean = (i - 1.5) * 0.14;
    const lower = len * 0.55;
    p.push(cyl(0.035, 0.04, lower, 5, BONE, x + Math.sin(-lean) * lower * 0.5, 0.71 + lower / 2, 0, 0, 0, lean));
    p.push(ball(0.045, BONE_DARK, x, 0.72, 0, 1, 1, 1, 5));
    const upper = len * 0.5;
    const ux = x - Math.sin(lean) * lower;
    p.push(cyl(0.028, 0.034, upper, 5, BONE, ux - Math.sin(lean + 0.35) * upper * 0.5, 0.71 + lower + upper / 2, 0.02, 0, 0, lean + 0.35));
  });
  p.push(cyl(0.04, 0.05, 0.4, 5, BONE, 0.34, 0.55, 0, 0, 0, -0.85));
  p.push(cyl(0.045, 0.05, 0.8, 5, BONE, -0.06, -0.1, 0, 0, 0, 0));
  p.push(cyl(0.035, 0.04, 0.8, 5, BONE_DARK, 0.08, -0.1, 0.02, 0, 0, 0));
  p.push(ball(0.06, BONE_DARK, -0.06, 0.3, 0, 1, 1, 1, 5), ball(0.06, BONE_DARK, 0.08, 0.3, 0, 1, 1, 1, 5));
  return merge(p);
}
/** A skull face (about 1 wide), looking toward +z: cranium, jaw with teeth, hollow eyes and a nose hole. The middle is at the origin. */
export function buildSkull(): BufferGeometry {
  const dark = '#02060d';
  return merge([
    ball(0.5, BONE, 0, 0.1, 0, 1, 1.05, 0.95, 9),
    box(0.5, 0.22, 0.42, BONE_DARK, 0, -0.36, 0.06),
    box(0.42, 0.07, 0.04, BONE, 0, -0.27, 0.3),
    ball(0.15, dark, -0.2, 0.08, 0.4, 1, 1.1, 0.5, 6),
    ball(0.15, dark, 0.2, 0.08, 0.4, 1, 1.1, 0.5, 6),
    cone(0.06, 0.16, 3, dark, 0, -0.1, 0.47, 0, 0, Math.PI),
    box(0.04, 0.12, 0.03, dark, -0.12, -0.34, 0.31),
    box(0.04, 0.12, 0.03, dark, 0.0, -0.34, 0.31),
    box(0.04, 0.12, 0.03, dark, 0.12, -0.34, 0.31),
  ]);
}
/** Jagged shards of ice round the hole the hand broke through: flat on the ice, each a low cone. */
export function buildShards(): BufferGeometry {
  const p: BufferGeometry[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.75 + 0.18 * Math.sin(i * 2.7);
    p.push(cone(0.17 + 0.05 * ((i * 7) % 3), 0.5 + 0.2 * ((i * 5) % 3), 4, i % 2 ? '#e8f4ff' : '#9fd2ff', Math.cos(a) * r, 0.2, Math.sin(a) * r, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55));
  }
  p.push(cyl(0.7, 0.7, 0.03, 10, '#02060d', 0, 0.02, 0));
  return merge(p);
}
// ---------------------------------------------------------------------------------------------------------------------------------
// Smooth drifts, ice
// ---------------------------------------------------------------------------------------------------------------------------------
/** A soft mound: an icosahedron with one level of detail and smooth normals. 80 triangles, unit radius, centred on the origin. */
export function buildSmoothMound(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  return merged;
}
// ---------------------------------------------------------------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------------------------------------------------------------
const WOLF = '#070b14';
const WOLF_LIGHT = '#101a2c';
/** Where the howling wolf's head turns: the base of its neck, in the wolf's own units (the wolf looks along +x). */
export const NECK = { x: 0.95, y: 1.0 } as const;
/** The body of a wolf (no head): a long chest and haunch, four legs, a hanging tail and the neck. About 2.2 long and 1.2 tall. */
export function buildWolfBody(): BufferGeometry {
  return merge([
    ball(0.5, WOLF, 0.1, 0.78, 0, 1.5, 0.82, 0.68, 8),
    ball(0.42, WOLF_LIGHT, 0.55, 0.82, 0, 1, 1, 0.9, 7),
    ball(0.38, WOLF, -0.62, 0.78, 0, 1, 1, 0.9, 7),
    cyl(0.09, 0.07, 0.65, 5, WOLF, 0.6, 0.32, 0.17), cyl(0.09, 0.07, 0.65, 5, WOLF, 0.6, 0.32, -0.17),
    cyl(0.1, 0.07, 0.65, 5, WOLF, -0.62, 0.32, 0.17), cyl(0.1, 0.07, 0.65, 5, WOLF, -0.62, 0.32, -0.17),
    cone(0.11, 0.8, 5, WOLF, -1.1, 0.78, 0, 0, 0, 2.0),
    cyl(0.19, 0.25, 0.5, 6, WOLF_LIGHT, 0.85, 1.02, 0, 0, 0, -0.5),
  ]);
}
/** The head of a wolf with its pivot at the base of the neck: skull, long snout, two ears. Looks along +x. */
export function buildWolfHead(): BufferGeometry {
  return merge([
    ball(0.24, WOLF, 0.2, 0.12, 0, 1.1, 0.9, 0.8, 7),
    box(0.42, 0.13, 0.15, WOLF, 0.52, 0.07, 0),
    cone(0.07, 0.2, 4, WOLF, 0.08, 0.38, 0.1), cone(0.07, 0.2, 4, WOLF, 0.08, 0.38, -0.1),
  ]);
}
/** The two glowing eyes of a wolf (relative to the same pivot as `buildWolfHead`). Drawn unlit and bright, so they bloom. */
export function buildWolfEyes(): BufferGeometry {
  return merge([ball(0.04, '#ffffff', 0.34, 0.17, 0.09, 1, 0.7, 1, 4), ball(0.04, '#ffffff', 0.34, 0.17, -0.09, 1, 0.7, 1, 4)]);
}
/** A pair of eyes among the pines: two small bright ovals set 0.3 apart, middle at the origin. */
export function buildEyePair(): BufferGeometry {
  return merge([ball(0.07, '#ffffff', -0.15, 0, 0, 1.3, 0.7, 0.6, 5), ball(0.07, '#ffffff', 0.15, 0, 0, 1.3, 0.7, 0.6, 5)]);
}
/** A crow sitting, looking along +x: fat body, round head, a pointed beak and a long tail. About 0.5 long. */
export function buildCrow(): BufferGeometry {
  const c = '#05070d';
  return merge([
    ball(0.17, c, 0, 0.17, 0, 1.45, 1, 0.85, 6),
    ball(0.1, c, 0.2, 0.3, 0, 1, 1, 1, 6),
    cone(0.035, 0.14, 4, '#1a1f2a', 0.33, 0.29, 0, 0, 0, -Math.PI / 2),
    box(0.3, 0.03, 0.14, c, -0.3, 0.19, 0, 0, 0, -0.25),
    box(0.04, 0.12, 0.02, c, 0, 0.0, 0.05), box(0.04, 0.12, 0.02, c, 0, 0.0, -0.05),
  ]);
}
/** A far pine silhouette: three stacked cones, dark navy with a bluish dusting of snow on each tier. Unit width, 1.9 tall, foot at y = 0. */
export function buildFarPine(): BufferGeometry {
  const dark = '#08142b';
  const snow = '#2a4778';
  const tiers: readonly (readonly [number, number, number])[] = [[0.62, 0.95, 0.5], [0.46, 0.85, 1.05], [0.3, 0.75, 1.55]];
  const p: BufferGeometry[] = [];
  for (const [r, h, y] of tiers) {
    p.push(cone(r, h, 6, dark, 0, y, 0));
    p.push(cone(r * 0.72, h * 0.62, 6, snow, 0.0, y + h * 0.2, 0.0));
  }
  return merge(p);
}
// ---------------------------------------------------------------------------------------------------------------------------------
// The haunted house, its gate, the hook lanterns, the flag and the far cottages
// ---------------------------------------------------------------------------------------------------------------------------------
const WOOD = '#2a3246';
const WOOD_DARK = '#1c2232';
const WOOD_LIGHT = '#3c4762';
const BOARD = '#4a4152';
const HOLE = '#04070d';
/** Lowers every point of a shape by the sag of the house roof at its x (own units), so the roof, its snow and its eave bow in the middle. */
function sagged(g: BufferGeometry, sag = 0.38, half = HOUSE.halfW + 0.5): BufferGeometry {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - sag * Math.max(0, 1 - (pos.getX(i) / half) ** 2));
  pos.needsUpdate = true;
  return g;
}
/** A triangle gable in the y-z plane (an end wall of a roof whose ridge runs along x), at `x`, from the eave height up to the ridge. */
function gable(x: number, halfD: number, low: number, ridge: number, color: string): BufferGeometry {
  const shape = new Shape([new Vector2(-halfD, low), new Vector2(halfD, low), new Vector2(0, ridge)]);
  const g = new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  g.translate(0, 0, -0.15);
  return put(g, color, x, 0, 0, 0, Math.PI / 2, 0);
}
/** A window: a dark hole, a frame, two crossed boards nailed over it and a broken shutter. In the plane z = `z`, facing +z. */
function boardedWindow(x: number, y: number, z: number, w: number, h: number, shutter: -1 | 0 | 1): BufferGeometry[] {
  const p: BufferGeometry[] = [
    box(w + 0.24, 0.14, 0.12, WOOD_LIGHT, x, y - h / 2 - 0.05, z + 0.04),
    box(w + 0.18, 0.12, 0.1, WOOD_LIGHT, x, y + h / 2 + 0.05, z + 0.04),
    box(0.1, h, 0.1, WOOD_LIGHT, x - w / 2 - 0.04, y, z + 0.04),
    box(0.1, h, 0.1, WOOD_LIGHT, x + w / 2 + 0.04, y, z + 0.04),
    box(w * 1.25, 0.16, 0.06, BOARD, x, y + 0.12, z + 0.12, 0, 0, 0.55),
    box(w * 1.2, 0.15, 0.06, BOARD, x, y - 0.1, z + 0.14, 0, 0, -0.62),
    box(w * 1.05, 0.14, 0.06, BOARD, x + 0.03, y - h * 0.32, z + 0.1, 0, 0, 0.06),
  ];
  // A shutter hanging from one hinge, swung down and out at an angle; the other is gone.
  if (shutter) p.push(box(w * 0.48, h * 0.95, 0.06, WOOD, x + shutter * (w / 2 + 0.36), y - 0.22, z + 0.12, 0.05, shutter * 0.18, shutter * -0.42));
  return p;
}
/**
 * The haunted house, one merged geometry in its own units, foot at y = 0, front (the door) toward +z, 7 wide and 5.4 deep. Crooked
 * plank walls on a stone footing, a gable roof that sags in the middle under a heavy load of snow with a thick lip over the eaves,
 * boarded-up windows with broken shutters, a boarded door, a leaning chimney, and snow heaped round the foot. The window light is
 * `buildHouseWindows`; the icicles, the smoke and the flag are drawn apart.
 */
export function buildHouse(): BufferGeometry {
  const { halfW, frontZ } = HOUSE;
  const halfD = frontZ;
  const wallH = 3.9;
  const ridge = 6.0;
  const eaveZ = halfD + 0.55;
  const p: BufferGeometry[] = [];
  p.push(box(2 * halfW + 0.4, 0.45, 2 * halfD + 0.4, STONE_DARK, 0, 0.1, 0));
  // Walls, each a little out of true.
  p.push(box(2 * halfW, wallH, 0.28, WOOD, 0, wallH / 2, halfD - 0.14, 0.02, 0, 0.025));
  p.push(box(2 * halfW, wallH, 0.28, WOOD_DARK, 0, wallH / 2, -halfD + 0.14, -0.015, 0, -0.02));
  p.push(box(0.28, wallH, 2 * halfD, WOOD_DARK, -halfW + 0.14, wallH / 2, 0, 0, 0, 0.04));
  p.push(box(0.28, wallH, 2 * halfD, WOOD, halfW - 0.14, wallH / 2, 0, 0, 0, -0.035));
  // Corner posts and a few loose planks.
  for (const [x, z] of [[-halfW, halfD], [halfW, halfD], [-halfW, -halfD], [halfW, -halfD]] as const) p.push(box(0.3, wallH + 0.1, 0.3, WOOD_LIGHT, x, wallH / 2, z, 0, 0, x * 0.008));
  p.push(box(1.6, 0.18, 0.05, WOOD_LIGHT, -2.4, 0.9, halfD + 0.02, 0, 0, 0.12));
  p.push(box(1.3, 0.18, 0.05, WOOD_LIGHT, 2.6, 3.3, halfD + 0.02, 0, 0, -0.18));
  p.push(box(0.05, 0.18, 1.5, WOOD_LIGHT, halfW + 0.02, 1.2, 0.8, 0.2, 0, 0));
  // Gables at both ends, the wall tops under the roof.
  p.push(sagged(gable(-halfW + 0.14, halfD, wallH - 0.05, ridge, WOOD_DARK)));
  p.push(sagged(gable(halfW - 0.14, halfD, wallH - 0.05, ridge, WOOD)));
  // The roof: two slopes that sag in the middle, each with a thick layer of snow, a lip of snow over the eave, and a ragged hole.
  const run = eaveZ;
  const rise = ridge - HOUSE.eaveY;
  const slope = Math.atan2(rise, run);
  const len = Math.hypot(rise, run) + 0.15;
  for (const side of [1, -1] as const) {
    const cz = (side * run) / 2;
    const cy = (ridge + HOUSE.eaveY) / 2;
    p.push(sagged(put(new BoxGeometry(2 * halfW + 1.0, 0.2, len, 10, 1, 1), '#20283a', 0, cy, cz, side * slope, 0, 0)));
    p.push(sagged(put(new BoxGeometry(2 * halfW + 1.1, 0.34, len - 0.1, 10, 1, 1), SNOW, 0, cy + 0.26, cz - side * 0.05, side * slope, 0, 0)));
    p.push(sagged(put(new CylinderGeometry(0.26, 0.26, 2 * halfW + 1.15, 7, 10), SNOW_BLUE, 0, HOUSE.eaveY + 0.12, side * (eaveZ + 0.02), 0, 0, Math.PI / 2)));
  }
  p.push(sagged(put(new CylinderGeometry(0.3, 0.3, 2 * halfW + 1.1, 7, 10), SNOW, 0, ridge + 0.22, 0, 0, 0, Math.PI / 2)));
  // A ragged hole in the front slope, near the left end.
  p.push(box(0.9, 0.08, 0.7, HOLE, -2.3, 5.12, 1.45, slope, 0, 0.1));
  // The leaning chimney with a cap and snow on top.
  p.push(box(0.75, 2.8, 0.75, STONE, HOUSE.chimneyX, 5.7, HOUSE.chimneyZ, 0, 0, -0.14));
  p.push(box(0.95, 0.2, 0.95, STONE_LIGHT, HOUSE.chimneyX + 0.19, 7.08, HOUSE.chimneyZ, 0, 0, -0.14));
  p.push(box(0.9, 0.14, 0.9, SNOW, HOUSE.chimneyX + 0.21, 7.22, HOUSE.chimneyZ, 0, 0, -0.14));
  p.push(box(0.45, 0.06, 0.45, HOLE, HOUSE.chimneyX + 0.22, 7.3, HOUSE.chimneyZ, 0, 0, -0.14));
  // The door: a dark doorway with planks nailed across it, a step, and a little sagging porch roof over it with snow.
  p.push(box(1.4, 2.5, 0.08, HOLE, 0, 1.45, halfD + 0.02));
  p.push(box(1.7, 0.18, 0.07, BOARD, 0, 1.9, halfD + 0.1, 0, 0, 0.32), box(1.6, 0.18, 0.07, BOARD, 0, 1.0, halfD + 0.12, 0, 0, -0.25));
  p.push(box(0.12, 2.6, 0.12, WOOD_LIGHT, -0.76, 1.45, halfD + 0.05), box(0.12, 2.6, 0.12, WOOD_LIGHT, 0.76, 1.45, halfD + 0.05));
  p.push(box(2.0, 0.22, 0.9, STONE_DARK, 0, 0.12, halfD + 0.5));
  p.push(box(2.4, 0.12, 1.1, '#20283a', 0, 3.1, halfD + 0.55, 0.35, 0, 0.06), box(2.5, 0.2, 1.1, SNOW, 0, 3.24, halfD + 0.55, 0.35, 0, 0.06));
  p.push(box(0.1, 1.5, 0.1, WOOD_LIGHT, -1.05, 2.3, halfD + 0.95, 0, 0, 0.1));
  // Boarded windows: two at the front, one on the right side wall, a small one in the right gable.
  p.push(...boardedWindow(-2.1, 2.3, halfD, 1.0, 1.15, -1));
  p.push(...boardedWindow(2.15, 2.25, halfD, 1.0, 1.15, 1));
  const toSide = new Matrix4().makeRotationY(Math.PI / 2);
  p.push(...boardedWindow(0, 2.2, 0, 1.0, 1.1, 1).map((g) => g.applyMatrix4(toSide).translate(halfW, 0, 0.6)));
  p.push(...boardedWindow(0, 4.75, 0, 0.55, 0.5, 0).map((g) => g.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2)).translate(halfW - 0.05, 0, 0)));
  // Snow heaped against the walls.
  const heaps: readonly (readonly [number, number, number, number])[] = [
    [-3.3, 3.1, 1.3, 0.6], [3.4, 3.0, 1.2, 0.55], [-1.9, 3.2, 0.9, 0.4], [1.8, 3.25, 0.9, 0.38], [4.0, 0.8, 1.3, 0.6], [4.0, -1.8, 1.2, 0.55],
    [-4.0, -0.4, 1.4, 0.6], [-0.5, -3.3, 1.8, 0.6],
  ];
  for (const [x, z, r, h] of heaps) p.push(put(new IcosahedronGeometry(r, 1), SNOW_BLUE, x, 0, z, 0, 0, 0, 1.3, h, 1));
  return merge(p.map((g) => (g.index ? g.toNonIndexed() : g)));
}
/** The faint light behind the boards of the house's windows, in the house's units: flat panes just inside each window. Vertex colours: warm at the front, cold blue on the side. */
export function buildHouseWindows(): BufferGeometry {
  const z = HOUSE.frontZ + 0.03;
  const warm = '#ffb26a';
  const cold = '#86c6ff';
  const side = (y: number, w: number, h: number, lz: number) => put(new BoxGeometry(0.02, h, w), cold, HOUSE.halfW + 0.02, y, lz);
  return merge([
    box(1.0, 1.15, 0.02, warm, -2.1, 2.3, z),
    box(1.0, 1.15, 0.02, warm, 2.15, 2.25, z),
    box(0.25, 2.2, 0.02, warm, 0, 1.45, z + 0.02),
    side(2.2, 1.0, 1.1, 0.6),
    side(4.75, 0.55, 0.5, 0),
  ]);
}
/** A hook post (a shepherd's crook): a post with a foot, an arm reaching out along +x at the top with a little curl, snow on the arm. */
export function buildHookPost(): BufferGeometry {
  const { h, armX, hookY } = LANTERN_POST;
  return merge([
    box(0.34, 0.14, 0.34, IRON, 0, 0.07, 0),
    box(0.09, h, 0.09, IRON, 0, h / 2, 0),
    box(armX + 0.1, 0.07, 0.07, IRON, armX / 2, hookY + 0.05, 0),
    box(0.06, 0.16, 0.06, IRON, armX + 0.06, hookY + 0.12, 0),
    ball(0.07, IRON, 0, h + 0.03, 0, 1, 1, 1, 5),
    box(armX * 0.8, 0.05, 0.1, SNOW, armX * 0.45, hookY + 0.11, 0),
    ball(0.08, SNOW, 0, h + 0.08, 0, 1, 0.5, 1, 5),
  ]);
}
/** A round iron lantern hanging from a short chain, the top of the chain at the origin: a domed cap with a ring, a round frame with four bars. */
export function buildHangLantern(): BufferGeometry {
  const c = LANTERN_POST.flameY - LANTERN_POST.hookY;
  const p: BufferGeometry[] = [box(0.03, 0.24, 0.03, IRON, 0, -0.12, 0), put(new SphereGeometry(0.17, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), IRON, 0, c + 0.2, 0)];
  p.push(cyl(0.18, 0.18, 0.05, 7, IRON, 0, c + 0.2, 0), cyl(0.15, 0.19, 0.07, 7, IRON, 0, c - 0.22, 0), put(new SphereGeometry(0.12, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, 0, c + 0.27, 0, 0, 0, 0, 1, 0.45, 1));
  for (const a of [0.4, 2.0, 3.5, 5.1]) p.push(box(0.03, 0.42, 0.03, IRON, Math.cos(a) * 0.16, c, Math.sin(a) * 0.16));
  return merge(p.map((g) => (g.index ? g.toNonIndexed() : g)));
}
/** The flame of a hanging lantern: a small soft blob at the middle of the lantern (relative to the hook, like `buildHangLantern`). */
export const buildLanternFlame = (): BufferGeometry => new IcosahedronGeometry(0.085, 1).scale(1, 1.4, 1).translate(0, LANTERN_POST.flameY - LANTERN_POST.hookY, 0);
/** The faint halo round a lantern's flame: no bigger than the lantern, so nothing blooms into a blob. */
export const buildLanternHalo = (): BufferGeometry => new IcosahedronGeometry(0.2, 1).translate(0, LANTERN_POST.flameY - LANTERN_POST.hookY, 0);
/** One leaf of the iron gate, hinged at the origin and reaching 1.2 along +x: two stiles, rails, spear-tipped bars, a curl on top. */
export function buildGateLeaf(): BufferGeometry {
  const w = 1.2;
  const p: BufferGeometry[] = [box(0.08, 1.75, 0.08, IRON, 0.04, 0.88, 0), box(0.07, 1.55, 0.07, IRON, w, 0.78, 0)];
  for (const y of [0.25, 1.35]) p.push(box(w, 0.06, 0.06, IRON, w / 2, y, 0));
  for (let i = 1; i < 5; i++) {
    const x = (w * i) / 5;
    p.push(box(0.04, 1.45, 0.04, IRON, x, 0.78, 0), cone(0.05, 0.16, 4, '#2a3550', x, 1.58, 0, 0, Math.PI / 4, 0));
  }
  p.push(put(new CylinderGeometry(0.16, 0.16, 0.04, 8, 1, true), IRON, w / 2, 1.55, 0, Math.PI / 2, 0, 0));
  p.push(box(w * 0.9, 0.05, 0.1, SNOW, w / 2, 1.4, 0));
  return merge(p.map((g) => (g.index ? g.toNonIndexed() : g)));
}
/** The flag pole: a thin pole 1 tall (scaled to its height), a cross-piece the cloth hangs from at the top. */
export function buildFlagPole(): BufferGeometry {
  return merge([box(0.05, 1, 0.05, IRON, 0, 0.5, 0), box(0.06, 0.06, 0.06, '#2a3550', 0, 1.01, 0)]);
}
/**
 * The tattered cloth of the flag: 1.2 long (along +x from the pole) and 0.75 tall, its top edge at y = 0. Many small strips so it can
 * ripple; the free end is torn into ragged tails of different lengths, and there is a rip near the middle.
 */
export function buildFlagCloth(): BufferGeometry {
  const L = 1.2;
  const H = 0.75;
  const g = new PlaneGeometry(L, H, 12, 5).translate(L / 2, -H / 2, 0);
  const pos = g.getAttribute('position');
  const tears = [0.0, 0.32, 0.12, 0.42, 0.18, 0.3];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const row = Math.round((-y / H) * 5);
    // The last columns pull in by the tear of their row: a ragged free end.
    if (x > L * 0.7) pos.setX(i, x - tears[row]! * ((x - L * 0.7) / (L * 0.3)));
    // The bottom edge droops a little toward the free end.
    if (row === 5) pos.setY(i, y - 0.08 * (x / L) + 0.05 * Math.sin(x * 9));
  }
  pos.needsUpdate = true;
  return coloured(g.toNonIndexed(), '#3b4a6b');
}
/** A small ruined cottage far back on the horizon: low walls, a broken roof with snow, a bare chimney. Faded colours. Foot at y = 0. */
export function buildCottage(): BufferGeometry {
  const wall = '#2d3d5c';
  const p: BufferGeometry[] = [
    box(3.2, 1.9, 2.4, wall, 0, 0.95, 0, 0, 0, 0.03),
    prism([[-1.8, 1.9], [1.8, 1.9], [0.4, 3.0], [-0.2, 2.6], [-0.6, 3.1]], 2.5, '#22304c', 0, 0, 0),
    box(2.2, 0.18, 2.6, SNOW_BLUE, -0.6, 2.55, 0, 0, 0, 0.55),
    box(0.5, 1.5, 0.5, wall, 1.1, 2.6, -0.3, 0, 0, -0.1),
    box(0.55, 0.12, 0.55, SNOW, 1.15, 3.36, -0.3, 0, 0, -0.1),
    box(0.5, 0.7, 0.05, HOLE, -0.7, 1.0, 1.22),
    box(0.6, 1.1, 0.05, HOLE, 0.6, 0.55, 1.22),
    put(new IcosahedronGeometry(1.2, 1), SNOW_BLUE, 0.3, 0, 1.4, 0, 0, 0, 1.8, 0.35, 0.8),
  ];
  return merge(p.map((g) => (g.index ? g.toNonIndexed() : g)));
}
/** One puff of chimney smoke: a soft low-poly blob of unit size. */
export const buildSmokePuff = (): BufferGeometry => new IcosahedronGeometry(1, 1);
// ---------------------------------------------------------------------------------------------------------------------------------
// The scary things on the snow (one geometry per kind, foot at y = 0, front toward +z) and the far steeple
// ---------------------------------------------------------------------------------------------------------------------------------
const STATUE = '#5d6c86';
const STATUE_DARK = '#3e4a61';
const BARK = '#2b2a33';
const BARK_LIGHT = '#3d3b46';
/** A hooded stone angel on a pedestal, about 3 tall: a long robe, folded wings, the hood shading a cracked face, snow on head and wings. */
export function buildAngel(): BufferGeometry {
  const p: BufferGeometry[] = [
    box(1.1, 0.6, 1.0, STATUE_DARK, 0, 0.3, 0),
    box(1.25, 0.12, 1.15, SNOW, 0, 0.64, 0),
    put(new ConeGeometry(0.5, 1.75, 7), STATUE, 0, 1.5, 0),
    put(new SphereGeometry(0.3, 7, 5), STATUE, 0, 2.48, 0, 0, 0, 0, 1, 1.15, 1),
    put(new SphereGeometry(0.33, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), STATUE_DARK, 0, 2.5, -0.03, 0.25, 0, 0, 1.05, 1.2, 1.05),
    // The face in the shadow of the hood, with a dark crack running down it.
    ball(0.2, '#7b89a2', 0, 2.42, 0.17, 1, 1.2, 0.5, 6),
    box(0.03, 0.34, 0.03, HOLE, 0.04, 2.42, 0.27, 0, 0, 0.3),
    box(0.03, 0.14, 0.03, HOLE, -0.02, 2.33, 0.27, 0, 0, -0.5),
    ball(0.035, HOLE, -0.07, 2.47, 0.26, 1, 0.6, 0.5, 4),
    ball(0.035, HOLE, 0.07, 2.47, 0.26, 1, 0.6, 0.5, 4),
    // Hands folded in front.
    ball(0.13, STATUE, 0, 1.85, 0.36, 1.3, 0.8, 0.8, 5),
    // Snow on the hood.
    ball(0.26, SNOW, 0, 2.78, -0.02, 1.1, 0.4, 1.1, 6),
  ];
  for (const side of [-1, 1]) {
    p.push(prism([[0, 0], [0.75, 0.55], [0.6, 1.4], [0.15, 1.75], [0, 1.5]], 0.12, STATUE_DARK, 0, 0, 0).applyMatrix4(new Matrix4().makeRotationY(side < 0 ? Math.PI - 0.5 : 0.5)).translate(side * 0.18, 1.0, -0.25));
    p.push(box(0.5, 0.1, 0.16, SNOW, side * 0.42, 2.72, -0.42, 0, side * 0.5, side * -0.6));
  }
  // A broken corner of the pedestal.
  p.push(box(0.35, 0.25, 0.3, '#2f394c', 0.62, 0.12, 0.5, 0.2, 0.3, 0.5));
  return merge(p);
}
/** An open grave (the hole, the snow lip, the dug-up mound) with a shovel stuck upright in the mound. */
export function buildGraveWithShovel(): BufferGeometry {
  const grave = buildOpenGrave();
  const shovel = merge([
    box(0.07, 1.3, 0.07, '#4a3626', 0, 0.65, 0),
    box(0.3, 0.06, 0.06, '#4a3626', 0, 1.3, 0),
    box(0.34, 0.42, 0.04, '#6a7487', 0, -0.05, 0),
  ]).applyMatrix4(new Matrix4().makeRotationZ(0.18)).translate(0.35, 0.55, -2.0);
  return merge([grave, shovel]);
}
/** A coffin half under the snow: the six-sided box, a lid with a cross, snow along the top. About 2.2 long, along z. */
export function buildCoffin(): BufferGeometry {
  const pts: [number, number][] = [[-0.32, -1.1], [0.32, -1.1], [0.5, 0.45], [0.38, 1.1], [-0.38, 1.1], [-0.5, 0.45]];
  const shape = new Shape(pts.map(([x, z]) => new Vector2(x, z)));
  const body = put(new ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false }), '#3a2c2a', 0, 0.42, 0, Math.PI / 2, 0, 0);
  const lid = put(new ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), '#4b3833', 0, 0.5, 0, Math.PI / 2, 0, 0, 1.04, 1.04, 1);
  return merge([
    body.translate(0, -0.25, 0), lid.translate(0, -0.03, 0),
    box(0.08, 0.04, 0.7, '#8e7d63', 0, 0.5, 0.3), box(0.4, 0.04, 0.08, '#8e7d63', 0, 0.5, 0.45),
    put(new IcosahedronGeometry(0.5, 1), SNOW, 0.05, 0.42, -0.35, 0, 0, 0, 0.8, 0.25, 1.4),
    put(new IcosahedronGeometry(0.7, 1), SNOW_BLUE, 0.35, 0, 0.1, 0, 0, 0, 0.8, 0.45, 1.8),
  ]);
}
/** A skull and two bones poking out of a little heap of snow. */
export function buildBones(): BufferGeometry {
  return merge([
    buildSkull().applyMatrix4(new Matrix4().makeRotationX(-0.35)).scale(0.32, 0.32, 0.32).translate(0, 0.16, 0.05),
    cyl(0.035, 0.035, 0.6, 5, BONE, 0.3, 0.06, -0.05, Math.PI / 2, 0.6, 0),
    ball(0.06, BONE, 0.47, 0.06, -0.3, 1, 1, 1, 4), ball(0.06, BONE, 0.13, 0.06, 0.2, 1, 1, 1, 4),
    cyl(0.03, 0.03, 0.5, 5, BONE_DARK, -0.25, 0.05, 0.1, Math.PI / 2, -0.4, 0.2),
    put(new IcosahedronGeometry(0.45, 1), SNOW_BLUE, 0, -0.05, -0.1, 0, 0, 0, 1.2, 0.3, 0.9),
  ]);
}
/** A small frozen well: a ring of stones with a dark hole, two posts, a crossbar with a rope and a bucket, a little roof with snow. */
export function buildWell(): BufferGeometry {
  const p: BufferGeometry[] = [
    put(new CylinderGeometry(0.85, 0.9, 0.75, 9, 1, true), STONE, 0, 0.37, 0),
    put(new CylinderGeometry(0.7, 0.7, 0.75, 9, 1, true), STONE_DARK, 0, 0.37, 0),
    cyl(0.72, 0.72, 0.04, 9, '#101a2c', 0, 0.62, 0),
    put(new CylinderGeometry(0.95, 0.95, 0.12, 9, 1, true), SNOW, 0, 0.8, 0),
    box(0.12, 1.9, 0.12, WOOD_DARK, -0.8, 1.2, 0), box(0.12, 1.9, 0.12, WOOD_DARK, 0.8, 1.2, 0, 0, 0, -0.04),
    box(1.8, 0.09, 0.09, WOOD, 0, 1.85, 0),
    box(0.02, 0.6, 0.02, '#8e7d63', 0.1, 1.55, 0),
    cyl(0.13, 0.1, 0.2, 6, '#3c4762', 0.1, 1.2, 0),
    box(2.1, 0.08, 0.8, WOOD, 0, 2.25, 0.32, 0.55, 0, 0.03), box(2.1, 0.08, 0.8, WOOD, 0, 2.25, -0.32, -0.55, 0, 0.03),
    box(2.2, 0.14, 0.82, SNOW, 0, 2.33, 0.33, 0.55, 0, 0.03), box(2.2, 0.14, 0.82, SNOW, 0, 2.33, -0.33, -0.55, 0, 0.03),
    // Icicles under the roof.
    cone(0.05, 0.3, 4, '#d4ecff', -0.5, 1.93, 0.62, Math.PI, 0, 0), cone(0.05, 0.22, 4, '#d4ecff', 0.4, 1.97, 0.62, Math.PI, 0, 0),
  ];
  return merge(p);
}
/** A wooden cart stuck in the snow: the bed, one wheel sunk, the other broken, two shafts resting on the snow, snow piled inside. */
export function buildCart(): BufferGeometry {
  const wood = '#4a3a30';
  const wheel = (x: number, broken: boolean) => {
    const g: BufferGeometry[] = [put(new CylinderGeometry(0.55, 0.55, 0.08, 10, 1, true), '#3a2d26', x, 0.42, 0, 0, 0, Math.PI / 2)];
    for (let i = 0; i < (broken ? 3 : 6); i++) g.push(box(0.05, 1.0, 0.05, wood, x, 0.42, 0, (i * Math.PI) / 6, 0, 0));
    return g;
  };
  return merge([
    box(1.3, 0.1, 2.0, wood, 0, 0.72, 0, 0, 0, 0.06),
    box(0.08, 0.35, 2.0, wood, -0.65, 0.92, 0, 0, 0, 0.06), box(0.08, 0.35, 2.0, wood, 0.66, 0.96, 0, 0, 0, 0.06),
    box(1.3, 0.35, 0.08, wood, 0, 0.92, -1.0, 0, 0, 0.06),
    ...wheel(-0.75, false), ...wheel(0.8, true),
    box(0.07, 0.07, 1.6, wood, -0.35, 0.4, 1.7, -0.35, 0, 0), box(0.07, 0.07, 1.6, wood, 0.35, 0.4, 1.7, -0.35, 0, 0),
    put(new IcosahedronGeometry(0.6, 1), SNOW, 0, 0.85, -0.2, 0, 0, 0, 1.0, 0.4, 1.4),
    put(new IcosahedronGeometry(0.9, 1), SNOW_BLUE, -0.6, 0, 0.1, 0, 0, 0, 0.7, 0.5, 1.6),
  ]);
}
/** A broken tree stump with a jagged top, a cap of snow and a root or two. */
export function buildStump(): BufferGeometry {
  return merge([
    cyl(0.38, 0.5, 0.7, 7, BARK, 0, 0.35, 0),
    cone(0.2, 0.45, 4, BARK_LIGHT, 0.15, 0.85, 0.05, 0, 0, -0.2), cone(0.14, 0.3, 4, BARK_LIGHT, -0.18, 0.8, -0.1, 0, 0, 0.3),
    cyl(0.34, 0.36, 0.06, 7, '#5d5047', 0, 0.7, 0),
    put(new IcosahedronGeometry(0.33, 1), SNOW, -0.05, 0.74, 0, 0, 0, 0, 1, 0.3, 1),
    cyl(0.08, 0.12, 0.7, 5, BARK, 0.5, 0.08, 0.1, 0, 0, 1.3), cyl(0.07, 0.1, 0.6, 5, BARK, -0.3, 0.06, 0.45, 1.3, 0, 0.3),
    put(new IcosahedronGeometry(0.7, 1), SNOW_BLUE, 0, 0, 0, 0, 0, 0, 1.1, 0.25, 1.1),
  ]);
}
/** A fallen log half buried in snow, along x: bark, pale cut ends, a broken branch, a line of snow on top. About 2.5 long. */
export function buildLog(): BufferGeometry {
  return merge([
    cyl(0.28, 0.32, 2.5, 7, BARK, 0, 0.18, 0, 0, 0, Math.PI / 2),
    cyl(0.25, 0.25, 0.04, 7, '#6e5e50', -1.26, 0.18, 0, 0, 0, Math.PI / 2), cyl(0.29, 0.29, 0.04, 7, '#6e5e50', 1.26, 0.18, 0, 0, 0, Math.PI / 2),
    cyl(0.05, 0.08, 0.6, 5, BARK_LIGHT, 0.4, 0.55, 0.05, 0, 0, -0.5),
    box(2.3, 0.09, 0.32, SNOW, 0, 0.45, 0),
    put(new IcosahedronGeometry(0.8, 1), SNOW_BLUE, 0.3, -0.05, 0.25, 0, 0, 0, 1.8, 0.32, 0.7),
  ]);
}
/** A leaning iron cemetery gate: two stone pillars with snow caps, one leaf hanging askew, the other fallen in the snow. 3.4 wide. */
export function buildIronGate(): BufferGeometry {
  const leaf = buildGateLeaf();
  return merge([
    box(0.45, 2.1, 0.45, STONE, -1.6, 1.05, 0, 0, 0, 0.05), box(0.45, 1.7, 0.45, STONE, 1.6, 0.85, 0, 0, 0, -0.12),
    box(0.6, 0.16, 0.6, SNOW, -1.58, 2.15, 0, 0, 0, 0.05), box(0.6, 0.16, 0.6, SNOW, 1.7, 1.73, 0, 0, 0, -0.12),
    leaf.clone().applyMatrix4(new Matrix4().makeRotationZ(-0.16)).translate(-1.38, 0.05, 0),
    leaf.applyMatrix4(new Matrix4().makeRotationX(-1.35)).translate(0.2, 0.08, 0.3),
    box(0.5, 0.06, 0.5, STONE_DARK, 1.75, 0.03, 0.6, 0, 0.6, 0),
  ]);
}
/** The far ruined steeple: a dark church silhouette with a tall broken spire. About 9 tall. Faded colours. */
export function buildSteeple(): BufferGeometry {
  const c = '#1b2a46';
  return merge([
    box(4.2, 3.2, 3.0, c, 0, 1.6, 0),
    prism([[-2.3, 3.2], [2.3, 3.2], [0.9, 4.6], [0.2, 4.1], [-0.6, 4.9]], 3.2, '#16233c', 0, 0, 0),
    box(1.6, 5.8, 1.6, c, -2.4, 2.9, 0),
    cone(1.1, 3.2, 4, '#16233c', -2.4, 7.4, 0, 0.1, Math.PI / 4, 0.12),
    box(0.1, 0.8, 0.1, '#16233c', -2.2, 9.2, 0, 0, 0, 0.4), box(0.5, 0.1, 0.1, '#16233c', -2.15, 9.35, 0, 0, 0, 0.4),
    box(0.5, 0.9, 0.05, HOLE, -2.4, 4.6, 0.82),
    put(new IcosahedronGeometry(1.6, 1), SNOW_BLUE, 0.5, 0, 1.4, 0, 0, 0, 2.2, 0.35, 0.8),
  ]);
}
/** The faint lit windows of a far cottage (relative to `buildCottage`): two small panes, warm. */
export function buildCottageLights(): BufferGeometry {
  return merge([box(0.5, 0.5, 0.04, '#ffb26a', -0.7, 1.0, 1.25), box(0.32, 0.34, 0.04, '#ffcf8a', 0.95, 1.3, 1.25)]);
}
/** The lit window of the far steeple's belfry (relative to `buildSteeple`). */
export function buildSteepleLight(): BufferGeometry {
  return merge([box(0.4, 0.7, 0.04, '#9fd0ff', -2.4, 4.6, 0.85)]);
}
/**
 * A light low-poly snowy pine for the clusters, 1 tall (scaled to its height), foot at y = 0: a short trunk and four tiers of dark
 * needles, each tier with a cap of snow. About 140 triangles.
 */
export function buildSnowPine(): BufferGeometry {
  const needles = '#0d2236';
  const p: BufferGeometry[] = [cyl(0.025, 0.035, 0.16, 5, '#2a2224', 0, 0.08, 0)];
  const tiers: readonly (readonly [number, number, number])[] = [[0.23, 0.34, 0.27], [0.18, 0.3, 0.46], [0.13, 0.26, 0.64], [0.08, 0.22, 0.82]];
  tiers.forEach(([r, h, y], i) => {
    p.push(cone(r, h, 7, needles, 0, y, 0, 0, i * 0.4, 0));
    p.push(cone(r * 0.8, h * 0.45, 7, i % 2 ? SNOW : SNOW_BLUE, 0, y + h * 0.3, 0, 0, i * 0.4 + 0.2, 0));
  });
  return merge(p);
}
