// The shapes of the haunted house in the Pumpkin Patch, built from boxes, cones and half a sphere with vertex colours. No
// model files. Local units: the floor is at y = 0, the front faces +z, the hill reaches down to y = -FLOOR_Y (the ground).
import { BoxGeometry, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, Shape, ShapeGeometry, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLOOR_Y, FOOTING_Y, HILL, PLAN } from '../../../../../lib/scene/uniqueScenes/house';
import { paint, trianglesOf } from './autumnBuild';

const WALL = '#2d1c2a';
const WALL_DARK = '#22141f';
const TRIM = '#1a0f18';
const ROOF = '#24192b';
const ROOF_DARK = '#1b1222';
const STONE = '#17101a';
const HILL_COLOR = '#1d1623';
/** The lit windows, before the flicker. */
export const GLOW_COLOR = '#e8963a';

const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;

/** A box, turned about its centre (x, y, z in radians) and then moved. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, rx = 0, ry = 0, rz = 0): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return paint(g, color);
}

/** A board hanging from its top edge at (x, y), turned by `angle` about that hinge (a broken shutter). */
function hanging(w: number, h: number, x: number, y: number, z: number, angle: number, color = TRIM): BufferGeometry {
  const g = new BoxGeometry(w, h, 0.05);
  g.translate(0, -h / 2, 0);
  g.applyMatrix4(new Matrix4().makeRotationZ(angle));
  g.translate(x, y, z);
  return paint(g, color);
}

const { width: W, depth: D, wallH, tower, roofRise: R, porch } = PLAN;
const FRONT = D / 2;
const TOWER_FRONT = tower.w / 2;

/** One window's dark frame and its two shutters (the left one askew, the right one hanging by a corner or gone). */
function frame(x: number, y: number, z: number, w: number, h: number, shutters: 'both' | 'left' | 'none'): BufferGeometry[] {
  const parts = [box(w + 0.16, h + 0.16, 0.05, x, y, z - 0.02, TRIM)];
  if (shutters === 'none') return parts;
  parts.push(hanging(w * 0.5, h * 0.95, x - w / 2 - 0.02, y + h / 2, z + 0.03, 0.06));
  if (shutters === 'both') parts.push(hanging(w * 0.5, h * 0.95, x + w / 2 + 0.02, y + h / 2, z + 0.03, 0.75));
  return parts;
}

/** Window panes: a thin box in front of the frame. Two groups, so they can flicker out of step. */
const pane = (x: number, y: number, z: number, w: number, h: number): BufferGeometry => paint(new BoxGeometry(w, h, 0.04).translate(x, y, z + 0.03), '#ffffff');

/** The dark hill: half an ellipsoid on the ground, wide and low. */
function hill(): BufferGeometry {
  const g = new SphereGeometry(1, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(HILL.rx, HILL.h, HILL.rz);
  g.translate(0, -FLOOR_Y, 0);
  return paint(g, HILL_COLOR);
}

/** The slope of a roof half: its angle and length from the wall top to the ridge, with the overhang. */
const SLOPE = Math.atan2(R, W / 2);
const SLOPE_LEN = Math.hypot(W / 2, R) + 0.45;

export interface HouseParts {
  /** The hill, footing, walls, roof, tower, chimney, porch and shutters (vertex colours). */
  body: BufferGeometry;
  /** Lit panes, two groups that flicker out of step (white, tinted by the material). */
  panesA: BufferGeometry;
  panesB: BufferGeometry;
}

export function buildHouse(): HouseParts {
  const body: BufferGeometry[] = [hill()];
  // The stone footing goes down into the hill, so the walls stand on it and nothing floats.
  body.push(box(W + 0.5, 0.1 + (FLOOR_Y - FOOTING_Y), D + 0.5, 0, -(FLOOR_Y - FOOTING_Y) / 2 + 0.05, 0, STONE));
  body.push(box(tower.w + 0.4, 0.1 + (FLOOR_Y - FOOTING_Y), tower.w + 0.4, tower.x, -(FLOOR_Y - FOOTING_Y) / 2 + 0.05, 0, STONE));
  // Walls: the main body, a belt between the storeys, corner posts.
  body.push(box(W, wallH, D, 0, wallH / 2, 0, WALL));
  body.push(box(W + 0.12, 0.14, D + 0.12, 0, wallH / 2, 0, TRIM));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.push(box(0.12, wallH, 0.12, sx * (W / 2), wallH / 2, sz * (D / 2), WALL_DARK));
  // Dark planks on the front, a few of them askew.
  [-1.2, -0.6, 0, 0.6, 1.2].forEach((x, i) => body.push(box(0.05, wallH - 0.2, 0.03, x, wallH / 2, FRONT + 0.01, WALL_DARK, 0, 0, i === 3 ? 0.012 : 0)));
  // Gable ends (front and back), in the wall colour.
  const tri = new Shape();
  tri.moveTo(-W / 2, 0);
  tri.lineTo(W / 2, 0);
  tri.lineTo(0, R);
  for (const z of [FRONT, -FRONT]) body.push(paint(new ShapeGeometry(tri).translate(0, wallH, z), WALL));
  // The steep, crooked roof: two slabs, the right one a little lower and flatter, a ridge beam that sags.
  body.push(box(SLOPE_LEN, 0.16, D + 0.6, -W / 4 - 0.02, wallH + R / 2 - 0.02, 0, ROOF, 0, 0, SLOPE + 0.03));
  body.push(box(SLOPE_LEN, 0.16, D + 0.6, W / 4 + 0.02, wallH + R / 2 - 0.16, 0, ROOF_DARK, 0, 0, -(SLOPE - 0.07)));
  body.push(box(0.2, 0.16, D + 0.75, 0.02, wallH + R + 0.02, 0, TRIM, 0, 0, 0.05));
  // The pointed tower on the right: a tall box, an eave, a cone roof that leans.
  body.push(box(tower.w, tower.h + 0.1, tower.w, tower.x, (tower.h + 0.1) / 2, 0, WALL_DARK));
  body.push(box(tower.w + 0.3, 0.12, tower.w + 0.3, tower.x, tower.h + 0.02, 0, TRIM));
  const spire = new ConeGeometry(tower.w * 0.78, tower.roofH, 4);
  spire.rotateY(Math.PI / 4);
  spire.translate(0, tower.roofH / 2, 0);
  spire.applyMatrix4(new Matrix4().makeRotationZ(-0.07));
  spire.translate(tower.x, tower.h + 0.05, 0);
  body.push(paint(spire, ROOF_DARK));
  body.push(box(0.04, 0.5, 0.04, tower.x - 0.16, tower.h + tower.roofH + 0.02, 0, TRIM, 0, 0, -0.1));
  // The leaning chimney, on the left slope, with a broken cap.
  const chim = new BoxGeometry(0.42, 2.0, 0.42);
  chim.translate(0, 1.0, 0);
  chim.applyMatrix4(new Matrix4().makeRotationZ(-0.13));
  chim.translate(-0.95, wallH + 0.6, -0.2);
  body.push(paint(chim, STONE));
  body.push(box(0.56, 0.12, 0.5, -1.2, wallH + 2.55, -0.2, TRIM, 0, 0.2, -0.13));
  // The small porch: a platform, steps, two crooked posts and a sagging roof.
  body.push(box(porch.w, porch.h, porch.d, porch.x, porch.h / 2, FRONT + porch.d / 2, ROOF_DARK));
  body.push(box(0.9, 0.12, 0.3, porch.x, 0.05, FRONT + porch.d + 0.12, ROOF_DARK));
  body.push(box(0.1, 1.55, 0.1, porch.x - porch.w / 2 + 0.08, 0.95, FRONT + porch.d - 0.1, TRIM, 0, 0, 0.04));
  body.push(box(0.1, 1.55, 0.1, porch.x + porch.w / 2 - 0.08, 0.95, FRONT + porch.d - 0.1, TRIM, 0, 0, -0.02));
  body.push(box(porch.w + 0.3, 0.1, porch.d + 0.3, porch.x, 1.78, FRONT + porch.d / 2 + 0.1, ROOF, 0.12, 0, 0.03));
  // The door, a dark slab with a gap.
  body.push(box(0.7, 1.5, 0.05, porch.x, 1.0, FRONT + 0.03, '#0f070d'));
  body.push(box(0.76, 0.1, 0.06, porch.x, 1.78, FRONT + 0.03, TRIM));
  // Windows: ground floor, first floor, a boarded one, the tower's, and the round attic one.
  const wx = -0.8;
  body.push(...frame(wx, 1.2, FRONT, 0.5, 0.8, 'both'));
  body.push(...frame(wx, 3.35, FRONT, 0.5, 0.8, 'left'));
  body.push(...frame(0.55, 3.35, FRONT, 0.5, 0.8, 'none'));
  body.push(box(0.62, 0.09, 0.06, 0.55, 3.35, FRONT + 0.04, WALL_DARK, 0, 0, 0.4));
  body.push(box(0.62, 0.09, 0.06, 0.55, 3.3, FRONT + 0.05, TRIM, 0, 0, -0.25));
  body.push(box(0.62, 0.09, 0.06, 0.55, 3.55, FRONT + 0.05, WALL_DARK, 0, 0, 0.1));
  body.push(...frame(tower.x, 3.5, TOWER_FRONT, 0.4, 0.9, 'both'));
  const attic = new CylinderGeometry(0.4, 0.4, 0.05, 10).rotateX(Math.PI / 2).translate(0, wallH + 0.95, FRONT - 0.02);
  body.push(paint(attic, TRIM));
  // Panes.
  const panesA = merge([pane(wx, 1.2, FRONT, 0.5, 0.8), pane(tower.x, 3.5, TOWER_FRONT, 0.4, 0.9)]);
  const round = paint(new CircleGeometry(0.3, 10).translate(0, wallH + 0.95, FRONT + 0.015), '#ffffff');
  const panesB = merge([pane(wx, 3.35, FRONT, 0.5, 0.8), round]);
  return { body: merge(body), panesA, panesB };
}

/** Triangles of one house, for the budget. */
export const houseTriangles = (): number => {
  const h = buildHouse();
  const n = trianglesOf(h.body) + trianglesOf(h.panesA) + trianglesOf(h.panesB);
  h.body.dispose();
  h.panesA.dispose();
  h.panesB.dispose();
  return n;
};

