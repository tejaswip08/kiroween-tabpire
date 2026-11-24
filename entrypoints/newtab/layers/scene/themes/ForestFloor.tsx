import { useEffect, useMemo } from 'react';
import { DoubleSide, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
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
  const ribbon = useMemo(() => buildPathRibbon(path.centre, path.halfWidth, 0.03), [path]);
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
        <meshStandardMaterial color="#6e3320" emissive="#2e1008" emissiveIntensity={0.9} roughness={1} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
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
