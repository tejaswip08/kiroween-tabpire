import { useMemo } from 'react';
import { BoxGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three';
/**
 * A small stone tomb for the vampire to stand on (its top is at y = 0, the vampire's feet), with a tiny candle on
 * one side and a skull or a pumpkin on the other. A few cheap meshes per view, shared by every card.
 */
const shared = (() => {
  let cache: ReturnType<typeof make> | null = null;
  function make() {
    return {
      stone: new MeshStandardMaterial({ color: '#5a4d6c', roughness: 0.95, metalness: 0 }),
      stoneDark: new MeshStandardMaterial({ color: '#40354f', roughness: 1, metalness: 0 }),
      wax: new MeshStandardMaterial({ color: '#e9ddc2', roughness: 0.8 }),
      flame: new MeshBasicMaterial({ color: '#ffb347' }),
      bone: new MeshStandardMaterial({ color: '#ddd5c3', roughness: 0.7 }),
      pumpkin: new MeshStandardMaterial({ color: '#e8731c', roughness: 0.6 }),
      stem: new MeshStandardMaterial({ color: '#4f7a2e', roughness: 0.8 }),
      slab: new BoxGeometry(1.06, 0.07, 0.68),
      body: new BoxGeometry(0.98, 0.2, 0.6),
      plinth: new BoxGeometry(1.16, 0.1, 0.76),
      candle: new CylinderGeometry(0.035, 0.04, 0.13, 12),
      flameGeo: new SphereGeometry(0.03, 10, 8),
      ball: new SphereGeometry(1, 16, 12),
      jaw: new BoxGeometry(0.09, 0.035, 0.07),
      stemGeo: new CylinderGeometry(0.012, 0.016, 0.04, 8),
    };
  }
  return () => (cache ??= make());
})();

export function Pedestal({ seed }: { seed: number }) {
  const g = useMemo(shared, []);
  const skull = seed % 2 === 0;
  return (
    <group>
      <mesh geometry={g.plinth} material={g.stoneDark} position={[0, -0.27, 0]} />
      <mesh geometry={g.body} material={g.stone} position={[0, -0.12, 0]} />
      <mesh geometry={g.slab} material={g.stone} position={[0, -0.035, 0]} />
      {/* the candle, with its flame */}
      <mesh geometry={g.candle} material={g.wax} position={[0.38, 0.065, 0.1]} />
      <mesh geometry={g.flameGeo} material={g.flame} position={[0.38, 0.16, 0.1]} scale={[1, 1.5, 1]} />
      {skull ? (
        <group position={[-0.38, 0.07, 0.1]}>
          <mesh geometry={g.ball} material={g.bone} scale={0.07} />
          <mesh geometry={g.jaw} material={g.bone} position={[0, -0.055, 0.025]} />
        </group>
      ) : (
        <group position={[-0.38, 0.065, 0.1]}>
          <mesh geometry={g.ball} material={g.pumpkin} scale={[0.09, 0.07, 0.09]} />
          <mesh geometry={g.stemGeo} material={g.stem} position={[0, 0.075, 0]} />
        </group>
      )}
    </group>
  );
}
