import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { DoubleSide, Vector3 } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { MODELS, modelFile } from '../../../../lib/scene/layout';
import { useDisplay, type SceneDisplay } from './display';
import { buildBatches, dynamicOf, SafeModelBatch, stepDynamic, type Batch, type LastCounts } from './ModelBatch';
import { useSceneTheme } from './themeColors';
export { collectParts, type Part } from './ModelBatch';


/**
 * The graveyard: every prop from the seeded layout, drawn with GPU instancing so a repeated
 * model costs one draw call per mesh part. Only static props cast shadows. New graves,
 * coffins and candles rise out of the ground as the data grows, and sink as it shrinks.
 */
export function Props() {
  const { id } = useSceneTheme();
  const display = useDisplay();
  // The Crypt keeps its single load and draw. Other themes draw one boundary per model.
  return (
    <>
      {id === 'crypt' ? <CryptProps /> : <ThemeProps />}
      <CryptDoor display={display} />
    </>
  );
}

/** The other themes: one model, one boundary. A missing file skips only that model (Requirement 14.1). */
function ThemeProps() {
  const { scene } = useSceneTheme();
  const groups = useMemo(
    () => scene.models.map((id) => ({ id, placements: scene.layout.placements.filter((p) => p.model === id) })),
    [scene],
  );
  return (
    <>
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} />
      ))}
    </>
  );
}

function CryptProps() {
  const display = useDisplay();
  const { scene } = useSceneTheme();
  const lay = scene.layout;
  // Models the scene draws itself (dirt mounds, the coffin spot) have no file.
  const ids = useMemo(() => [...new Set(lay.placements.map((p) => p.model))].filter((id) => MODELS[id].source !== 'procedural'), [lay]);
  const urls = useMemo(() => ids.map(modelFile), [ids]);
  // Quaternius models are meshopt-compressed; Kaykit models are plain. Draco is never used.
  const gltfs = useGLTF(urls, false, true);
  const { batches, dynamic } = useMemo(() => {
    const list = Array.isArray(gltfs) ? gltfs : [gltfs];
    const batches: Batch[] = [];
    ids.forEach((id, i) => {
      const placements = lay.placements.filter((p) => p.model === id);
      batches.push(...buildBatches(id, list[i]!.scene, placements).batches);
    });
    return { batches, dynamic: dynamicOf(batches) };
  }, [gltfs, ids, lay]);
  const last = useMemo<LastCounts>(() => ({ newGraves: -1, coffins: -1, candles: -1 }), []);
  useFrame(() => stepDynamic(dynamic, display, last));
  return (
    <>
      {batches.map((b, i) => (
        <primitive key={i} object={b.mesh} />
      ))}
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
  const { scene } = useSceneTheme();
  const door = scene.layout.cryptDoor;
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
