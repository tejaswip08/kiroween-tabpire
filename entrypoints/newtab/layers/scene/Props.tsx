import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import {
  type BufferGeometry, DoubleSide, InstancedMesh, Matrix4, type Material, Mesh, type MeshStandardMaterial, type Object3D, Quaternion, Texture, Vector3,
} from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { layout, MODELS, modelFile, type Group, type ModelId, type Placement } from '../../../../lib/scene/layout';
import { useDisplay, type SceneDisplay } from './display';


interface Part {
  geometry: BufferGeometry;
  material: Material;
  local: Matrix4;
}

/** Groups whose count follows the data. Each has one number in the display. */
const DYNAMIC: Partial<Record<Group, 'newGraves' | 'coffins' | 'candles'>> = {
  newGrave: 'newGraves',
  coffin: 'coffins',
  candle: 'candles',
};

interface Entry {
  placement: Placement;
  /** Index among the instances of this model's meshes. */
  index: number;
}
interface Batch {
  mesh: InstancedMesh;
  part: Part;
  entries: Entry[];
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Placement matrix. `k` is how much of the prop is shown (1 whole, 0 gone): it rises and grows in. */
function compose(p: Placement, k: number, out: Matrix4): Matrix4 {
  const h = MODELS[p.model].h * p.scale;
  tmpQ.setFromAxisAngle(UP, p.rotY);
  tmpP.set(p.x, p.y - (1 - k) * h * 0.6, p.z);
  const s = p.scale * Math.max(k, 0.0001);
  tmpS.set(s, s, s);
  return out.compose(tmpP, tmpQ, tmpS);
}

const smooth = (x: number) => {
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

function collectParts(root: Object3D, tint = false): Part[] {
  root.updateMatrixWorld(true);
  const parts: Part[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    let mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    if (tint) mat = darkStone(mat);
    const map = (mat as { map?: Texture | null }).map;
    if (map) map.anisotropy = 4;
    parts.push({ geometry: m.geometry, material: mat, local: m.matrixWorld.clone() });
  });
  return parts;
}

/**
 * The graveyard: every prop from the seeded layout, drawn with GPU instancing so a repeated
 * model costs one draw call per mesh part. Only static props cast shadows. New graves,
 * coffins and candles rise out of the ground as the data grows, and sink as it shrinks.
 */
export function Props() {
  const display = useDisplay();
  const lay = useMemo(() => layout(), []);
  const ids = useMemo(() => [...new Set(lay.placements.map((p) => p.model))], [lay]);
  const urls = useMemo(() => ids.map(modelFile), [ids]);
  // Quaternius models are meshopt-compressed; Kaykit models are plain. Draco is never used.
  const gltfs = useGLTF(urls, false, true);

  const { batches, dynamic } = useMemo(() => {
    const list = Array.isArray(gltfs) ? gltfs : [gltfs];
    const batches: Batch[] = [];
    ids.forEach((id, i) => {
      const placements = lay.placements.filter((p) => p.model === id);
      const gltf = list[i]!;
      for (const part of collectParts(gltf.scene, id.startsWith('path_'))) {
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
    });
    // Only batches holding data-driven props are touched while the scene runs.
    const dynamic = batches
      .map((b) => ({ ...b, entries: b.entries.filter((e) => DYNAMIC[e.placement.group]) }))
      .filter((b) => b.entries.length > 0);
    return { batches, dynamic };
  }, [gltfs, ids, lay]);

  const last = useMemo(() => ({ newGraves: -1, coffins: -1, candles: -1 }), []);
  useFrame(() => {
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
  });

  return (
    <>
      {batches.map((b, i) => (
        <primitive key={i} object={b.mesh} />
      ))}
      <CryptDoor display={display} />
    </>
  );
}

// The warm glowing doorway of the crypt: a bright arch drawn in front of the door.
const doorVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const doorFragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uColor; uniform float uLevel;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  // An arch: a rectangle with a round top, brighter toward the middle and the floor.
  float top = 1.0 - smoothstep(0.55, 1.0, length(vec2(p.x, max(p.y - 0.15, 0.0)) * vec2(1.0, 1.15)));
  float side = 1.0 - smoothstep(0.7, 1.0, abs(p.x));
  float a = top * side * (0.65 + 0.35 * (1.0 - vUv.y));
  gl_FragColor = vec4(uColor * a * uLevel, a);
}`;

function CryptDoor({ display }: { display: SceneDisplay }) {
  const door = useMemo(() => layout().cryptDoor, []);
  const uniforms = useMemo(() => ({ uColor: { value: new Vector3(1, 0.69, 0.4).multiplyScalar(LOOK.glow.door) }, uLevel: { value: 1 } }), []);
  useFrame(() => {
    uniforms.uLevel.value = 0.9 + 0.1 * Math.sin(display.time * 6.1);
  });
  return (
    <mesh position={[door.x, door.y + 0.25, door.z]} rotation={[0, door.rotY, 0]}>
      <planeGeometry args={[1.9, 2.7]} />
      <shaderMaterial
        vertexShader={doorVertex}
        fragmentShader={doorFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
        fog={false}
      />
    </mesh>
  );
}
