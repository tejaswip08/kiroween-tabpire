import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { PortraitRef } from './shared';

function wingGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0.06, 0, 0.55, 0.26, 0, 0.3, -0.1, 0, 0.3, -0.1, 0, 0.55, 0.26, 0, 0.42, -0.2, 0], 3));
  return g;
}

/**
 * The bat the vampire turns into when it is saved to the Crypt: a flash, then a dark bat with red
 * eyes that flaps and flies up and out of the portrait.
 */
export function BatForm({ state }: { state: PortraitRef }) {
  const root = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const geo = useMemo(wingGeometry, []);
  useFrame(() => {
    const r = root.current;
    const ex = state.current?.exit;
    if (!r) return;
    r.visible = !!ex && (ex.bat.alpha > 0.01 || ex.flash > 0.01);
    if (!r.visible || !ex) return;
    r.position.set(ex.bat.x, ex.bat.y + 0.3, 0.1);
    r.scale.setScalar(ex.bat.scale);
    const flap = Math.sin(ex.bat.flapPhase) * 0.7;
    if (left.current) left.current.rotation.z = flap;
    if (right.current) right.current.rotation.z = -flap;
    r.children.forEach((c) => {
      if (c !== flash.current) c.visible = ex.bat.alpha > 0.01;
    });
    if (flash.current) {
      flash.current.visible = ex.flash > 0.01;
      (flash.current.material as MeshBasicMaterial).opacity = ex.flash;
      flash.current.scale.setScalar(0.5 + ex.flash * 0.6);
    }
  });
  return (
    <group ref={root} visible={false}>
      <mesh ref={flash} position={[0, -0.25, 0.05]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color={[3.2, 2.2, 1.6]} toneMapped={false} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#0a0412" />
      </mesh>
      <group ref={left}>
        <mesh geometry={geo}>
          <meshBasicMaterial color="#0a0412" side={DoubleSide} />
        </mesh>
      </group>
      <group ref={right} scale={[-1, 1, 1]}>
        <mesh geometry={geo}>
          <meshBasicMaterial color="#0a0412" side={DoubleSide} />
        </mesh>
      </group>
      {[-0.035, 0.035].map((x) => (
        <mesh key={x} position={[x, 0.04, 0.02]}>
          <circleGeometry args={[0.017, 8]} />
          <meshBasicMaterial color={[3.4, 0.3, 0.25]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
