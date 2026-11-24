import { useEffect, useMemo } from 'react';
import { BufferAttribute, Color, DoubleSide, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { FIRE, type Grass, type Grave, type Tuft } from '../../../../../lib/scene/uniqueScenes/forestParts';
import type { UniquePath } from '../../../../../lib/scene/uniqueScenes/types';
import { buildForestGround, buildGraves, buildPlant, buildTuft } from './forestShapes';
import { buildPathRibbon } from './shapes';
/** One instanced mesh of a shape standing at each spot. Static: the matrices are written once. */
function instancesOf(geometry: BufferGeometry, spots: readonly Tuft[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, undefined, Math.max(1, spots.length));
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  spots.forEach((t, i) => mesh.setMatrixAt(i, m.compose(new Vector3(t.x, 0, t.z), q.setFromAxisAngle(up, t.rotY), new Vector3(t.width, t.height, t.width))));
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}
/**
 * The ground of the Witch's Forest and what lies on it: a near-black ground that is warm on the left and green on the right,
 * the dark reddish-brown dirt path winding into the mist, rough grass and small dark plants at its edges, and the crooked
 * crosses and tiny tombstones. Every part is one mesh (grass and plants instanced), so five draw calls.
 */
export function ForestFloor({ path, graves, grass }: { path: UniquePath; graves: readonly Grave[]; grass: Grass }) {
  const ground = useMemo(() => buildForestGround(FIRE), []);
  // The dirt path is a lighter, warmer brown than the ground and fades gently toward the cottage. It ignores the scene fog (the
  // haze is in its colours), so the whole winding path stays plainly visible up to the door.
  const ribbon = useMemo(() => {
    const g = buildPathRibbon(path.centre, path.halfWidth, 0.03);
    const near = new Color('#b0643a');
    const far = new Color('#6f6a44');
    const c = new Color();
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c.copy(near).lerp(far, Math.min(1, Math.max(0, (i / 2 / Math.max(1, n / 2 - 1)) ** 1.3)));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  }, [path]);
  const stones = useMemo(() => buildGraves(graves), [graves]);
  const tufts = useMemo(() => instancesOf(buildTuft(), grass.tufts), [grass]);
  const plants = useMemo(() => instancesOf(buildPlant(), grass.plants), [grass]);
  useEffect(() => () => ground.dispose(), [ground]);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  useEffect(() => () => stones.dispose(), [stones]);
  useEffect(
    () => () => {
      tufts.geometry.dispose();
      tufts.dispose();
    },
    [tufts],
  );
  useEffect(
    () => () => {
      plants.geometry.dispose();
      plants.dispose();
    },
    [plants],
  );
  return (
    <>
      <mesh geometry={ground} position={[0, 0, -40]} receiveShadow name="forest-ground">
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={ribbon} receiveShadow name="forest-path">
        <meshStandardMaterial vertexColors emissive="#3a1a0c" emissiveIntensity={0.9} roughness={1} metalness={0} fog={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={stones} castShadow receiveShadow name="forest-graves">
        <meshStandardMaterial vertexColors roughness={1} metalness={0} flatShading />
      </mesh>
      <primitive object={tufts} name="forest-grass">
        <meshStandardMaterial attach="material" vertexColors roughness={1} metalness={0} side={DoubleSide} />
      </primitive>
      <primitive object={plants} name="forest-plants">
        <meshStandardMaterial attach="material" vertexColors roughness={1} metalness={0} side={DoubleSide} />
      </primitive>
    </>
  );
}
