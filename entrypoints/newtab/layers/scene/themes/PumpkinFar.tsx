import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry, type Matrix4 } from 'three';
import { buildPumpkinFar } from '../../../../../lib/scene/uniqueScenes/pumpkinFar';
import { themeById } from '../../../../../lib/themes';
import { useDisplay } from '../display';
import { flicker } from './HauntedHouse';
import { GLOW_COLOR } from './houseBuild';
import { buildPumpkinFarShapes, mistBands } from './pumpkinFarBuild';

const GLOW = new Color(GLOW_COLOR);
/** The mist takes the Pumpkin Patch's dusk haze colour. */
const HAZE = themeById('pumpkin').scene.haze;

function instanced(geo: BufferGeometry, at: readonly Matrix4[], material: MeshStandardMaterial | MeshBasicMaterial, name: string): InstancedMesh {
  const mesh = new InstancedMesh(geo, material, Math.max(1, at.length));
  at.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = at.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

/**
 * The Pumpkin Patch's far scenery, in layers that the fog fades into the dusk: dark rolling hills on the horizon with two
 * crooked farmhouses (lit windows), an old church steeple, a water tower and a small farm village; bare dead trees with
 * crows, autumn trees and scarecrows in the middle; a broken fence, a hay wagon, stacked hay, a well and a shed near the
 * field edges; and bands of ground mist between them. Eleven draw calls; repeated things are instanced. The windows flicker
 * slowly (steady with reduced motion).
 */
export function PumpkinFar({ seed }: { seed: number }) {
  const display = useDisplay();
  const built = useMemo(() => {
    const far = buildPumpkinFar(seed);
    const s = buildPumpkinFarShapes(far);
    const solid = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: DoubleSide });
    const lit = new MeshBasicMaterial({ color: GLOW.clone(), fog: true });
    const hazeColor = new Color(HAZE);
    const mist = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: DoubleSide });
    const mistGeo = mistBands(far, [hazeColor.r, hazeColor.g, hazeColor.b]);
    const meshes = [
      instanced(s.village.geo, s.village.at, solid, 'pumpkin-far-village'),
      instanced(s.village.win, s.village.at, lit, 'pumpkin-far-village-windows'),
      instanced(s.deadTrees.geo, s.deadTrees.at, solid, 'pumpkin-far-dead-trees'),
      instanced(s.crows.geo, s.crows.at, solid, 'pumpkin-far-crows'),
      instanced(s.autumnTrees.geo, s.autumnTrees.at, solid, 'pumpkin-far-autumn-trees'),
      instanced(s.scarecrows.geo, s.scarecrows.at, solid, 'pumpkin-far-scarecrows'),
      instanced(s.fence.geo, s.fence.at, solid, 'pumpkin-far-fence'),
      instanced(s.hay.geo, s.hay.at, solid, 'pumpkin-far-hay'),
    ];
    const geos = [s.statics, s.windows, mistGeo, s.village.geo, s.village.win, s.deadTrees.geo, s.crows.geo, s.autumnTrees.geo, s.scarecrows.geo, s.fence.geo, s.hay.geo];
    return { s, solid, lit, mist, mistGeo, meshes, geos };
  }, [seed]);
  useEffect(
    () => () => {
      for (const g of built.geos) g.dispose();
      built.solid.dispose();
      built.lit.dispose();
      built.mist.dispose();
    },
    [built],
  );
  useFrame(() => {
    built.lit.color.copy(GLOW).multiplyScalar(display.reduced ? 0.85 : flicker(display.time, 1.1));
  });
  return (
    <group name="pumpkin-far">
      <mesh geometry={built.s.statics} material={built.solid} name="pumpkin-far-buildings" />
      <mesh geometry={built.s.windows} material={built.lit} name="pumpkin-far-windows" />
      {built.meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      <mesh geometry={built.mistGeo} material={built.mist} name="pumpkin-far-mist" renderOrder={1} />
    </group>
  );
}
