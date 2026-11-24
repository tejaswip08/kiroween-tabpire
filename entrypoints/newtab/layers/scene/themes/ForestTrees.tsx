import { useEffect, useMemo } from 'react';
import { InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { SCARY_VARIANTS, type ScaryTree, type Thorn } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { buildScaryTree, buildThornBush } from './forestShapes';
/** One instanced mesh of a shape at each spot, static. */
function instancesOf(geometry: BufferGeometry, spots: readonly { x: number; z: number; rotY: number; scale: number }[], name: string): InstancedMesh {
  const mesh = new InstancedMesh(geometry, undefined, Math.max(1, spots.length));
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  spots.forEach((t, i) => mesh.setMatrixAt(i, m.compose(new Vector3(t.x, 0, t.z), q.setFromAxisAngle(up, t.rotY), new Vector3(t.scale, t.scale, t.scale))));
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.name = name;
  return mesh;
}
/**
 * The scary dead trees (three shapes, one instanced mesh each) and the thorn bushes (one more) that fill the empty ground
 * on both sides of the path. Static: four draw calls.
 */
export function ForestTrees({ scary, thorns }: { scary: readonly ScaryTree[]; thorns: readonly Thorn[] }) {
  const meshes = useMemo(() => {
    const trees = Array.from({ length: SCARY_VARIANTS }, (_, v) => instancesOf(buildScaryTree(v), scary.filter((t) => t.variant === v), 'forest-scary-tree'));
    return [...trees, instancesOf(buildThornBush(), thorns, 'forest-thorns')];
  }, [scary, thorns]);
  useEffect(
    () => () => {
      for (const m of meshes) {
        m.geometry.dispose();
        m.dispose();
      }
    },
    [meshes],
  );
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m}>
          <meshStandardMaterial attach="material" vertexColors roughness={1} metalness={0} flatShading />
        </primitive>
      ))}
    </>
  );
}
