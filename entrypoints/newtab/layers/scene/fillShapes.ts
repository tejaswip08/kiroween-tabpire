// The small shapes of the theme fill (`lib/scene/uniqueScenes/fill.ts`), built from simple pieces. Each is one merged geometry with a colour
// for every corner, so a whole kind (all the tufts, all the crosses ...) is one instanced draw call. No image files.
import { BoxGeometry, type BufferGeometry, CylinderGeometry, DataTexture, LinearFilter, PlaneGeometry, RGBAFormat, SphereGeometry } from 'three';
import type { ModelId } from '../../../../lib/scene/layout';
import type { FillTheme } from '../../../../lib/scene/uniqueScenes/fill';
import { at, ball, cone, mergePieces, stickBetween, type Piece } from './critterGeo';
import { buildScarecrow } from './themes/shapes';

type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const tube = (r: number, h: number, seg = 6) => new CylinderGeometry(r, r, h, seg);

/** Blades of grass in a ring, leaning outward: dead grass (Crypt), straw (Pumpkin Patch). */
function tuft(base: string, tip: string): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const h = 0.32 + 0.12 * ((i * 5) % 3);
    const lean = 0.28 + 0.1 * (i % 2);
    out.push({ geo: cone(0.045, h, 3), matrix: at(Math.sin(a) * 0.1, h / 2, Math.cos(a) * 0.1, 1, 1, 1, Math.cos(a) * lean, 0, -Math.sin(a) * lean), color: hex(i % 2 ? base : tip) });
  }
  return out;
}
/** Long arching fronds. */
function fern(): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const lean = 0.85;
    out.push({ geo: cone(0.09, 0.7, 3), matrix: at(Math.sin(a) * 0.22, 0.27, Math.cos(a) * 0.22, 1, 1, 0.45, Math.cos(a) * lean, 0, -Math.sin(a) * lean), color: hex(i % 2 ? '#2f6b3a' : '#3f8a4a') });
  }
  return out;
}
const cross = (): Piece[] => [
  { geo: box(0.1, 1.0, 0.1), matrix: at(0, 0.5, 0), color: hex('#6b5a48') },
  { geo: box(0.5, 0.1, 0.1), matrix: at(0, 0.72, 0), color: hex('#76644f') },
];
function toadstool(): Piece[] {
  const cap = new SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  return [
    { geo: tube(0.05, 0.2), matrix: at(0, 0.1, 0), color: hex('#d9d0bd') },
    { geo: cap, matrix: at(0, 0.18, 0, 1, 0.9, 1), color: hex('#b8344a') },
    { geo: ball(0.035, 5, 4), matrix: at(0.08, 0.34, 0.05), color: hex('#f4efe2') },
    { geo: ball(0.03, 5, 4), matrix: at(-0.09, 0.3, 0.06), color: hex('#f4efe2') },
    { geo: ball(0.03, 5, 4), matrix: at(0.01, 0.31, -0.11), color: hex('#f4efe2') },
  ];
}
/** Long axis along z. */
function wheelbarrow(): Piece[] {
  const wood = hex('#7a4a26');
  const dark = hex('#3a2a1c');
  return [
    { geo: box(0.55, 0.16, 0.8), matrix: at(0, 0.42, -0.05, 1, 1, 1, 0.12, 0, 0), color: wood },
    { geo: box(0.05, 0.22, 0.8), matrix: at(-0.29, 0.5, -0.05), color: wood },
    { geo: box(0.05, 0.22, 0.8), matrix: at(0.29, 0.5, -0.05), color: wood },
    { geo: tube(0.22, 0.08, 10), matrix: at(0, 0.22, 0.6, 1, 1, 1, 0, 0, Math.PI / 2), color: dark },
    { geo: stickBetween([-0.22, 0.4, -0.2], [-0.3, 0.62, -0.85], 0.035), color: wood },
    { geo: stickBetween([0.22, 0.4, -0.2], [0.3, 0.62, -0.85], 0.035), color: wood },
    { geo: stickBetween([-0.22, 0.4, -0.3], [-0.24, 0.0, -0.4], 0.03), color: wood },
    { geo: stickBetween([0.22, 0.4, -0.3], [0.24, 0.0, -0.4], 0.03), color: wood },
  ];
}
/** A fallen log along z, with moss on top and light ends. */
function log(): Piece[] {
  return [
    { geo: tube(0.3, 2.2, 8), matrix: at(0, 0.3, 0, 1, 1, 1, Math.PI / 2, 0, 0), color: hex('#4b3626') },
    { geo: tube(0.24, 0.06, 8), matrix: at(0, 0.3, 1.1, 1, 1, 1, Math.PI / 2, 0, 0), color: hex('#8a6a48') },
    { geo: ball(0.28, 6, 4), matrix: at(0.02, 0.56, -0.3, 1.1, 0.35, 2.2), color: hex('#4f7a3a') },
  ];
}
/** A root arching out of the ground. */
function root(): Piece[] {
  const c = hex('#3b2a22');
  return [
    { geo: stickBetween([-0.45, 0, -0.1], [-0.2, 0.35, 0], 0.09), color: c },
    { geo: stickBetween([-0.2, 0.35, 0], [0.15, 0.4, 0.1], 0.07), color: c },
    { geo: stickBetween([0.15, 0.4, 0.1], [0.45, 0.0, 0.25], 0.06), color: c },
    { geo: stickBetween([0.0, 0.38, 0.05], [0.2, 0.05, -0.45], 0.045), color: c },
  ];
}
const drift = (): Piece[] => [
  { geo: ball(1, 9, 5), matrix: at(0, -0.05, 0, 1, 0.45, 0.7), color: hex('#e8f1ff') },
  { geo: ball(1, 7, 4), matrix: at(0.45, -0.05, 0.25, 0.55, 0.3, 0.45), color: hex('#f4f9ff') },
];
/** A left and a right footprint. */
const prints = (): Piece[] => [
  { geo: tube(0.12, 0.02, 6), matrix: at(-0.14, 0.04, -0.2, 0.8, 1, 1.5), color: hex('#9db0cf') },
  { geo: tube(0.12, 0.02, 6), matrix: at(0.14, 0.04, 0.2, 0.8, 1, 1.5), color: hex('#9db0cf') },
];
/** A vine along the ground with leaves and a curl. */
function vine(): Piece[] {
  const g = hex('#4d6b2a');
  const leaf = hex('#6a9a38');
  const pts: [number, number, number][] = [[-1.0, 0.04, 0.1], [-0.5, 0.06, -0.15], [0, 0.05, 0.1], [0.5, 0.06, 0.4], [1.0, 0.05, 0.25]];
  const out: Piece[] = [];
  for (let i = 1; i < pts.length; i++) out.push({ geo: stickBetween(pts[i - 1]!, pts[i]!, 0.035, 5), color: g });
  for (const [x, z] of [[-0.6, -0.35], [-0.1, 0.35], [0.45, 0.1], [0.8, 0.55]] as const) out.push({ geo: ball(0.18, 6, 4), matrix: at(x, 0.1, z, 1, 0.25, 0.7, 0, x * 2, 0), color: leaf });
  out.push({ geo: ball(0.11, 6, 4), matrix: at(0.15, 0.1, 0.5), color: hex('#d9701c') });
  return out;
}
/** A weathered post with a crow on top. */
function postCrow(): Piece[] {
  const feather = hex('#1b1722');
  return [
    { geo: tube(0.09, 1.4, 6), matrix: at(0, 0.7, 0), color: hex('#5b3a1e') },
    { geo: ball(0.2, 8, 6), matrix: at(0, 1.62, 0, 1, 0.85, 1.5), color: feather },
    { geo: ball(0.11, 7, 5), matrix: at(0, 1.78, 0.25), color: feather },
    { geo: cone(0.04, 0.16, 4), matrix: at(0, 1.77, 0.4, 1, 1, 1, Math.PI / 2, 0, 0), color: hex('#d9a441') },
    { geo: cone(0.09, 0.4, 4), matrix: at(0, 1.55, -0.32, 1, 1, 0.5, -Math.PI / 2 - 0.3, 0, 0), color: feather },
  ];
}
/** A frosted shrub: a tuft of bare spiky twigs fanning out from the snow, white with frost at the tips, a little snow at its foot. */
function bush(): Piece[] {
  const twig = hex('#3d4556');
  const rime = hex('#dceaf8');
  const out: Piece[] = [{ geo: ball(0.32, 6, 4), matrix: at(0, 0.02, 0, 1.2, 0.3, 1.1), color: hex('#e8f1ff') }];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.3;
    const lean = 0.35 + 0.25 * ((i * 7) % 3) / 2;
    const len = 0.5 + 0.18 * ((i * 5) % 3);
    const tip: [number, number, number] = [Math.cos(a) * Math.sin(lean) * len, Math.cos(lean) * len + 0.05, Math.sin(a) * Math.sin(lean) * len];
    out.push({ geo: stickBetween([0, 0.02, 0], tip, 0.025, 3), color: twig });
    out.push({ geo: cone(0.035, 0.18, 3), matrix: at(tip[0], tip[1] + 0.05, tip[2], 1, 1, 1, 0, a, 0), color: rime });
  }
  return out;
}
/** A tombstone under a cap of snow, with a drift at its foot. */
function tomb(): Piece[] {
  const stone = hex('#7d8aa3');
  return [
    { geo: box(0.7, 0.8, 0.18), matrix: at(0, 0.4, 0), color: stone },
    { geo: tube(0.35, 0.18, 10), matrix: at(0, 0.8, 0, 1, 1, 1, Math.PI / 2, 0, 0), color: stone },
    { geo: tube(0.37, 0.1, 10), matrix: at(0, 1.02, 0, 1, 1, 1.35, Math.PI / 2, 0, 0), color: hex('#f4f9ff') },
    { geo: ball(0.45, 7, 4), matrix: at(0, 0.02, 0.12, 1, 0.3, 0.6), color: hex('#e8f1ff') },
  ];
}
/** A frozen iron lantern on a post: a warm flame behind icy glass (the flame is brighter than 1, so Bloom picks it up). */
function lamp(): Piece[] {
  const iron = hex('#2a2f3a');
  return [
    { geo: tube(0.05, 1.3, 6), matrix: at(0, 0.65, 0), color: iron },
    { geo: box(0.3, 0.32, 0.3), matrix: at(0, 1.45, 0), color: hex('#a9d8ff') },
    { geo: ball(0.09, 6, 4), matrix: at(0, 1.45, 0), color: [3.2, 2.2, 1.1] },
    { geo: cone(0.28, 0.2, 4), matrix: at(0, 1.72, 0, 1, 1, 1, 0, Math.PI / 4, 0), color: iron },
    { geo: ball(0.2, 6, 4), matrix: at(0, 1.8, 0, 1, 0.4, 1), color: hex('#f4f9ff') },
    { geo: cone(0.03, 0.22, 4), matrix: at(0.12, 1.2, 0.12, 1, 1, 1, Math.PI, 0, 0), color: hex('#d4ecff') },
    { geo: cone(0.03, 0.16, 4), matrix: at(-0.1, 1.22, -0.1, 1, 1, 1, Math.PI, 0, 0), color: hex('#d4ecff') },
  ];
}

const PIECES: Partial<Record<ModelId, (theme: FillTheme) => Piece[]>> = {
  fill_tuft: (t) => (t === 'pumpkin' ? tuft('#a8842f', '#d9b04a') : tuft('#6a6450', '#8f8868')),
  fill_fern: fern,
  fill_cross: cross,
  fill_toadstool: toadstool,
  fill_wheelbarrow: wheelbarrow,
  fill_log: log,
  fill_root: root,
  fill_drift: drift,
  fill_print: prints,
  fill_vine: vine,
  fill_postcrow: postCrow,
  fill_bush: bush,
  fill_tomb: tomb,
  fill_lamp: lamp,
};

/** The geometry of one fill shape for a theme. Fog is drawn by `fogGeometry`, the scarecrow by `buildScarecrow`. */
export function fillGeometry(model: ModelId, theme: FillTheme): BufferGeometry | null {
  if (model === 'fill_scarecrow') return buildScarecrow();
  const make = PIECES[model];
  return make ? mergePieces(make(theme)) : null;
}

/** A flat square for the ground fog, as wide as the catalogue footprint (2 x hx by 2 x hz). */
export function fogGeometry(): BufferGeometry {
  return new PlaneGeometry(4.4, 3.2).rotateX(-Math.PI / 2).translate(0, 0.12, 0);
}
/** A soft round alpha texture for the ground fog (made from numbers, no image file). */
export function fogTexture(size = 32): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      const a = Math.max(0, 1 - r);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}
