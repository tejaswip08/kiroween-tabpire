import { useEffect, useMemo } from 'react';
import { Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { MOUND_SQUASH, MOUND_Y, type Mound } from '../../../../../lib/scene/uniqueScenes/frostIce';
import { buildSmoothMound } from './frostShapes';
/** The matrix of one mound: a squashed, smooth ball centred just under the snow, so its upper part shows. A drift is longer than wide. */
export function moundMatrix(m: Mound, out = new Matrix4()): Matrix4 {
  const stretch = m.stretch ?? 1;
  const squash = m.squash ?? MOUND_SQUASH;
  return out.compose(new Vector3(m.x, m.y ?? MOUND_Y, m.z), new Quaternion().setFromEuler(new Euler(0, m.rotY, 0)), new Vector3(m.radius * stretch, m.radius * squash, m.radius));
}
/**
 * Soft snowdrifts and mounds (smooth, 80 triangles each, one instanced mesh, one draw call). They are bluish where the moon does not reach,
 * and they cast the long blue shadows on the snow.
 */
export function SnowMounds({ mounds, name = 'snow-mounds' }: { mounds: readonly Mound[]; name?: string }) {
  const mesh = useMemo(() => {
    const geometry = buildSmoothMound();
    const material = new MeshStandardMaterial({ color: '#e4effc', emissive: '#27466f', emissiveIntensity: 0.35, roughness: 1, metalness: 0 });
    const m = new InstancedMesh(geometry, material, Math.max(1, mounds.length));
    m.count = mounds.length;
    const tmp = new Matrix4();
    mounds.forEach((mound, n) => m.setMatrixAt(n, moundMatrix(mound, tmp)));
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.receiveShadow = true;
    m.castShadow = true;
    m.name = name;
    return m;
  }, [mounds, name]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} />;
}
