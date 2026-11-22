import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type Group, type Mesh, type MeshBasicMaterial, Shape, ShapeGeometry } from 'three';
import { COFFIN } from '../../../../lib/vampire/rig';
import { useReducedMotion } from '../motion';
import type { PortraitRef } from './shared';

const LOOP = 3.6;
const COUNT = 3;

/** A flat "Z" drawn from its outline, so no font is needed. */
function zGeometry(): ShapeGeometry {
  const s = new Shape();
  const pts: [number, number][] = [[0, 1], [1, 1], [1, 0.82], [0.32, 0.18], [1, 0.18], [1, 0], [0, 0], [0, 0.18], [0.68, 0.82], [0, 0.82]];
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x - 0.5, y - 0.5) : s.lineTo(x - 0.5, y - 0.5)));
  s.closePath();
  return new ShapeGeometry(s);
}

/**
 * Small glowing "z" letters that float up from the sleeping vampire, drift sideways a little and
 * fade out, one third of a loop apart. They are cold blue in HDR, so they glow.
 */
export function Zs({ state }: { state: PortraitRef }) {
  const reduced = useReducedMotion();
  const group = useRef<Group>(null);
  const geo = useMemo(zGeometry, []);
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock, camera }) => {
    const g = group.current;
    const s = state.current;
    if (!g || !s) return;
    const asleep = s.pose.lying * s.pose.eyesClosed;
    g.visible = asleep > 0.4 && !s.exit;
    if (!g.visible) return;
    const t = reduced ? 0.45 * LOOP : clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const phase = (((t / LOOP + i / COUNT) % 1) + 1) % 1;
      const size = 0.06 + 0.07 * phase;
      m.position.set(0.05 + phase * 0.22 + Math.sin(phase * 6) * 0.03, 0.42 + phase * 0.55, -COFFIN.length * 0.28);
      m.scale.setScalar(size);
      m.quaternion.copy(camera.quaternion);
      (m.material as MeshBasicMaterial).opacity = Math.sin(Math.PI * phase) ** 1.5 * 0.95;
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={geo}
        >
          <meshBasicMaterial color={[0.55, 1.1, 2.6]} toneMapped={false} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
