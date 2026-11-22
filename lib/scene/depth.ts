// The far background: a village on the hills, and low clouds in layers. Pure: no three.
// Coordinates are world coordinates (x right, y up, z toward the camera).
import { MOON_KEEP_OUT_DEG } from './sky';
import { clamp } from './rng';

/** [dx, dy, dz, width, height] of a lit window, in the building's own units (before its scale). */
export type FarWindow = readonly [number, number, number, number, number];

export interface FarItem {
  id: string;
  kind: 'barn' | 'windmill' | 'fortress' | 'ruins' | 'church' | 'house';
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  windows: readonly FarWindow[];
}
export interface FarHill {
  id: string;
  x: number;
  y: number;
  z: number;
  /** Radii of the half-buried ellipsoid. */
  rx: number;
  ry: number;
  rz: number;
}

/** Quaternius models used for the far village, with the triangles each one adds. Parts are mesh names. */
export const FAR_MODELS = {
  farm_barn: { tris: 3770 },
  farm_windmill: { tris: 1712 },
  castle_fortress: { tris: 9416 },
  blood_ruins: { tris: 3434, parts: ['Wall_Overgrown', 'Doors_RoundArch_Covered_2'] as readonly string[] },
} as const;

/** The crooked church, built from simple shapes (units: the nave is 4.4 wide and 6 deep). */
export const CHURCH = {
  nave: { w: 4.4, h: 3.4, d: 6 },
  roofRise: 2.2,
  tower: { w: 2, h: 6.4, d: 2, z: 2.6 },
  steeple: { r: 1.55, h: 5.6 },
  /** The whole church leans a little. */
  lean: 0.06,
  tris: 120,
} as const;
export const HOUSE = { w: 2.6, h: 2.1, d: 2.4, roofRise: 1.5, tris: 28 } as const;

export const FAR_HILLS: readonly FarHill[] = [
  { id: 'hill-a', x: -22, y: -2, z: -92, rx: 46, ry: 11, rz: 16 },
  { id: 'hill-b', x: 34, y: -1, z: -100, rx: 36, ry: 7, rz: 14 },
  { id: 'hill-c', x: -64, y: -1, z: -86, rx: 26, ry: 8, rz: 12 },
];

/** The village on hill A (left of the moon), the fortress beyond it and ruins on hill B. */
export const FAR_ITEMS: readonly FarItem[] = [
  { id: 'church', kind: 'church', x: -30, y: 8.4, z: -90, rotY: 0.12, scale: 1, windows: [[0, 4.8, 1.05, 0.5, 0.95]] },
  { id: 'barn', kind: 'barn', x: -12, y: 8.3, z: -93, rotY: -0.15, scale: 0.6, windows: [[-1.6, 3.4, 4.15, 0.8, 1.0], [1.6, 3.4, 4.15, 0.8, 1.0]] },
  { id: 'windmill', kind: 'windmill', x: -2, y: 7.9, z: -96, rotY: 0.1, scale: 4, windows: [[0, 0.62, 0.31, 0.12, 0.18]] },
  { id: 'house-1', kind: 'house', x: -41, y: 7.4, z: -88, rotY: 0.3, scale: 1, windows: [[0, 1.05, 1.22, 0.5, 0.6]] },
  { id: 'house-2', kind: 'house', x: -20, y: 9.1, z: -87, rotY: -0.2, scale: 1.1, windows: [[0, 1.05, 1.22, 0.5, 0.6]] },
  { id: 'house-3', kind: 'house', x: 6, y: 7.2, z: -90, rotY: 0.25, scale: 0.9, windows: [[0, 1.05, 1.22, 0.5, 0.6]] },
  { id: 'fortress', kind: 'fortress', x: -54, y: 5.6, z: -104, rotY: 0.05, scale: 7.5, windows: [[-0.42, 0.55, 0.94, 0.08, 0.13], [0.42, 0.55, 0.94, 0.08, 0.13], [0, 0.95, 0.9, 0.08, 0.13]] },
  { id: 'ruins', kind: 'ruins', x: 26, y: 4.6, z: -98, rotY: 0, scale: 0.55, windows: [] },
];

export const FAR_WINDOW_COUNT = FAR_ITEMS.reduce((n, i) => n + i.windows.length, 0);

/** Triangles the far village adds (every model, the church, the houses and the hills). */
export function farTriangles(): number {
  let t = 0;
  for (const item of FAR_ITEMS) {
    if (item.kind === 'barn') t += FAR_MODELS.farm_barn.tris;
    else if (item.kind === 'windmill') t += FAR_MODELS.farm_windmill.tris;
    else if (item.kind === 'fortress') t += FAR_MODELS.castle_fortress.tris;
    else if (item.kind === 'ruins') t += FAR_MODELS.blood_ruins.tris;
    else if (item.kind === 'church') t += CHURCH.tris;
    else t += HOUSE.tris;
  }
  return t + FAR_HILLS.length * 380 + FAR_WINDOW_COUNT * 2;
}

/** Everything that is drawn by the scene's own code, with an upper bound for its triangles and draw calls. */
export const EXTRAS = {
  farVillage: { calls: 3, tris: farTriangles() + 600 },
  lowClouds: { calls: 1, tris: 2 * 4 * 3 * 8 },
  cat: { calls: 2, tris: 420 },
  crows: { calls: 2, tris: 6 * 160 },
  owl: { calls: 2, tris: 420 },
  spiders: { calls: 2, tris: 3 * 260 + 12 },
  cobwebs: { calls: 1, tris: 14 },
  wisps: { calls: 1, tris: 28 },
  skeletons: { calls: 5, tris: 3 * (60 + 344 + 620) + 6 * 220 + 12 * 204 },
  cauldron: { calls: 3, tris: 400 },
  openCoffin: { calls: 3, tris: 300 + 60 },
} as const;

// ---------- low clouds ----------
export interface LowCloudPuff {
  layer: number;
  /** World position and drift. The cloud moves along x and wraps between xMin and xMax. */
  x0: number;
  y: number;
  z: number;
  speed: number;
  xMin: number;
  xMax: number;
  offX: number;
  offY: number;
  /** Half width and half height of the puff. */
  rx: number;
  ry: number;
  shade: number;
}
/** Three depths: near ones are lower and quicker, far ones higher and slower, so they read as layers. */
export const LOW_CLOUD_LAYERS = [
  { z: -46, y: 7.5, speed: 0.55, half: 70, clouds: 4 },
  { z: -72, y: 12, speed: 0.34, half: 105, clouds: 4 },
  { z: -104, y: 17, speed: 0.2, half: 150, clouds: 5 },
] as const;
const PUFFS = 7;
export function lowCloudPuffs(): LowCloudPuff[] {
  const out: LowCloudPuff[] = [];
  LOW_CLOUD_LAYERS.forEach((layer, li) => {
    for (let c = 0; c < layer.clouds; c++) {
      const base = -layer.half + ((c + 0.5) / layer.clouds) * layer.half * 2;
      const w = (6 + 2.5 * Math.sin(c * 2.3 + li)) * (1 + li * 0.5);
      const cy = layer.y + 2.2 * Math.sin(c * 1.7 + li * 3.1) * (1 + li * 0.4);
      for (let k = 0; k < PUFFS; k++) {
        const f = k / (PUFFS - 1) - 0.5;
        const hump = Math.cos(f * Math.PI);
        const base_ = k % 3 === 0;
        const wob = Math.sin((li * 11 + c * 5 + k) * 1.9);
        out.push({
          layer: li,
          x0: base,
          y: cy,
          z: layer.z + wob * 2,
          speed: layer.speed,
          xMin: -layer.half,
          xMax: layer.half,
          offX: f * 2 * w * 0.85 + wob,
          offY: base_ ? -0.25 * w * 0.16 : (0.1 + 0.5 * hump) * w * 0.2,
          rx: base_ ? w * (0.3 + 0.1 * hump) : w * (0.19 + 0.15 * hump),
          ry: base_ ? w * 0.1 : w * (0.15 + 0.07 * hump),
          shade: (wob + 1) / 2,
        });
      }
    }
  });
  return out;
}
/** Where a puff's cloud is along its layer at time t (wrapped between xMin and xMax). The shader repeats this. */
export function lowCloudX(p: Pick<LowCloudPuff, 'x0' | 'speed' | 'xMin' | 'xMax'>, t: number): number {
  const span = p.xMax - p.xMin;
  const raw = p.x0 - p.xMin + p.speed * t;
  return p.xMin + (((raw % span) + span) % span);
}
/** A cloud fades out at both ends of its layer, so a wrap is never seen. */
export function lowCloudEdgeFade(x: number, xMin: number, xMax: number): number {
  const f = clamp((x - xMin) / (xMax - xMin), 0, 1);
  const s = (v: number) => v * v * (3 - 2 * v);
  return s(clamp(f / 0.12, 0, 1)) * (1 - s(clamp((f - 0.88) / 0.12, 0, 1)));
}
/** How much of a low cloud shows at `angleDeg` from the moon: none inside the keep-out, all a few degrees beyond. */
export const LOW_CLOUD_MOON_FADE_DEG = 5;
export function lowCloudMoonVisibility(angleDeg: number): number {
  const t = clamp((angleDeg - MOON_KEEP_OUT_DEG) / LOW_CLOUD_MOON_FADE_DEG, 0, 1);
  return t * t * (3 - 2 * t);
}
