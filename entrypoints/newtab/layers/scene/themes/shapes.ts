// Shapes the unique theme scenes build themselves: a scarecrow, a track ribbon and the painted ground. No image files.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../../../../lib/scene/rng';
import type { PlatformStep } from '../../../../../lib/scene/uniqueScenes/bloodmoonParts';
import type { GroundKind } from '../../../../../lib/scene/uniqueScenes/types';

/** Triangles of a geometry. */
export const trianglesOf = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

/** A flat-coloured copy of a shape: position, normal and colour only, so shapes can be merged. */
export function coloured(g: BufferGeometry, color: string): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  const c = new Color(color);
  const n = out.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new BufferAttribute(arr, 3));
  return out;
}

/**
 * A scarecrow from simple shapes, one merged geometry (one draw call), about 3.4 units tall, standing at y = 0 and
 * facing +z: a post, a crossbar with straw hands, a sack body, a round head and a floppy hat.
 */
export function buildScarecrow(): BufferGeometry {
  const wood = '#5b3a1e';
  const straw = '#d9a441';
  const post = new CylinderGeometry(0.07, 0.09, 3.1, 6).translate(0, 1.55, 0);
  const arms = new BoxGeometry(2.0, 0.12, 0.12).translate(0, 2.35, 0);
  const body = new SphereGeometry(0.42, 8, 6).scale(1, 1.25, 0.8).translate(0, 1.95, 0);
  const head = new SphereGeometry(0.3, 7, 5).translate(0, 2.8, 0.02);
  const brim = new CylinderGeometry(0.52, 0.52, 0.06, 8).translate(0, 3.05, 0);
  const crown = new ConeGeometry(0.34, 0.5, 8).translate(0, 3.33, 0);
  const handL = new ConeGeometry(0.12, 0.35, 6).rotateZ(Math.PI / 2).translate(-1.15, 2.35, 0);
  const handR = new ConeGeometry(0.12, 0.35, 6).rotateZ(-Math.PI / 2).translate(1.15, 2.35, 0);
  return mergeGeometries([
    coloured(post, wood), coloured(arms, wood), coloured(body, '#9a5a2a'), coloured(head, straw),
    coloured(brim, '#3a2a1c'), coloured(crown, '#3a2a1c'), coloured(handL, straw), coloured(handR, straw),
  ])!;
}

/**
 * The stepped stone platform of the Blood Moon ruins, one merged geometry (one draw call): a box per step from the ground up
 * to its top, dark stone that gets a little lighter on each step up. 12 triangles a step.
 */
export function buildPlatform(steps: readonly PlatformStep[]): BufferGeometry {
  const shades = ['#2a1d22', '#33242a', '#3d2b32', '#47333a'];
  const parts = steps.map((s, k) => {
    const g = new BoxGeometry(s.x1 - s.x0, s.top, s.z1 - s.z0).translate((s.x0 + s.x1) / 2, s.top / 2, (s.z0 + s.z1) / 2);
    return coloured(g, shades[Math.min(k, shades.length - 1)]!);
  });
  return mergeGeometries(parts)!;
}

/** A ribbon along a centre line, `halfWidth` each way, with a slightly uneven edge. Two triangles per centre point at most. */
export function buildPathRibbon(centre: readonly { x: number; z: number }[], halfWidth: number, y = 0.03): BufferGeometry {
  const n = centre.length;
  const pos = new Float32Array(n * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = centre[Math.max(0, i - 1)]!;
    const b = centre[Math.min(n - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = (b.z - a.z) / len;
    const nz = -(b.x - a.x) / len;
    for (const side of [-1, 1]) {
      const w = halfWidth * (1 + 0.1 * Math.sin(i * 1.7 + side * 2.1));
      pos.set([centre[i]!.x + nx * side * w, y, centre[i]!.z + nz * side * w], (i * 2 + (side + 1) / 2) * 3);
    }
    if (i < n - 1) {
      const k = i * 2;
      index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // The strip lies flat: make every normal point up, whichever way the winding went.
  const nrm = g.getAttribute('normal');
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

// ----- the painted ground -----
const SIZE = 512;
interface Recipe {
  /** Soft blobs: colour (with `A` for the alpha), how many, and how strong. */
  blobs: readonly { color: string; count: number; alpha: number; r: readonly [number, number] }[];
  speckle: readonly string[];
}
export const GROUND_RECIPES: Record<GroundKind, Recipe> = {
  earth: {
    blobs: [
      { color: 'rgba(176,96,34,A)', count: 70, alpha: 0.55, r: [40, 110] },
      { color: 'rgba(92,52,24,A)', count: 70, alpha: 0.5, r: [30, 90] },
      { color: 'rgba(214,150,70,A)', count: 40, alpha: 0.3, r: [18, 50] },
    ],
    speckle: ['rgba(60,34,16,0.5)', 'rgba(190,120,50,0.35)', 'rgba(40,24,12,0.45)'],
  },
  grass: {
    blobs: [
      { color: 'rgba(150,170,56,A)', count: 70, alpha: 0.5, r: [40, 110] },
      { color: 'rgba(76,110,40,A)', count: 70, alpha: 0.5, r: [30, 90] },
      { color: 'rgba(214,196,92,A)', count: 40, alpha: 0.35, r: [18, 50] },
    ],
    speckle: ['rgba(60,92,32,0.5)', 'rgba(210,200,100,0.35)', 'rgba(150,120,50,0.3)'],
  },
  moss: {
    blobs: [
      { color: 'rgba(40,86,48,A)', count: 80, alpha: 0.55, r: [40, 110] },
      { color: 'rgba(14,30,22,A)', count: 70, alpha: 0.5, r: [30, 90] },
      { color: 'rgba(90,130,60,A)', count: 40, alpha: 0.3, r: [18, 50] },
    ],
    speckle: ['rgba(20,50,30,0.5)', 'rgba(110,150,70,0.35)', 'rgba(8,20,14,0.45)'],
  },
  snow: {
    blobs: [
      { color: 'rgba(240,246,255,A)', count: 80, alpha: 0.6, r: [40, 110] },
      { color: 'rgba(150,176,210,A)', count: 60, alpha: 0.4, r: [30, 90] },
      { color: 'rgba(255,255,255,A)', count: 40, alpha: 0.5, r: [18, 50] },
    ],
    speckle: ['rgba(255,255,255,0.5)', 'rgba(150,176,210,0.35)', 'rgba(110,140,180,0.3)'],
  },
  rock: {
    blobs: [
      { color: 'rgba(90,24,28,A)', count: 70, alpha: 0.55, r: [40, 110] },
      { color: 'rgba(24,8,10,A)', count: 70, alpha: 0.55, r: [30, 90] },
      { color: 'rgba(130,50,44,A)', count: 40, alpha: 0.3, r: [18, 50] },
    ],
    speckle: ['rgba(10,4,6,0.55)', 'rgba(120,44,40,0.35)', 'rgba(60,20,24,0.4)'],
  },
  flagstone: {
    blobs: [
      { color: 'rgba(96,98,112,A)', count: 70, alpha: 0.5, r: [40, 110] },
      { color: 'rgba(30,32,44,A)', count: 70, alpha: 0.5, r: [30, 90] },
      { color: 'rgba(140,142,156,A)', count: 40, alpha: 0.3, r: [18, 50] },
    ],
    speckle: ['rgba(20,22,32,0.5)', 'rgba(150,152,166,0.3)', 'rgba(60,62,76,0.4)'],
  },
};

/** Paints one tile of ground with the 2D canvas. Drawn again at the edges so the tile repeats without a seam. */
export function paintGround(canvas: HTMLCanvasElement, kind: GroundKind, base: string): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const rng = mulberry32(53);
  const recipe = GROUND_RECIPES[kind];
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  for (const b of recipe.blobs) {
    for (let i = 0; i < b.count; i++) {
      const x = rng() * SIZE;
      const y = rng() * SIZE;
      const r = b.r[0] + rng() * (b.r[1] - b.r[0]);
      for (const ox of [-SIZE, 0, SIZE]) {
        for (const oy of [-SIZE, 0, SIZE]) {
          const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          grad.addColorStop(0, b.color.replace('A', String(b.alpha)));
          grad.addColorStop(1, b.color.replace('A', '0'));
          g.fillStyle = grad;
          g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = recipe.speckle[Math.floor(rng() * recipe.speckle.length)]!;
    g.fillRect(rng() * SIZE, rng() * SIZE, 1 + rng() * 2, 1 + rng() * 3);
  }
}

export function makeGroundTexture(kind: GroundKind, base: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  paintGround(canvas, kind, base);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
