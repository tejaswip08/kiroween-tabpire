import {
  BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Euler, Matrix4, type Mesh, type Object3D, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { CHURCH, FAR_EMBED, farSeatY, FAR_HILLS, FAR_ITEMS, FAR_MODELS, HOUSE, type FarItem } from '../../../../lib/scene/depth';
import { hubOf, splitBlades } from '../../../../lib/scene/windmill';
import { cornerIndices, geometryFromCorners, worldPositions } from './geometryTools';

/** Collects triangle corners (three numbers each) from many shapes, moved into place. One draw call for all. */
class Chunks {
  readonly data: number[] = [];
  /** Adds a geometry (indexed or not) after moving it with `matrix`. */
  addGeometry(geo: BufferGeometry, matrix: Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position');
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.data.push(v.x, v.y, v.z);
    }
  }
  /** Adds triangles from a float position array. */
  addCorners(positions: Float32Array, corners: ArrayLike<number>) {
    for (let k = 0; k < corners.length; k++) {
      const i = corners[k]!;
      this.data.push(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
    }
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.data), 3));
    return g;
  }
}

const place = (item: { x: number; y: number; z: number; rotY: number; scale: number }): Matrix4 =>
  new Matrix4().compose(new Vector3(item.x, item.y, item.z), new Quaternion().setFromEuler(new Euler(0, item.rotY, 0)), new Vector3(item.scale, item.scale, item.scale));

/** A box from `x0..x1`, `y0..y1`, `z0..z1`. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};

/** A crooked church from simple shapes: a nave with a pitched roof, a tall tower with a pointed steeple and a cross. */
function addChurch(chunks: Chunks, item: FarItem) {
  const lean = new Matrix4().makeRotationZ(CHURCH.lean);
  const base = place(item).multiply(lean);
  const { nave, tower, steeple, roofRise } = CHURCH;
  chunks.addGeometry(box(-nave.w / 2, nave.w / 2, 0, nave.h, -nave.d / 2, nave.d / 2), base);
  // The pitched roof: a triangle in section along the nave.
  const roof = new BufferGeometry();
  const w = nave.w / 2 + 0.25;
  const d = nave.d / 2 + 0.2;
  const y0 = nave.h;
  const y1 = nave.h + roofRise;
  const v = [
    [-w, y0, -d], [w, y0, -d], [0, y1, -d], [-w, y0, d], [w, y0, d], [0, y1, d],
  ] as const;
  const tri = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2];
  roof.setAttribute('position', new BufferAttribute(new Float32Array(tri.flatMap((i) => v[i]!)), 3));
  chunks.addGeometry(roof, base);
  // The tower, a little off line, then the steeple and a small cross on top.
  const towerM = base.clone().multiply(new Matrix4().makeRotationZ(-CHURCH.lean * 0.6)).multiply(new Matrix4().makeTranslation(0.3, 0, tower.z));
  chunks.addGeometry(box(-tower.w / 2, tower.w / 2, 0, tower.h, -tower.d / 2, tower.d / 2), towerM);
  const spire = new CylinderGeometry(0, steeple.r, steeple.h, 4, 1);
  spire.rotateY(Math.PI / 4);
  spire.translate(0, tower.h + steeple.h / 2, 0);
  chunks.addGeometry(spire, towerM);
  const crossM = towerM.clone().multiply(new Matrix4().makeTranslation(0, tower.h + steeple.h + 0.45, 0));
  chunks.addGeometry(box(-0.05, 0.05, -0.5, 0.5, -0.05, 0.05), crossM);
  chunks.addGeometry(box(-0.3, 0.3, 0.12, 0.22, -0.05, 0.05), crossM);
}

/** A small house with a pitched roof. */
function addHouse(chunks: Chunks, item: FarItem) {
  const base = place(item);
  const { w, h, d, roofRise } = HOUSE;
  chunks.addGeometry(box(-w / 2, w / 2, 0, h, -d / 2, d / 2), base);
  const roof = new BufferGeometry();
  const ww = w / 2 + 0.2;
  const dd = d / 2 + 0.15;
  const v = [
    [-ww, h, -dd], [ww, h, -dd], [0, h + roofRise, -dd], [-ww, h, dd], [ww, h, dd], [0, h + roofRise, dd],
  ] as const;
  const tri = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2];
  roof.setAttribute('position', new BufferAttribute(new Float32Array(tri.flatMap((i) => v[i]!)), 3));
  chunks.addGeometry(roof, base);
  // A chimney.
  chunks.addGeometry(box(0.5, 0.8, h, h + roofRise + 0.5, -0.2, 0.2), base);
}


export interface FarBuild {
  /** Hills, church, houses and the models, merged into one geometry (positions only). */
  village: BufferGeometry;
  /** The windmill's sails, centred on their hub, or null. */
  bladeGeo: BufferGeometry | null;
  /** Where the hub is in the world. */
  hubWorld: Vector3;
  /** One matrix per lit window. */
  wins: Matrix4[];
  /** The buildings with their final y (resting on the hills). */
  placed: FarItem[];
  /** World height of each placed building's lowest point (same order as `placed`). */
  bases: number[];
}

/** Builds the far village from the four loaded Quaternius scenes. */
export function buildFarVillage(scenes: { barn: Object3D; windmill: Object3D; fortress: Object3D; ruins: Object3D }): FarBuild {
  const { barn, windmill, fortress, ruins } = scenes;
  const chunks = new Chunks();
  const meshesOf = (root: Object3D, only?: readonly string[]) => {
    const list: Mesh[] = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && (!only || only.includes(m.name))) list.push(m);
    });
    return list;
  };
  /** Lowest point of the meshes after scaling and turning (the item placed at y = 0). */
  const lowest = (meshes: Mesh[], item: FarItem): number => {
    const flat = place({ ...item, y: 0 });
    let min = Infinity;
    for (const m of meshes) {
      const p = worldPositions(m, flat.clone().multiply(m.matrixWorld));
      for (let i = 1; i < p.length; i += 3) min = Math.min(min, p[i]!);
    }
    return Number.isFinite(min) ? min : 0;
  };
  /** Lowest point of the windmill's body (not its sails, which hang lower than the base) after scaling and turning. */
  const lowestBody = (m: Mesh, item: FarItem): number => {
    const index = cornerIndices(m.geometry);
    const split = splitBlades(worldPositions(m), index);
    const p = worldPositions(m, place({ ...item, y: 0 }).multiply(m.matrixWorld));
    let min = Infinity;
    for (const i of split.body) min = Math.min(min, p[i * 3 + 1]!);
    return Number.isFinite(min) ? min : 0;
  };
  // Every building stands on the hill: its lowest point (from its bounding box, after scaling) goes just under the surface.
  const bases: number[] = [];
  const placedItems = FAR_ITEMS.map((item): FarItem => {
    const low =
      item.kind === 'barn' ? lowest(meshesOf(barn), item)
      : item.kind === 'fortress' ? lowest(meshesOf(fortress), item)
      : item.kind === 'windmill' ? lowestBody(meshesOf(windmill)[0]!, item)
      : 0;
    const y = farSeatY(item) - low - FAR_EMBED;
    bases.push(y + low);
    return { ...item, y };
  });
  let bladeGeo: BufferGeometry | null = null;
  let hubWorld = new Vector3();
  // Hills: half-buried ellipsoids.
  for (const h of FAR_HILLS) {
    const s = new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    chunks.addGeometry(s, new Matrix4().compose(new Vector3(h.x, h.y, h.z), new Quaternion(), new Vector3(h.rx, h.ry, h.rz)));
  }
  for (const item of placedItems) {
    const matrix = place(item);
    if (item.kind === 'church') addChurch(chunks, item);
    else if (item.kind === 'house') addHouse(chunks, item);
    else if (item.kind === 'barn') {
      for (const m of meshesOf(barn)) chunks.addCorners(worldPositions(m, matrix.clone().multiply(m.matrixWorld)), cornerIndices(m.geometry));
    } else if (item.kind === 'fortress') {
      for (const m of meshesOf(fortress)) chunks.addCorners(worldPositions(m, matrix.clone().multiply(m.matrixWorld)), cornerIndices(m.geometry));
    } else if (item.kind === 'ruins') {
      // The ruins file is a whole scene of walls and arches spread out; two of its parts make a good broken ruin.
      const parts = meshesOf(ruins, FAR_MODELS.blood_ruins.parts);
      const sets = parts.map((m) => ({ m, p: worldPositions(m) }));
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
      for (const { p } of sets) {
        for (let i = 0; i < p.length; i += 3) {
          minX = Math.min(minX, p[i]!); maxX = Math.max(maxX, p[i]!);
          minY = Math.min(minY, p[i + 1]!);
          minZ = Math.min(minZ, p[i + 2]!); maxZ = Math.max(maxZ, p[i + 2]!);
        }
      }
      const centre = new Matrix4().makeTranslation(-(minX + maxX) / 2, -minY, -(minZ + maxZ) / 2);
      for (const { m } of sets) chunks.addCorners(worldPositions(m, matrix.clone().multiply(centre).multiply(m.matrixWorld)), cornerIndices(m.geometry));
    } else if (item.kind === 'windmill') {
      const m = meshesOf(windmill)[0]!;
      const local = worldPositions(m);
      const split = splitBlades(local, cornerIndices(m.geometry));
      const hub = hubOf(local, split.blades);
      // The body goes into the village; the sails become their own mesh around the hub.
      chunks.addCorners(worldPositions(m, matrix.clone().multiply(m.matrixWorld)), split.body);
      bladeGeo = geometryFromCorners(local, split.blades, new Vector3(hub.x, hub.y, hub.z));
      hubWorld = new Vector3(hub.x, hub.y, hub.z).applyMatrix4(matrix);
    }
  }
  // Lit windows: small warm rectangles in front of the buildings.
  const wins: Matrix4[] = [];
  for (const item of placedItems) {
    const base = place(item);
    for (const [dx, dy, dz, w, h] of item.windows) {
      wins.push(base.clone().multiply(new Matrix4().compose(new Vector3(dx, dy, dz + 0.01), new Quaternion(), new Vector3(w, h, 1))));
    }
  }
  return { village: chunks.build(), bladeGeo, hubWorld, wins, placed: placedItems, bases };
}
