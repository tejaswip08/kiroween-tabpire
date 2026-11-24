// The shapes of the witch's cottage and of the ground around it, built from simple low-poly parts. No model files, no images.
// Each shape is one merged geometry with flat vertex colours (one draw call). Local units: x right, y up, front toward +z, y = 0 is the ground.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOOTING_Y, MOUND } from '../../../../../lib/scene/uniqueScenes/forestHouse';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { coloured } from './shapes';
const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts) ?? new BufferGeometry();
/** The green fog colour the house is partly faded toward (its materials ignore the scene fog, so the haze is baked into the colours). */
const HAZE = new Color('#2c5a38');
/** A hex colour mixed `k` of the way toward the haze. */
export function hazed(hex: string, k = 0.28): string {
  return `#${new Color(hex).lerp(HAZE, k).getHexString()}`;
}
const part = (g: BufferGeometry, hex: string, k?: number) => coloured(g, hazed(hex, k));
/** Where the floor of the house is: a little below the top of the mound, so the footing is buried and the walls never float. */
export const FLOOR_Y = MOUND.h * 0.85;
const GROUND_FLOOR = { w: 3.0, h: 1.75, d: 2.4 };
const UPPER = { w: 2.3, h: 1.25, d: 1.9 };
const ROOF = { r: 1.7, h: 2.7 };
/** Bends a box: the top moves sideways, so the walls lean. `lean` is the sideways shift of the top. */
function leaning(g: BufferGeometry, bottom: number, height: number, lean: number): BufferGeometry {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + lean * Math.max(0, (pos.getY(i) - bottom) / height));
  return g;
}
/** A tall, bent, pointed cone, like a witch's hat: its tip leans over and droops. */
function bentCone(radius: number, height: number, baseY: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, 8, 5).translate(0, baseY + height / 2, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(0, (pos.getY(i) - baseY) / height);
    pos.setX(i, pos.getX(i) + 1.0 * k * k + (k > 0.8 ? (k - 0.8) * 1.6 : 0));
    pos.setZ(i, pos.getZ(i) - 0.35 * k * k);
    pos.setY(i, pos.getY(i) - (k > 0.85 ? (k - 0.85) * 1.2 : 0));
  }
  return g;
}
export const HOUSE_PARTS = {
  /** The chimney top, where the smoke starts (local). */
  chimneyTop: [-0.95, FLOOR_Y + GROUND_FLOOR.h + UPPER.h + 1.55, -0.2] as const,
  /** Window glass: centre and size (local), the front of the house is toward +z. */
  windows: [
    { x: 0.95, y: FLOOR_Y + 1.0, z: GROUND_FLOOR.d / 2 + 0.06, size: 0.46 },
    { x: 0.25, y: FLOOR_Y + GROUND_FLOOR.h + 0.7, z: UPPER.d / 2 + 0.07, size: 0.4 },
  ],
  /** The hanging lantern's flame (local). */
  lantern: { x: -1.9, y: 1.7, z: 2.9 },
  /** Total height of the house with its mound (local, before scale). */
  height: FLOOR_Y + GROUND_FLOOR.h + UPPER.h + ROOF.h - 0.45,
} as const;
/** The mound under the cottage: half an ellipsoid on y = 0, dark green earth. */
function buildMound(): BufferGeometry {
  const g = new SphereGeometry(1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(MOUND.rx, MOUND.h, MOUND.rz);
  return coloured(g, '#14261a');
}
/** The cottage itself: leaning dark-wood walls, a bent witch's-hat roof, a crooked chimney, a round door, a broom and a crooked fence. One geometry. */
export function buildWitchHouse(): BufferGeometry {
  const parts: BufferGeometry[] = [buildMound()];
  const wood = '#2e2018';
  const darkWood = '#1c120d';
  // The stone footing goes down into the mound: its bottom is well below the mound top.
  parts.push(part(new BoxGeometry(GROUND_FLOOR.w + 0.5, FLOOR_Y - FOOTING_Y + 0.2, GROUND_FLOOR.d + 0.4).translate(0, (FOOTING_Y + FLOOR_Y + 0.2) / 2, 0), '#2a2a2e'));
  // Ground floor: leans to the right.
  const walls = new BoxGeometry(GROUND_FLOOR.w, GROUND_FLOOR.h, GROUND_FLOOR.d, 1, 2, 1).translate(0, FLOOR_Y + GROUND_FLOOR.h / 2, 0);
  parts.push(part(leaning(walls, FLOOR_Y, GROUND_FLOOR.h, 0.28), wood));
  // Planks on the front wall.
  for (let i = 0; i < 7; i++) {
    const x = -1.25 + i * 0.42;
    const lean = 0.28 * 0.5;
    parts.push(part(new BoxGeometry(0.06, GROUND_FLOOR.h - 0.1, 0.05).translate(x + lean, FLOOR_Y + GROUND_FLOOR.h / 2, GROUND_FLOOR.d / 2 + 0.02), darkWood));
  }
  // Upper floor: sticks out a little and leans the other way.
  const topY = FLOOR_Y + GROUND_FLOOR.h;
  parts.push(part(new BoxGeometry(UPPER.w + 0.6, 0.16, UPPER.d + 0.6).translate(0.3, topY + 0.04, 0), darkWood));
  const upper = new BoxGeometry(UPPER.w, UPPER.h, UPPER.d, 1, 2, 1).translate(0.35, topY + UPPER.h / 2, 0);
  parts.push(part(leaning(upper, topY, UPPER.h, -0.3), '#35241a'));
  // The roof: a tall bent cone with a flat brim, and a band.
  const roofY = topY + UPPER.h;
  parts.push(part(new CylinderGeometry(ROOF.r + 0.35, ROOF.r + 0.35, 0.1, 10).translate(0.1, roofY, 0), '#14100f'));
  parts.push(part(bentCone(ROOF.r, ROOF.h, roofY).translate(0.1, 0, 0), '#241a26'));
  parts.push(part(new CylinderGeometry(ROOF.r * 0.93, ROOF.r + 0.02, 0.22, 10).translate(0.1, roofY + 0.2, 0), '#4a2a12'));
  // A crooked chimney through the roof, two blocks bent in the middle.
  const [cx, , cz] = HOUSE_PARTS.chimneyTop;
  parts.push(part(new BoxGeometry(0.55, 1.2, 0.55).translate(cx + 0.05, roofY + 0.5, cz), '#28201f'));
  parts.push(part(new BoxGeometry(0.5, 0.8, 0.5).rotateZ(0.22).translate(cx - 0.05, roofY + 1.3, cz), '#33292a'));
  // The round door, with a dark frame and a brass handle.
  const doorZ = GROUND_FLOOR.d / 2 + 0.05;
  const doorX = 0.28 * 0.25;
  parts.push(part(new CylinderGeometry(0.5, 0.5, 0.1, 16).rotateX(Math.PI / 2).translate(doorX, FLOOR_Y + 0.55, doorZ), '#5a3a1c'));
  parts.push(part(new TorusGeometry(0.52, 0.07, 5, 16).translate(doorX, FLOOR_Y + 0.55, doorZ + 0.03), darkWood));
  parts.push(part(new SphereGeometry(0.06, 5, 4).translate(doorX + 0.25, FLOOR_Y + 0.55, doorZ + 0.08), '#c9a14a', 0.1));
  // Window frames and sills (the glass is a separate glowing mesh).
  for (const w of HOUSE_PARTS.windows) {
    parts.push(part(new BoxGeometry(w.size + 0.2, w.size + 0.2, 0.06).translate(w.x, w.y, w.z - 0.03), darkWood));
    parts.push(part(new BoxGeometry(w.size + 0.34, 0.07, 0.16).translate(w.x, w.y - w.size / 2 - 0.13, w.z), darkWood));
  }
  // A broomstick leaning against the wall beside the door.
  const stick = new CylinderGeometry(0.04, 0.04, 2.1, 5).translate(0, 1.05, 0).rotateX(-0.3).rotateZ(-0.08).translate(-0.95, FLOOR_Y - 0.1, GROUND_FLOOR.d / 2 + 0.55);
  parts.push(part(stick, '#4a3220'));
  parts.push(part(new ConeGeometry(0.2, 0.7, 6).translate(0, 0.35, 0).rotateX(-0.3).rotateZ(-0.08).translate(-0.95, FLOOR_Y - 0.1, GROUND_FLOOR.d / 2 + 0.55), '#a07a2c', 0.15));
  // A little crooked fence in front, with a gap for the trail.
  const rng = mulberry32(412);
  const rail = (x0: number, x1: number, y: number) => {
    const g = new BoxGeometry(x1 - x0, 0.07, 0.05).translate((x0 + x1) / 2, y, 3.3);
    g.rotateZ((rng() - 0.5) * 0.08);
    parts.push(part(g, '#3a2a1e'));
  };
  for (const [x0, x1] of [[-3.7, -1.1], [1.1, 3.6]] as const) {
    const n = Math.round((x1 - x0) / 0.65);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const h = 0.85 + rng() * 0.3;
      parts.push(part(new BoxGeometry(0.14, h, 0.12).translate(0, h / 2, 0).rotateZ((rng() - 0.5) * 0.3).rotateY(rng() * 0.6).translate(x, MOUND.h * 0.55, 3.3), '#3a2a1e'));
    }
    rail(x0, x1, MOUND.h * 0.55 + 0.55);
    rail(x0, x1, MOUND.h * 0.55 + 0.25);
  }
  // The lantern post: a crooked pole with an arm, a chain and a small cap over the lantern.
  const { x: lx, z: lz } = HOUSE_PARTS.lantern;
  parts.push(part(new CylinderGeometry(0.06, 0.08, 2.4, 5).translate(0, 1.2, 0).rotateZ(0.07).translate(lx - 0.35, MOUND.h * 0.5, lz), '#2b1d14'));
  parts.push(part(new BoxGeometry(0.75, 0.06, 0.06).translate(lx - 0.02, MOUND.h * 0.5 + 2.35, lz), '#2b1d14'));
  parts.push(part(new CylinderGeometry(0.01, 0.01, 0.35, 3).translate(lx + 0.3, MOUND.h * 0.5 + 2.15, lz), '#1c120d'));
  parts.push(part(new ConeGeometry(0.2, 0.18, 4).translate(lx + 0.3, HOUSE_PARTS.lantern.y + 0.3, lz), '#1c120d'));
  return merge(parts);
}
/** The glass of one window as a thin glowing slab, centred on y = 0 so it can be placed with a matrix. Colour comes from the material. */
export function buildGlass(size: number): BufferGeometry {
  return new BoxGeometry(size, size, 0.04);
}
/** The hanging lantern's glass: a small box. */
export function buildLanternGlass(): BufferGeometry {
  return new BoxGeometry(0.2, 0.3, 0.2);
}
/**
 * A cheap far tree for the layers that fade into the fog: a bent trunk and a few crooked limbs, 3 to 4 sides. About 100 triangles,
 * standing on y = 0, 4 to 6 high, three variants.
 */
export function buildFarTree(variant: number): BufferGeometry {
  const rng = mulberry32(900 + variant * 53);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const height = 4.4 + variant * 0.8;
  const lean = (variant - 1) * 0.5;
  const parts: BufferGeometry[] = [];
  const trunk = [0, 1, 2, 3, 4].map((i) => {
    const t = i / 4;
    return { x: Math.sin(t * 3.1 + variant) * 0.3 * t + lean * t * t, y: height * t, z: Math.cos(t * 2.4 + variant * 2) * 0.25 * t, r: 0.5 * (1 - t) + 0.05 };
  });
  const tube = (pts: { x: number; y: number; z: number; r: number }[], sides: number) => {
    const pos: number[] = [];
    const idx: number[] = [];
    pts.forEach((p, i) => {
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        pos.push(p.x + Math.cos(a) * p.r, p.y, p.z + Math.sin(a) * p.r);
      }
      if (i < pts.length - 1) {
        for (let k = 0; k < sides; k++) {
          const k2 = (k + 1) % sides;
          const q = i * sides;
          idx.push(q + k, q + sides + k, q + k2, q + k2, q + sides + k, q + sides + k2);
        }
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return coloured(g, '#2b1f1b');
  };
  parts.push(tube(trunk, 4));
  const limbs = 4 + variant;
  for (let k = 0; k < limbs; k++) {
    const t = 0.4 + (k / limbs) * 0.55;
    const b = trunk[Math.min(4, Math.round(t * 4))]!;
    const a = k * 2.4 + between(0, 0.6);
    const len = between(1.3, 2.3) * (1.1 - t * 0.4);
    const rise = between(0, 0.9);
    parts.push(
      tube(
        [
          { x: b.x, y: b.y, z: b.z, r: 0.13 },
          { x: b.x + Math.cos(a) * len * 0.5, y: b.y + 0.3 + rise * 0.4, z: b.z + Math.sin(a) * len * 0.5, r: 0.07 },
          { x: b.x + Math.cos(a) * len, y: b.y + 0.25 + rise, z: b.z + Math.sin(a) * len, r: 0.02 },
        ],
        3,
      ),
    );
  }
  return merge(parts);
}
/** One dark ragged cone of the far tree-line, standing on y = 0, 1 high and 1 wide (scaled at placement). */
export function buildLineTree(): BufferGeometry {
  return new ConeGeometry(0.5, 1, 5, 1, true).translate(0, 0.5, 0);
}
/** A tree stump: a short tapered trunk with a lighter cut top and a few roots, about 0.7 high and 1.2 wide, on y = 0. */
export function buildStump(): BufferGeometry {
  const parts: BufferGeometry[] = [
    coloured(new CylinderGeometry(0.42, 0.6, 0.7, 7).translate(0, 0.35, 0), '#33241c'),
    coloured(new CylinderGeometry(0.4, 0.4, 0.04, 7).translate(0, 0.71, 0), '#5a4630'),
  ];
  for (let k = 0; k < 4; k++) parts.push(coloured(new ConeGeometry(0.14, 0.7, 4).rotateZ(1.2).translate(0.55, 0.27, 0).rotateY(k * 1.6 + 0.3), '#2b1d16'));
  return merge(parts);
}
/** A low half-ellipsoid bump, 1 across and 1 high (scaled at placement), sitting on y = 0. */
export function buildBump(): BufferGeometry {
  return new SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2);
}
/** Triangles of a shape. */
export const trianglesOfShape = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
