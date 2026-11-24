// Shapes of the Frozen Cemetery, built from simple low-poly parts (boxes, cones, spheres, prisms), each merged into one geometry with
// flat vertex colours, so every shape is one draw call (or one instanced mesh). No image files, no new models.
import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, ExtrudeGeometry, IcosahedronGeometry, Matrix4, Quaternion, Shape, ShapeGeometry,
  SphereGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHAPEL_DOOR, CROSS, LANTERN_POST, SLAB } from '../../../../../lib/scene/uniqueScenes/frostPlan';
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
// ---------------------------------------------------------------------------------------------------------------------------------
// The chapel
// ---------------------------------------------------------------------------------------------------------------------------------
const STONE = '#3d4d68';
const STONE_DARK = '#2b3850';
const STONE_LIGHT = '#516383';
const SNOW = '#f3f8ff';
const SNOW_BLUE = '#dbe8fb';
/**
 * The ruined chapel, one merged geometry, base at y = 0 (the walls go on down to -0.7, so it stands half-buried), front (the door) toward +z,
 * about 9 units tall with its cross. A pointed roof broken open at the front with bare rafters, a bell tower at the back left with a
 * broken spire and a crooked cross, snow piled on the walls, the roof and round the foot.
 */
export function buildChapel(): BufferGeometry {
  const p: BufferGeometry[] = [];
  const low = -0.7;
  const top = 3.4;
  const mid = (a: number, b: number) => (a + b) / 2;
  const wallH = top - low;
  // Walls: left, right (broken toward the front), back, and the front on both sides of the door and above it.
  p.push(box(0.6, wallH, 8, STONE, -3.4, mid(low, top), 0));
  p.push(box(0.6, wallH, 5, STONE, 3.4, mid(low, top), -1.5));
  p.push(box(0.6, 2.6 - low, 3, STONE_DARK, 3.4, mid(low, 2.6), 2.5));
  p.push(box(0.6, 0.7, 1.1, STONE, 3.4, 2.95, 2.9, 0, 0.2, 0.15));
  p.push(box(7.4, wallH, 0.6, STONE_DARK, 0, mid(low, top), -3.7));
  p.push(box(2.7, wallH, 0.6, STONE, -2.35, mid(low, top), 3.7));
  p.push(box(2.7, wallH, 0.6, STONE, 2.35, mid(low, top), 3.7));
  p.push(box(2.0, top - CHAPEL_DOOR.wall, 0.6, STONE_LIGHT, 0, mid(CHAPEL_DOOR.wall, top), 3.7));
  // Door frame stones and a step.
  p.push(box(0.22, CHAPEL_DOOR.wall, 0.7, STONE_LIGHT, -1.0, CHAPEL_DOOR.wall / 2, 3.72));
  p.push(box(0.22, CHAPEL_DOOR.wall, 0.7, STONE_LIGHT, 1.0, CHAPEL_DOOR.wall / 2, 3.72));
  p.push(box(2.4, 0.2, 1.0, STONE_DARK, 0, 0.05, 4.4));
  // Buttresses on the left side.
  for (const z of [-2.4, 0, 2.4]) p.push(box(0.55, 2.8, 0.7, STONE_LIGHT, -3.95, 0.7, z));
  // Gables: the front one is broken open at the top, the back one is whole.
  p.push(prism([[-3.7, top], [-3.7, top + 0.2], [-0.5, 5.5], [0.1, 4.8], [0.7, 5.4], [1.5, 4.3], [3.7, top]], 0.5, STONE, 0, 0, 3.45));
  p.push(prism([[-3.7, top], [3.7, top], [0, 5.9]], 0.5, STONE_DARK, 0, 0, -3.45));
  // Roof: the left slope is whole at the back and open at the front; the right slope is mostly gone. Bare rafters stick out.
  const slope = 0.5527;
  const roofLen = 4.7;
  const roofY = 4.6;
  p.push(box(roofLen, 0.22, 5.2, '#2d3a55', -1.95, roofY, -1.4, 0, 0, slope));
  p.push(box(roofLen - 0.4, 0.14, 5.0, SNOW, -1.95, roofY + 0.22, -1.4, 0, 0, slope));
  p.push(box(roofLen, 0.22, 2.4, '#2d3a55', 1.95, roofY, -2.8, 0, 0, -slope));
  p.push(box(roofLen - 0.4, 0.14, 2.3, SNOW, 1.95, roofY + 0.22, -2.8, 0, 0, -slope));
  for (const z of [1.7, 2.9]) p.push(box(roofLen, 0.16, 0.16, '#1c2437', -1.95, roofY, z, 0, 0, slope));
  for (const [z, len] of [[-0.2, 4.6], [1.1, 4.3], [2.4, 2.2], [3.3, 3.2]] as const) {
    p.push(box(len, 0.16, 0.16, '#1c2437', 1.95 + (4.7 - len) / 2 * 0.8, roofY + (4.7 - len) / 2 * 0.5, z, 0, 0, -slope));
  }
  p.push(box(0.18, 0.18, 7.6, '#1c2437', 0, 5.75, 0));
  // Snow on the wall tops and heaped round the foot (squashed rough balls, half buried).
  p.push(box(0.9, 0.22, 8.2, SNOW, -3.4, top + 0.12, 0));
  p.push(box(0.9, 0.22, 5.2, SNOW, 3.4, top + 0.12, -1.5));
  p.push(box(7.6, 0.22, 0.9, SNOW, 0, top + 0.12, -3.7));
  const heaps: readonly (readonly [number, number, number, number])[] = [
    [-3.8, 4.6, 1.7, 0.7], [-1.9, 5.0, 1.2, 0.5], [2.1, 5.1, 1.3, 0.55], [4.0, 4.3, 1.8, 0.8], [4.4, 1.0, 1.7, 0.75], [4.5, -2.4, 1.6, 0.8],
    [-4.6, 0.4, 1.7, 0.8], [-4.7, 3.2, 1.5, 0.7], [-1.0, -4.6, 2.2, 0.8], [2.4, -4.5, 1.8, 0.7], [0.3, 5.2, 0.9, 0.35],
  ];
  for (const [x, z, r, h] of heaps) p.push(put(new IcosahedronGeometry(r, 1), SNOW_BLUE, x, 0, z, 0, 0, 0, 1.2, h, 1));
  // Bell tower at the back left: a stout square tower, a belfry opening, a broken spire and a crooked cross.
  const tx = -3.9;
  const tz = -2.4;
  p.push(box(2.6, 6.2 + 0.7 + 0.0, 2.6, STONE, tx, mid(low, 6.2), tz));
  p.push(box(2.9, 0.3, 2.9, STONE_LIGHT, tx, 4.6, tz));
  p.push(box(1.2, 1.5, 0.15, '#04070d', tx, 5.35, tz + 1.3));
  p.push(prism([[-0.6, 0], [0.6, 0], [0, 0.8]], 0.15, '#04070d', tx, 6.1 - 0.0, tz + 1.3));
  p.push(box(1.0, 0.1, 0.5, '#04070d', tx, 4.72, tz + 1.4));
  p.push(box(2.9, 0.22, 2.9, SNOW, tx, 6.32, tz));
  p.push(cone(2.0, 2.0, 4, '#26324b', tx + 0.1, 7.35, tz, 0.12, Math.PI / 4, 0.1));
  p.push(cone(1.65, 0.5, 4, SNOW, tx + 0.1, 8.15, tz, 0.12, Math.PI / 4, 0.1));
  // The crooked cross, leaning on the tip of the spire.
  p.push(box(0.14, 1.1, 0.14, '#cfd9ea', tx + 0.3, 8.75, tz, 0, 0, 0.38));
  p.push(box(0.7, 0.14, 0.14, '#cfd9ea', tx + 0.34, 8.95, tz, 0, 0, 0.38));
  // A jagged hole in the spire: dark.
  p.push(box(0.5, 0.7, 0.1, '#04070d', tx + 0.3, 7.2, tz + 0.95, 0, 0, 0.3));
  return merge(p);
}
/** The pointed doorway (a flat shape, local origin at the middle of its foot) in front of the chapel door. */
export function buildDoorway(): BufferGeometry {
  const w = CHAPEL_DOOR.width / 2;
  const shape = new Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(-w, CHAPEL_DOOR.wall);
  shape.lineTo(0, CHAPEL_DOOR.point + 0.35);
  shape.lineTo(w, CHAPEL_DOOR.wall);
  shape.lineTo(w, 0);
  shape.closePath();
  return new ShapeGeometry(shape);
}
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
/** An iron lantern on a post (about 2.9 tall): a thin post, a hook, a four-bar cage with a pointed roof capped with snow. The flame is separate. */
export function buildLanternPost(): BufferGeometry {
  const y = LANTERN_POST.flameY;
  return merge([
    box(0.36, 0.14, 0.36, IRON, 0, 0.07, 0),
    box(0.1, LANTERN_POST.h, 0.1, IRON, 0, LANTERN_POST.h / 2, 0),
    box(0.55, 0.06, 0.06, IRON, 0.2, LANTERN_POST.h - 0.05, 0),
    ...cage(0, y - 0.0, 0.0),
  ]);
}
/** The four bars, floor and pointed roof of a lantern cage centred on (x, y, z). */
function cage(x: number, y: number, z: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) out.push(box(0.05, 0.5, 0.05, IRON, x + dx * 0.19, y, z + dz * 0.19));
  out.push(box(0.46, 0.05, 0.46, IRON, x, y - 0.27, z));
  out.push(box(0.46, 0.05, 0.46, IRON, x, y + 0.27, z));
  out.push(cone(0.36, 0.3, 4, IRON, x, y + 0.44, z, 0, Math.PI / 4, 0));
  out.push(cone(0.3, 0.1, 4, SNOW, x, y + 0.53, z, 0, Math.PI / 4, 0));
  out.push(box(0.1, 0.12, 0.1, IRON, x, y + 0.62, z));
  return out;
}
/** The lit part of a lantern (a small box, drawn unlit and bright so it blooms). */
export const buildFlameBox = (): BufferGeometry => new BoxGeometry(0.28, 0.36, 0.28).translate(0, LANTERN_POST.flameY, 0);
/** An empty lantern hanging from a chain, top of the chain at y = 0, the cage under it. Dark inside, no flame. */
export function buildHangingLantern(): BufferGeometry {
  return merge([box(0.03, 0.6, 0.03, IRON, 0, -0.3, 0), ...cage(0, -0.95, 0), box(0.2, 0.28, 0.2, '#0b1220', 0, -0.95, 0)]);
}
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
/** A frozen skeleton for the inside of an ice pillar, about 3.3 tall, arms raised as if it were still clawing at the ice. Near black. */
export function buildFrozenSkeleton(): BufferGeometry {
  const c = '#0a1424';
  const c2 = '#13203a';
  const p: BufferGeometry[] = [ball(0.27, c, 0, 3.05, 0, 1, 1.05, 0.95, 6), box(0.3, 0.2, 0.28, c2, 0, 2.72, 0.02), box(0.1, 1.2, 0.1, c, 0, 1.95, 0)];
  for (let i = 0; i < 5; i++) p.push(box(0.8 - i * 0.07, 0.07, 0.34 - i * 0.02, c, 0, 2.5 - i * 0.2, 0.03));
  p.push(box(0.55, 0.22, 0.3, c2, 0, 1.3, 0));
  // Arms: one reaching straight up, one reaching out and up.
  p.push(cyl(0.05, 0.06, 1.0, 5, c, 0.5, 2.9, 0, 0, 0, -0.5), cyl(0.045, 0.05, 0.9, 5, c, 0.9, 3.55, 0, 0, 0, -0.1));
  p.push(cyl(0.05, 0.06, 0.9, 5, c, -0.5, 2.6, 0, 0, 0, 1.0), cyl(0.045, 0.05, 0.9, 5, c, -1.0, 2.95, 0, 0, 0, 0.35));
  // Legs, one bent.
  p.push(cyl(0.06, 0.07, 1.25, 5, c, 0.2, 0.7, 0, 0, 0, 0.08), cyl(0.06, 0.07, 1.2, 5, c, -0.25, 0.68, 0, 0, 0, -0.18));
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
/** The block of ice round a frozen skeleton: a six-sided pillar a little wider at the foot, 4.4 tall. Foot at y = 0. */
export const buildIcePillar = (): BufferGeometry => new CylinderGeometry(1.05, 1.28, 4.4, 6, 1).translate(0, 2.2, 0);
/** Snow heaped on the top of the pillar. */
export const buildPillarCap = (): BufferGeometry => merge([cyl(1.12, 1.0, 0.3, 6, SNOW, 0, 4.5, 0), put(new IcosahedronGeometry(0.6, 0), SNOW_BLUE, 0.1, 4.7, 0.05, 0, 0.2, 0, 1.1, 0.6, 1)]);
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
/** A snowy owl's body, looking along +z: round white body with a few dark bars, short tail. Foot at y = 0, about 0.7 tall with the head. */
export function buildOwlBody(): BufferGeometry {
  const w = '#f4f8ff';
  const bar = '#6e7a90';
  return merge([
    ball(0.3, w, 0, 0.3, 0, 1, 1.25, 0.95, 7),
    box(0.2, 0.04, 0.02, bar, 0, 0.32, 0.27), box(0.26, 0.04, 0.02, bar, 0, 0.22, 0.28), box(0.18, 0.04, 0.02, bar, 0, 0.12, 0.27),
    box(0.16, 0.28, 0.1, w, 0, 0.2, -0.27, 0.3, 0, 0),
    cone(0.04, 0.12, 3, '#ffb347', 0.11, 0.02, 0.14, Math.PI / 2, 0, 0),
    cone(0.04, 0.12, 3, '#ffb347', -0.11, 0.02, 0.14, Math.PI / 2, 0, 0),
  ]);
}
/** The owl's head (pivot at the neck, so it can turn): a round head, two big yellow eyes, a small beak. */
export function buildOwlHead(): BufferGeometry {
  const w = '#f4f8ff';
  return merge([
    ball(0.22, w, 0, 0.18, 0, 1.1, 1, 1, 7),
    ball(0.065, '#ffd23a', -0.09, 0.2, 0.17, 1, 1, 0.6, 5), ball(0.065, '#ffd23a', 0.09, 0.2, 0.17, 1, 1, 0.6, 5),
    ball(0.028, '#05070d', -0.09, 0.2, 0.215, 1, 1, 0.6, 4), ball(0.028, '#05070d', 0.09, 0.2, 0.215, 1, 1, 0.6, 4),
    cone(0.04, 0.09, 3, '#d98a2a', 0, 0.12, 0.2, Math.PI / 2, 0, 0),
  ]);
}
