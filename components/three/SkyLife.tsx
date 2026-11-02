// Low-poly, flat-shaded sky life for the graveyard: clouds, witches, bats and ghosts.
// Built from simple faceted shapes so they match the KayKit models and share the scene's light and fog.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

// ---------- Clouds ----------
const puff = new THREE.IcosahedronGeometry(1, 1);

const CLOUDS = [
  // [startX, y, z, scale, speed (units/s), color]
  [30, 15, -40, 3.2, 0.35, '#4a2478'],
  [-10, 17.5, -42, 2.6, 0.28, '#4f2780'],
  [5, 11.5, -36, 2.4, 0.5, '#7a3a9c'],
  [-28, 13.5, -38, 2.8, 0.42, '#6b3394'],
  [18, 10, -32, 2, 0.7, '#c45a9e'],
  [-18, 9.5, -30, 1.7, 0.8, '#b24b93'],
] as const;

function Cloud({ x, y, z, s, speed, color }: { x: number; y: number; z: number; s: number; speed: number; color: string }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => flat(color, { emissive: new THREE.Color(color).multiplyScalar(0.25), fog: false }), [color]);
  const blobs = useMemo(
    () => [
      [0, 0, 0, 1.25],
      [1.3, -0.15, 0.2, 1],
      [-1.3, -0.2, 0.1, 0.95],
      [0.6, 0.55, -0.2, 0.9],
      [-0.55, 0.45, 0.2, 0.8],
      [2.3, -0.35, 0, 0.7],
      [-2.2, -0.4, -0.1, 0.65],
    ],
    [],
  );
  useFrame((state) => {
    if (!g.current) return;
    // Drift right-to-left and wrap around, so the sky never empties.
    const span = 90;
    const px = ((((x - state.clock.elapsedTime * speed + 45) % span) + span) % span) - 45;
    g.current.position.set(px, y + Math.sin(state.clock.elapsedTime * 0.2 + x) * 0.3, z);
  });
  return (
    <group ref={g} scale={[s * 1.2, s * 0.75, s]}>
      {blobs.map(([bx, by, bz, r], i) => (
        <mesh key={i} geometry={puff} material={mat} position={[bx!, by!, bz!]} scale={r} />
      ))}
    </group>
  );
}

// ---------- Witch on a broomstick ----------
function Witch({ y, z, speed, scale, offset, reverse = false }: { y: number; z: number; speed: number; scale: number; offset: number; reverse?: boolean }) {
  const g = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Mesh>(null);
  // Kept out of the fog (they fly far back) with a faint glow so their colours still read against the sky.
  const m = useMemo(() => {
    const sky = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      flat(color, { fog: false, emissive: new THREE.Color(color).multiplyScalar(0.35), ...extra });
    return {
      broom: sky('#8a5530'),
      straw: sky('#e8b04a'),
      cloak: sky('#4a2a6e'),
      skin: sky('#9fd66a'),
      hat: sky('#2e1846'),
      band: sky('#f0b43a'),
      cape: sky('#7a35b0', { side: THREE.DoubleSide }),
      hair: sky('#f07a30'),
    };
  }, []);
  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime + offset;
    const span = 80;
    const raw = ((((t * speed) % span) + span) % span) - 40;
    const px = reverse ? -raw : raw;
    g.current.position.set(px, y + Math.sin(t * 1.6) * 0.5, z);
    g.current.rotation.set(Math.sin(t * 1.6) * 0.08, reverse ? Math.PI : 0, Math.sin(t * 0.8) * 0.06);
    if (cape.current) cape.current.rotation.y = 0.4 + Math.sin(t * 9) * 0.25;
  });
  return (
    <group ref={g} scale={scale}>
      <mesh material={m.broom} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
      </mesh>
      <mesh material={m.straw} position={[-1.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.28, 0.75, 7]} />
      </mesh>
      <mesh material={m.cloak} position={[0.1, 0.42, 0]} rotation={[0, 0, -0.2]}>
        <coneGeometry args={[0.4, 0.95, 7]} />
      </mesh>
      <mesh material={m.cloak} position={[0.05, 0.08, 0.16]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.12]} />
      </mesh>
      <mesh material={m.cloak} position={[0.05, 0.08, -0.16]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.12]} />
      </mesh>
      <mesh material={m.cloak} position={[0.5, 0.5, 0.12]} rotation={[0, 0, -1]}>
        <cylinderGeometry args={[0.06, 0.07, 0.6, 5]} />
      </mesh>
      <mesh material={m.skin} position={[0.28, 1.02, 0]}>
        <icosahedronGeometry args={[0.22, 1]} />
      </mesh>
      <mesh material={m.skin} position={[0.5, 1.0, 0]} rotation={[0, 0, -1.4]}>
        <coneGeometry args={[0.05, 0.22, 5]} />
      </mesh>
      <mesh material={m.hair} position={[0.12, 0.92, 0]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.2, 0.55, 6]} />
      </mesh>
      <mesh material={m.hat} position={[0.28, 1.18, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.05, 10]} />
      </mesh>
      <mesh material={m.band} position={[0.27, 1.25, 0]}>
        <cylinderGeometry args={[0.24, 0.25, 0.08, 10]} />
      </mesh>
      <mesh material={m.hat} position={[0.18, 1.58, 0]} rotation={[0, 0, 0.38]}>
        <coneGeometry args={[0.25, 0.8, 8]} />
      </mesh>
      <mesh ref={cape} material={m.cape} position={[-0.2, 0.65, 0]}>
        <planeGeometry args={[1.1, 0.7]} />
      </mesh>
    </group>
  );
}

// ---------- Bats ----------
const batWing = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.35, 0.18);
  s.lineTo(0.75, 0.08);
  s.lineTo(0.6, -0.05);
  s.lineTo(0.48, 0.02);
  s.lineTo(0.36, -0.08);
  s.lineTo(0.22, 0);
  s.lineTo(0.1, -0.1);
  s.closePath();
  return new THREE.ShapeGeometry(s);
})();

function Bat({ center, radius, height, speed, phase }: { center: [number, number, number]; radius: number; height: number; speed: number; phase: number }) {
  const g = useRef<THREE.Group>(null);
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  const m = useMemo(() => flat('#1d1030', { side: THREE.DoubleSide }), []);
  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime * speed + phase;
    g.current.position.set(center[0] + Math.cos(t) * radius, center[1] + Math.sin(t * 2.3) * height, center[2] + Math.sin(t) * radius * 0.5);
    g.current.rotation.y = -t + Math.PI / 2;
    const flap = Math.sin(state.clock.elapsedTime * 16 + phase) * 0.9;
    if (l.current) l.current.rotation.x = flap;
    if (r.current) r.current.rotation.x = flap;
  });
  return (
    <group ref={g} scale={0.9}>
      <mesh material={m}>
        <icosahedronGeometry args={[0.13, 0]} />
      </mesh>
      <mesh material={m} position={[0, 0.14, 0]}>
        <coneGeometry args={[0.05, 0.12, 4]} />
      </mesh>
      <mesh ref={r} geometry={batWing} material={m} rotation={[0, Math.PI / 2, 0]} />
      <mesh ref={l} geometry={batWing} material={m} rotation={[0, -Math.PI / 2, 0]} scale={[-1, 1, 1]} />
    </group>
  );
}

// ---------- Ghosts ----------
const ghostBody = (() => {
  const pts = [
    [0, 1.25],
    [0.28, 1.2],
    [0.46, 1.02],
    [0.54, 0.75],
    [0.55, 0.4],
    [0.6, 0.12],
    [0.48, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 10);
})();
const eye = new THREE.IcosahedronGeometry(0.07, 0);

function Ghost({ at, phase, scale = 1 }: { at: [number, number, number]; phase: number; scale?: number }) {
  const g = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      body: flat('#f4effc', { emissive: new THREE.Color('#9d8bff'), emissiveIntensity: 0.35, transparent: true, opacity: 0.9 }),
      eye: new THREE.MeshBasicMaterial({ color: '#1a0f26' }),
    }),
    [],
  );
  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime + phase;
    g.current.position.set(at[0] + Math.sin(t * 0.4) * 1.2, at[1] + Math.sin(t * 1.3) * 0.25, at[2] + Math.cos(t * 0.3) * 0.6);
    g.current.rotation.set(0, Math.sin(t * 0.4) * 0.5, Math.sin(t * 1.3) * 0.08);
  });
  return (
    <group ref={g} scale={scale}>
      <mesh geometry={ghostBody} material={m.body} />
      <mesh geometry={eye} material={m.eye} position={[-0.17, 0.85, 0.48]} scale={[1, 1.4, 0.6]} />
      <mesh geometry={eye} material={m.eye} position={[0.17, 0.85, 0.48]} scale={[1, 1.4, 0.6]} />
      <mesh geometry={eye} material={m.eye} position={[0, 0.62, 0.52]} scale={[0.9, 1.1, 0.5]} />
      <pointLight color="#b9a6ff" intensity={1.2} distance={3} position={[0, 0.7, 0.4]} />
    </group>
  );
}

export function SkyLife() {
  return (
    <>
      {CLOUDS.map(([x, y, z, s, speed, color], i) => (
        <Cloud key={i} x={x} y={y} z={z} s={s} speed={speed} color={color} />
      ))}
      <Witch y={12} z={-24} speed={2.2} scale={1.3} offset={0} />
      <Witch y={15.5} z={-34} speed={1.4} scale={0.9} offset={20} reverse />
      {[0, 1.1, 2.3, 3.2, 4.4, 5.3, 6].map((p, i) => (
        <Bat key={i} center={[6.5, 8.5, -12]} radius={3 + (i % 3) * 1.6} height={0.9} speed={0.55 + (i % 4) * 0.12} phase={p} />
      ))}
      <Ghost at={[-6.4, 1.1, 0.6]} phase={0} />
      <Ghost at={[3.8, 1.4, -2.6]} phase={2.1} scale={0.85} />
      <Ghost at={[10.5, 1.6, 1.5]} phase={4.2} scale={0.75} />
    </>
  );
}
