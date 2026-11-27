// The shapes of the Pumpkin Patch's far scenery, built from boxes, cones and cylinders with vertex colours. No model files.
// The one-off things (hills, farmhouses, steeple, water tower, wagon, well, shed) are merged in world space into one
// geometry; the repeated ones (village houses, trees, crows, scarecrows, fence, hay) are one local geometry each, drawn
// instanced. The heights match `FAR_HEIGHT` in `lib/scene/uniqueScenes/pumpkinFar.ts`.
import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, IcosahedronGeometry, Matrix4, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { FAR_SEED, type FarThing, type PumpkinFar } from '../../../../../lib/scene/uniqueScenes/pumpkinFar';
import { paint } from './autumnBuild';

const HILL = '#2a1624';
const WALL = '#2b1a24';
const ROOF = '#1d1220';
const WOOD = '#3a2416';
const WOOD_DARK = '#24160e';
const STONE = '#3a2e30';
const HAY = '#b58a3a';
const HAY_DARK = '#8a6528';
const STRAW = '#c29a48';
const CLOTH = '#5a2a1c';
const CROW = '#0d080c';

const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
/** A shape turned (x, y, z radians) about its centre, then moved, then painted. */
function put(g: BufferGeometry, x: number, y: number, z: number, color: string, rx = 0, ry = 0, rz = 0): BufferGeometry {
  g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return paint(g, color);
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rx = 0, ry = 0, rz = 0) => put(new BoxGeometry(w, h, d), x, y, z, color, rx, ry, rz);
const cyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, color: string, sides = 6, rx = 0, rz = 0) =>
  put(new CylinderGeometry(r1, r0, h, sides, 1), x, y, z, color, rx, 0, rz);
/** A gable roof: a triangular prism along x. */
function gable(w: number, d: number, rise: number, y: number, color: string): BufferGeometry {
  const g = new CylinderGeometry(1, 1, w, 3, 1);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  g.scale(1, rise / 1.5, d / 1.73);
  g.translate(0, y + rise / 3, 0);
  return paint(g, color);
}
/** The matrix of a far thing: stand, lean (about z), turn, scale. */
export function thingMatrix(t: FarThing, y = 0): Matrix4 {
  const q = new Quaternion().setFromEuler(new Euler(0, t.rotY, t.lean, 'YXZ'));
  return new Matrix4().compose(new Vector3(t.x, y, t.z), q, new Vector3(t.scale, t.scale, t.scale));
}
const placed = (g: BufferGeometry, t: FarThing) => g.applyMatrix4(thingMatrix(t));

// ---------- far back ----------
/** A crooked farmhouse: two storeys, a steep sagging roof and a chimney (4.6 high). Windows separately. */
function farmhouse(): BufferGeometry {
  return merge([box(3.6, 2.8, 2.6, 0, 1.4, 0, WALL), gable(4.0, 3.0, 1.8, 2.8, ROOF), box(0.4, 1.2, 0.4, 1.1, 4.0, -0.3, ROOF, 0, 0, 0.08), box(1.3, 1.6, 1.4, -2.2, 0.8, 0.2, WALL, 0, 0, -0.04)]);
}
const farmhouseWindows = (): BufferGeometry => merge([box(0.45, 0.5, 0.05, -0.9, 1.0, 1.32, '#ffffff'), box(0.45, 0.5, 0.05, 0.8, 2.1, 1.32, '#ffffff'), box(0.35, 0.4, 0.05, -2.2, 0.9, 0.93, '#ffffff')]);
/** An old church: a nave, a square tower and a tall spire with a small cross (9.5 high). */
function steeple(): BufferGeometry {
  return merge([
    box(2.2, 2.4, 4.2, 0, 1.2, -1.6, WALL), gable(4.6, 2.5, 1.2, 2.4, ROOF).rotateY(Math.PI / 2).translate(0, 0, -1.6),
    box(1.5, 4.4, 1.5, 0, 2.2, 0.8, WALL), put(new ConeGeometry(1.0, 4.2, 4), 0, 6.5, 0.8, ROOF, 0, Math.PI / 4, 0),
    box(0.08, 0.8, 0.08, 0, 9.0, 0.8, ROOF), box(0.45, 0.08, 0.08, 0, 9.15, 0.8, ROOF),
  ]);
}
const steepleWindows = (): BufferGeometry => box(0.35, 0.6, 0.05, 0, 3.4, 1.57, '#ffffff');
/** A water tower: four splayed legs, a round tank and a cone roof (8.2 high). */
function waterTower(): BufferGeometry {
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl(0.08, 0.08, 5.2, sx * 0.85, 2.6, sz * 0.85, WOOD_DARK, 4, -sz * 0.06, sx * 0.06)));
  return merge([...legs, box(1.9, 0.08, 0.08, 0, 2.4, 0.85, WOOD_DARK), box(0.08, 0.08, 1.9, 0.85, 3.4, 0, WOOD_DARK), cyl(1.25, 1.25, 1.8, 0, 6.0, 0, WOOD, 8), put(new ConeGeometry(1.4, 1.3, 8), 0, 7.55, 0, ROOF)]);
}
/** A small village house (3.2 high), instanced. */
export const villageHouse = (): BufferGeometry => merge([box(2.2, 1.8, 1.8, 0, 0.9, 0, WALL), gable(2.5, 2.1, 1.3, 1.8, ROOF), box(0.3, 0.7, 0.3, 0.6, 2.75, 0, ROOF)]);
export const villageWindows = (): BufferGeometry => merge([box(0.35, 0.4, 0.05, -0.5, 0.95, 0.92, '#ffffff'), box(0.35, 0.4, 0.05, 0.5, 0.95, 0.92, '#ffffff')]);

// ---------- near the field edges ----------
/** A hay wagon: a flat bed of planks on four wheels, a heap of hay and a tongue (2.2 high). */
function wagon(): BufferGeometry {
  const wheels = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => put(new CylinderGeometry(0.5, 0.5, 0.12, 6, 1), sx * 1.3, 0.5, sz * 0.8, WOOD_DARK, Math.PI / 2)));
  return merge([...wheels, box(3.4, 0.15, 1.6, 0, 0.95, 0, WOOD), box(3.4, 0.4, 0.08, 0, 1.2, 0.78, WOOD), box(3.4, 0.4, 0.08, 0, 1.2, -0.78, WOOD), put(new SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.5, 0.9, 0.7), 0, 1.0, 0, HAY), box(1.8, 0.08, 0.08, -2.5, 0.6, 0, WOOD_DARK, 0, 0, 0.25)]);
}
/** An old stone well with two posts, a crossbar and a little roof (2.4 high). */
function well(): BufferGeometry {
  return merge([cyl(0.75, 0.75, 0.8, 0, 0.4, 0, STONE, 10), box(0.1, 1.6, 0.1, -0.7, 1.4, 0, WOOD_DARK), box(0.1, 1.6, 0.1, 0.7, 1.4, 0, WOOD_DARK), box(1.5, 0.08, 0.08, 0, 1.8, 0, WOOD_DARK), gable(1.7, 1.1, 0.5, 2.0, ROOF)]);
}
/** A small leaning shed with a plank door (3 high). */
function shed(): BufferGeometry {
  return merge([box(2.6, 2.0, 2.2, 0, 1.0, 0, WOOD), gable(2.9, 2.5, 1.0, 2.0, ROOF), box(0.8, 1.4, 0.05, 0.4, 0.7, 1.12, WOOD_DARK)]);
}

/** One broken fence section: two posts and two rails, one rail hanging loose (1.1 high), instanced. */
export const fenceSection = (): BufferGeometry =>
  merge([box(0.14, 1.1, 0.14, -1.1, 0.55, 0, WOOD_DARK), box(0.14, 0.9, 0.14, 1.1, 0.45, 0, WOOD_DARK, 0, 0, 0.12), box(2.3, 0.1, 0.06, 0, 0.85, 0, WOOD), box(1.4, 0.1, 0.06, -0.5, 0.4, 0, WOOD, 0, 0, -0.35)]);
/** Three stacked hay bales: two below, one on top (1.6 high), instanced. */
export const hayStack = (): BufferGeometry => merge([box(1.1, 0.55, 0.7, -0.58, 0.28, 0, HAY), box(1.1, 0.55, 0.7, 0.58, 0.28, 0, HAY_DARK), box(1.1, 0.55, 0.7, 0, 0.83, 0.05, HAY, 0, 0.2, 0), box(0.9, 0.35, 0.6, 0.1, 1.28, 0, HAY_DARK, 0, -0.3, 0)]);

// ---------- middle back ----------
/** Where crows can sit on a dead tree (local units, before scale): on the right branch, the left branch and the upper branch, about three quarters out. */
export const CROW_PERCHES: readonly [number, number, number][] = [[1.11, 3.7, 0], [-0.92, 4.1, 0], [0.7, 5.35, 0.22]];
/** A bare twisted dead tree: a leaning trunk and crooked branches (6 high), instanced. */
export function deadTree(): BufferGeometry {
  const branch = (len: number, x: number, y: number, z: number, rz: number, rx = 0) => {
    const g = new CylinderGeometry(0.04, 0.1, len, 4, 1);
    g.translate(0, len / 2, 0);
    g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, 0, rz)));
    g.translate(x, y, z);
    return paint(g, WOOD_DARK);
  };
  return merge([
    cyl(0.32, 0.18, 2.6, 0, 1.3, 0, WOOD_DARK, 6), cyl(0.18, 0.08, 2.2, 0.15, 3.65, 0, WOOD_DARK, 5, 0, -0.12),
    branch(1.6, 0.1, 3.0, 0, -1.0), branch(1.5, 0, 3.4, 0.1, 0.95), branch(1.2, 0.3, 4.6, 0, -0.5, 0.3), branch(0.9, 1.0, 4.0, 0, -0.2),
  ]);
}
/** A small sitting crow (about 0.4 long), instanced. */
export const crow = (): BufferGeometry =>
  merge([put(new IcosahedronGeometry(0.16, 0), 0, 0.16, 0, CROW).scale(1.4, 1, 1), put(new IcosahedronGeometry(0.09, 0), 0.2, 0.3, 0, CROW), put(new ConeGeometry(0.03, 0.1, 3), 0.31, 0.3, 0, '#2a1a10', 0, 0, -Math.PI / 2), box(0.22, 0.03, 0.1, -0.27, 0.16, 0, CROW, 0, 0, 0.3)]);
/** An autumn tree: a short trunk and three clumps of orange and red leaves (5.2 high), instanced. */
export function autumnTree(): BufferGeometry {
  return merge([
    cyl(0.25, 0.15, 2.4, 0, 1.2, 0, WOOD, 6),
    put(new IcosahedronGeometry(1.5, 0), 0, 3.6, 0, '#c4501c'), put(new IcosahedronGeometry(1.1, 0), -1.0, 3.0, 0.3, '#a8281a'), put(new IcosahedronGeometry(1.0, 0), 0.9, 3.2, -0.2, '#e07a26'),
  ]);
}
/** A scarecrow on a pole: pole, crossbar, sack head, hat and a ragged shirt (3 high), instanced. */
export function scarecrow(): BufferGeometry {
  return merge([
    box(0.12, 3, 0.12, 0, 1.5, 0, WOOD_DARK), box(1.8, 0.1, 0.1, 0, 2.2, 0, WOOD_DARK), box(0.8, 0.9, 0.35, 0, 1.85, 0, CLOTH, 0, 0, 0.05),
    put(new IcosahedronGeometry(0.28, 0), 0, 2.6, 0, STRAW), put(new ConeGeometry(0.4, 0.5, 6), 0, 2.95, 0, ROOF), cyl(0.55, 0.55, 0.04, 0, 2.78, 0, ROOF, 6),
  ]);
}

// ---------- hills, haze ----------
function hill(x: number, z: number, rx: number, rz: number, h: number): BufferGeometry {
  const g = new SphereGeometry(1, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(rx, h, rz);
  g.translate(x, 0, z);
  return paint(g, HILL);
}
/** The ground mist: a wide band per layer, opaque at the foot and clear at the top (colour RGBA). */
export function mistBands(far: PumpkinFar, color: [number, number, number]): BufferGeometry {
  const parts = far.mist.map((m) => {
    const g = new PlaneGeometry(m.w, m.h, 1, 1).translate(m.x, m.h / 2, m.z);
    g.deleteAttribute('uv');
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) col.set([...color, pos.getY(i) < 0.01 ? m.alpha : 0], i * 4);
    g.setAttribute('color', new BufferAttribute(col, 4));
    return g.toNonIndexed();
  });
  return mergeGeometries(parts)!;
}

/** Everything the far scenery draws, ready for the meshes. */
export function buildPumpkinFarShapes(far: PumpkinFar) {
  const statics = merge([
    ...far.hills.map((h) => hill(h.x, h.z, h.rx, h.rz, h.h)),
    ...far.farmhouses.map((t) => placed(farmhouse(), t)),
    placed(steeple(), far.steeple),
    placed(waterTower(), far.waterTower),
    placed(wagon(), far.wagon),
    placed(well(), far.well),
    placed(shed(), far.shed),
  ]);
  const windows = merge([...far.farmhouses.map((t) => placed(farmhouseWindows(), t)), placed(steepleWindows(), far.steeple)]);
  // Crows sit on the perches of the trees that have them, each turned its own way (seeded).
  const rng = mulberry32(FAR_SEED + 11);
  const crows: Matrix4[] = [];
  for (const t of far.deadTrees) {
    const m = thingMatrix(t);
    for (let i = 0; i < t.crows; i++) {
      const [x, y, z] = CROW_PERCHES[i % CROW_PERCHES.length]!;
      const p = new Vector3(x, y, z).applyMatrix4(m);
      crows.push(new Matrix4().compose(p, new Quaternion().setFromEuler(new Euler(0, rng() * Math.PI * 2, 0)), new Vector3(t.scale, t.scale, t.scale)));
    }
  }
  return {
    statics,
    windows,
    village: { geo: villageHouse(), win: villageWindows(), at: far.village.map((t) => thingMatrix(t)) },
    deadTrees: { geo: deadTree(), at: far.deadTrees.map((t) => thingMatrix(t)) },
    crows: { geo: crow(), at: crows },
    autumnTrees: { geo: autumnTree(), at: far.autumnTrees.map((t) => thingMatrix(t)) },
    scarecrows: { geo: scarecrow(), at: far.scarecrows.map((t) => thingMatrix(t)) },
    fence: { geo: fenceSection(), at: far.fence.map((t) => thingMatrix(t)) },
    hay: { geo: hayStack(), at: far.hayStacks.map((t) => thingMatrix(t)) },
  };
}
