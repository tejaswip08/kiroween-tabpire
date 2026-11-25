import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Component, useEffect, useMemo, type ReactNode } from 'react';
import {
  Box3, BufferAttribute, type BufferGeometry, Color, Euler, InstancedMesh, Matrix4, type Material, Mesh, type MeshStandardMaterial, type Object3D, Quaternion, type SkinnedMesh, Texture, Vector3,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODELS, modelFile, modelInfo, type Group, type ModelId, type Placement } from '../../../../lib/scene/layout';
import { useDisplay, type SceneDisplay } from './display';

export interface Part {
  geometry: BufferGeometry;
  material: Material;
  local: Matrix4;
}

/** Groups whose count follows the data. Each has one number in the display. */
export const DYNAMIC: Partial<Record<Group, 'newGraves' | 'coffins' | 'candles'>> = {
  newGrave: 'newGraves',
  coffin: 'coffins',
  candle: 'candles',
};

export interface Entry {
  placement: Placement;
  /** Index among the instances of this model's meshes. */
  index: number;
}
export interface Batch {
  mesh: InstancedMesh;
  part: Part;
  entries: Entry[];
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3();
const tmpE = new Euler();

/** Placement matrix. `k` is how much of the prop is shown (1 whole, 0 gone): it rises and grows in. */
export function compose(p: Placement, k: number, out: Matrix4): Matrix4 {
  const h = MODELS[p.model].h * p.scale;
  // The prop turns about the vertical axis, then leans a little (tilt).
  tmpE.set(p.tilt?.[0] ?? 0, p.rotY, p.tilt?.[1] ?? 0, 'YXZ');
  tmpQ.setFromEuler(tmpE);
  tmpP.set(p.x, p.y - (1 - k) * h * 0.6, p.z);
  const s = p.scale * Math.max(k, 0.0001);
  tmpS.set(s, s, s);
  return out.compose(tmpP, tmpQ, tmpS);
}

export const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** The path stones: a darker grey-purple copy of the material, so the path does not dominate. */
const stoneCache = new WeakMap<Material, Material>();
function darkStone(mat: Material): Material {
  let dark = stoneCache.get(mat);
  if (!dark) {
    dark = mat.clone();
    (dark as MeshStandardMaterial).color?.set('#6f6482');
    stoneCache.set(mat, dark);
  }
  return dark;
}

/** Mushrooms glow softly: a copy of the material with a cyan emissive colour. */
const glowCache = new WeakMap<Material, Material>();
function glowing(mat: Material): Material {
  let g = glowCache.get(mat);
  if (!g) {
    g = mat.clone();
    const std = g as MeshStandardMaterial;
    std.emissive?.set('#2fe6cc');
    if ('emissiveIntensity' in std) std.emissiveIntensity = 0.5;
    glowCache.set(mat, g);
  }
  return g;
}

/** Baked copies of skinned geometries, one per source geometry, kept like drei's file cache (never disposed). */
const bakedCache = new WeakMap<BufferGeometry, BufferGeometry>();
/**
 * Props are drawn as plain instanced meshes, without a skeleton. A skinned mesh (only `forest_mushroom_king` has one)
 * gets its real shape from its bones: drawn plainly it comes out 100 times too big. This bakes the rest pose into a
 * plain geometry once: each vertex moved by its bones (`getVertexPosition`), in the mesh's own space.
 */
export function bakeSkinned(mesh: SkinnedMesh): BufferGeometry {
  const src = mesh.geometry;
  const hit = bakedCache.get(src);
  if (hit) return hit;
  mesh.skeleton.update();
  const pos = src.getAttribute('position');
  const out = new Float32Array(pos.count * 3);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    mesh.getVertexPosition(i, v);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  const g = src.clone();
  g.deleteAttribute('skinIndex');
  g.deleteAttribute('skinWeight');
  g.setAttribute('position', new BufferAttribute(out, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  bakedCache.set(src, g);
  return g;
}

export function collectParts(root: Object3D, tint = false, glow = false, only?: readonly string[], recentre = false): Part[] {
  root.updateMatrixWorld(true);
  const parts: Part[] = [];
  const box = new Box3();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (only && !only.includes(m.name)) return;
    let mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    if (tint) mat = darkStone(mat);
    if (glow) mat = glowing(mat);
    const map = (mat as { map?: Texture | null }).map;
    if (map) map.anisotropy = 4;
    const geometry = (m as SkinnedMesh).isSkinnedMesh ? bakeSkinned(m as SkinnedMesh) : m.geometry;
    parts.push({ geometry, material: mat, local: m.matrixWorld.clone() });
    if (recentre) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      box.union(geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
    }
  });
  // Footprint centre to x = 0, z = 0 and the lowest point to y = 0 (for files whose origin is elsewhere).
  if (recentre && !box.isEmpty()) {
    const shift = new Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    for (const part of parts) part.local.premultiply(shift);
  }
  return parts;
}

// ----- Frozen Cemetery: pale blue-white pines, snow on top (Requirement 9.3) -----

/** The farm pumpkin: its body is the orange part. It is shaded smooth with darker ribs (`shadePumpkin`). */
export const isFarmPumpkin = (id: string): boolean => id === 'farm_pumpkin';
const RIB_LIGHT = new Color('#f58a2a');
const RIB_DARK = new Color('#a8420e');
/**
 * Smooth orange shading for the farm pumpkin. The file stores every triangle with its own flat normal, which shows as a
 * checkerboard of light and dark facets. This welds the corners, smooths the normals, and paints each corner by how far its
 * surface turns away from the pumpkin's axis (ribs facing out stay orange, the grooves between them go darker), and a little
 * darker toward the bottom. The shared file material is never changed: the body gets a copy. The copies are in `owned`.
 */
export function shadePumpkin(parts: readonly Part[]): { parts: Part[]; owned: Owned } {
  const owned: Owned = { materials: [], geometries: [] };
  const c = new Color();
  const out = parts.map((p) => {
    if ((p.material as MeshStandardMaterial).name !== 'Orange') return p;
    const stripped = p.geometry.clone();
    stripped.deleteAttribute('normal');
    stripped.deleteAttribute('uv');
    const geometry = mergeVertices(stripped, 1e-4);
    stripped.dispose();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const pos = geometry.getAttribute('position');
    const nrm = geometry.getAttribute('normal');
    const box = geometry.boundingBox!;
    const span = Math.max(box.max.y - box.min.y, 1e-6);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const nx = nrm.getX(i);
      const nz = nrm.getZ(i);
      const r = Math.hypot(x, z) || 1;
      const n = Math.hypot(nx, nz) || 1;
      // 1 on a rib's crest (the surface faces straight out), lower in a groove (it faces sideways).
      const facing = (x * nx + z * nz) / (r * n);
      const rib = Math.min(1, Math.max(0, (facing - 0.55) / 0.4));
      const low = Math.min(1, Math.max(0, (pos.getY(i) - box.min.y) / span / 0.5));
      c.copy(RIB_DARK).lerp(RIB_LIGHT, 0.3 + 0.7 * rib).multiplyScalar(0.72 + 0.28 * low);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const material = (p.material as MeshStandardMaterial).clone();
    material.color.set('#ffffff');
    material.vertexColors = true;
    material.roughness = 0.55;
    owned.materials.push(material);
    owned.geometries.push(geometry);
    return { geometry, material, local: p.local };
  });
  return { parts: out, owned };
}
export const isFrost = (id: string): boolean => id.startsWith('frost_');

export const FROST = {
  color: '#e8f2ff',
  emissive: '#5a7390',
  emissiveIntensity: 0.22,
  /** Vertex colours (they multiply the material colour): dark frosted needles, a snowy top. */
  body: [0.36, 0.46, 0.54],
  snow: [1, 1, 1],
  trunk: [0.36, 0.42, 0.5],
  /** The top quarter of the model turns to snow; the lowest part of a tree is the trunk. */
  snowFrom: 0.75,
  trunkTo: 0.12,
} as const;

/** Vertex colour at height `t` (0 foot, 1 top of the model). Pure. `trunks` is false for rocks. */
export function frostVertexColor(t: number, trunks: boolean): [number, number, number] {
  const h = Math.min(1, Math.max(0, t));
  const k = smooth((h - FROST.snowFrom) / (1 - FROST.snowFrom));
  const c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) c[i] = FROST.body[i]! + (FROST.snow[i]! - FROST.body[i]!) * k;
  if (trunks && h < FROST.trunkTo + 0.08) {
    const j = smooth((h - FROST.trunkTo) / 0.08);
    for (let i = 0; i < 3; i++) c[i] = FROST.trunk[i]! + (c[i]! - FROST.trunk[i]!) * j;
  }
  return c;
}

export interface Owned {
  materials: Material[];
  geometries: BufferGeometry[];
}

/**
 * Frost treatment: copies of the materials and geometries, so the shared model materials stay as the file has them.
 * The copies are returned in `owned` so the caller can dispose them.
 */
export function tintFrost(parts: readonly Part[], trunks: boolean): { parts: Part[]; owned: Owned } {
  const v = new Vector3();
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of parts) {
    const pos = p.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = v.fromBufferAttribute(pos, i).applyMatrix4(p.local).y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
  }
  const span = Math.max(hi - lo, 1e-6);
  const owned: Owned = { materials: [], geometries: [] };
  const mats = new Map<Material, Material>();
  const out = parts.map((p) => {
    let material = mats.get(p.material);
    if (!material) {
      material = p.material.clone();
      const std = material as MeshStandardMaterial;
      std.color?.set(FROST.color);
      std.emissive?.set(FROST.emissive);
      if ('emissiveIntensity' in std) std.emissiveIntensity = FROST.emissiveIntensity;
      std.vertexColors = true;
      mats.set(p.material, material);
      owned.materials.push(material);
    }
    const geometry = p.geometry.clone();
    const pos = geometry.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const y = v.fromBufferAttribute(pos, i).applyMatrix4(p.local).y;
      const [r, g, b] = frostVertexColor((y - lo) / span, trunks);
      c.setRGB(r, g, b);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    owned.geometries.push(geometry);
    return { geometry, material, local: p.local };
  });
  return { parts: out, owned };
}

/**
 * A scene's own look for a model, so the same file can look different from the Crypt's copy of it: which mesh parts to draw
 * (the bare bark of a tree without its leaf clumps) and a colour that multiplies the texture (a near-black silhouette).
 */
export interface ModelLook {
  only?: readonly string[];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}
/** A copy of each material with the look's colours. The geometry and textures are shared with the file; the copies are in `owned`. */
export function tintLook(parts: readonly Part[], look: ModelLook): { parts: Part[]; owned: Owned } {
  const owned: Owned = { materials: [], geometries: [] };
  const mats = new Map<Material, Material>();
  const out = parts.map((p) => {
    let material = mats.get(p.material);
    if (!material) {
      material = p.material.clone();
      const std = material as MeshStandardMaterial;
      std.color?.set(look.color);
      if (look.emissive) std.emissive?.set(look.emissive);
      if (look.emissiveIntensity !== undefined && 'emissiveIntensity' in std) std.emissiveIntensity = look.emissiveIntensity;
      mats.set(p.material, material);
      owned.materials.push(material);
    }
    return { geometry: p.geometry, material, local: p.local };
  });
  return { parts: out, owned };
}
/** The instanced meshes of one model: one per mesh part, every placement of the model in each. */
export function buildBatches(id: ModelId, root: Object3D, placements: readonly Placement[], look?: ModelLook): { batches: Batch[]; owned: Owned } {
  const info = modelInfo(id);
  let parts = collectParts(root, id.startsWith('path_'), id.startsWith('forest_mushroom'), look?.only ?? info.parts, info.recentre === true);
  let owned: Owned = { materials: [], geometries: [] };
  if (look) {
    const t = tintLook(parts, look);
    parts = t.parts;
    owned = t.owned;
  } else if (isFarmPumpkin(id)) {
    const t = shadePumpkin(parts);
    parts = t.parts;
    owned = t.owned;
  } else if (isFrost(id)) {
    const t = tintFrost(parts, id.startsWith('frost_pine'));
    parts = t.parts;
    owned = t.owned;
  }
  const batches: Batch[] = [];
  for (const part of parts) {
    const mesh = new InstancedMesh(part.geometry, part.material, placements.length);
    mesh.frustumCulled = false;
    mesh.castShadow = MODELS[id].shadow;
    mesh.receiveShadow = true;
    mesh.name = id;
    const entries = placements.map((placement, index) => ({ placement, index }));
    for (const e of entries) mesh.setMatrixAt(e.index, tmpM.multiplyMatrices(compose(e.placement, 1, new Matrix4()), part.local));
    mesh.instanceMatrix.needsUpdate = true;
    batches.push({ mesh, part, entries });
  }
  return { batches, owned };
}

/** Only batches holding data-driven props are touched while the scene runs. */
export function dynamicOf(batches: readonly Batch[]): Batch[] {
  return batches
    .map((b) => ({ ...b, entries: b.entries.filter((e) => DYNAMIC[e.placement.group]) }))
    .filter((b) => b.entries.length > 0);
}

export type LastCounts = { newGraves: number; coffins: number; candles: number };

/** The per-frame update: moves a data-driven prop only when its count changes. */
export function stepDynamic(dynamic: readonly Batch[], display: SceneDisplay, last: LastCounts): void {
  for (const key of ['newGraves', 'coffins', 'candles'] as const) {
    if (last[key] === display[key]) continue;
    last[key] = display[key];
    for (const b of dynamic) {
      for (const e of b.entries) {
        const g = DYNAMIC[e.placement.group];
        if (g !== key) continue;
        const k = smooth(display[g] - (e.placement.slot ?? 0));
        b.mesh.setMatrixAt(e.index, tmpM.multiplyMatrices(compose(e.placement, k, new Matrix4()), b.part.local));
      }
      b.mesh.instanceMatrix.needsUpdate = true;
    }
    display.shadowDirty = true;
  }
}

/** Frees what a batch made. The decoded files stay in drei's cache. */
export function disposeBatches(batches: readonly Batch[], owned: Owned): void {
  for (const b of batches) b.mesh.dispose();
  for (const m of owned.materials) m.dispose();
  for (const g of owned.geometries) g.dispose();
}

const fileName = (id: ModelId): string => modelFile(id).split('/').pop() ?? modelFile(id);
const warned = new Set<string>();
/** For tests. */
export const resetModelWarnings = (): void => warned.clear();

/** One model's boundary: a file that fails to load logs its name once and draws nothing. The rest of the scene stays. */
export class ModelBoundary extends Component<{ id: ModelId; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    const name = fileName(this.props.id);
    if (warned.has(name)) return;
    warned.add(name);
    console.warn(`Tabpire: model failed to load: ${name}`);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** One model of a theme's props, instanced. Suspends while the file loads. */
export function ModelBatch({ id, placements, look }: { id: ModelId; placements: readonly Placement[]; look?: ModelLook }) {
  const display = useDisplay();
  const gltf = useGLTF(modelFile(id), false, true);
  const built = useMemo(() => {
    const root = Array.isArray(gltf) ? gltf[0]!.scene : gltf.scene;
    const { batches, owned } = buildBatches(id, root, placements, look);
    return { batches, owned, dynamic: dynamicOf(batches) };
  }, [gltf, id, placements, look]);
  useEffect(() => () => disposeBatches(built.batches, built.owned), [built]);
  const last = useMemo<LastCounts>(() => ({ newGraves: -1, coffins: -1, candles: -1 }), []);
  useFrame(() => stepDynamic(built.dynamic, display, last));
  return (
    <>
      {built.batches.map((b, i) => (
        <primitive key={i} object={b.mesh} />
      ))}
    </>
  );
}

/**
 * A model with its own error boundary: a broken file skips only that model. It has no Suspense boundary of its
 * own on purpose. A loading file suspends up to the scene's Suspense, so a theme switch (a deferred render)
 * keeps the old scene on screen until every file of the new theme has loaded, instead of committing the new
 * scene with its props missing (Requirement 11.1, 11.3).
 */
export function SafeModelBatch({ id, placements, look }: { id: ModelId; placements: readonly Placement[]; look?: ModelLook }) {
  return (
    <ModelBoundary id={id}>
      <ModelBatch id={id} placements={placements} look={look} />
    </ModelBoundary>
  );
}
