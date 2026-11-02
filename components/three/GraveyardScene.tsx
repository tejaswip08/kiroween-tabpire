import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Kay } from './kaykit';
import { SkyLife } from './SkyLife';

// The full-page 3D graveyard behind every page: KayKit models lit by the moon, jack-o'-lanterns,
// candles and lanterns, with fog, glowing embers and bloom. Purely decorative.

const SKY = ['#170838', '#2c1059', '#561d7c', '#a4377f', '#d4528a'];
const FOG = '#5e2176';

function useSkyTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    SKY.forEach((col, i) => grad.addColorStop([0, 0.32, 0.58, 0.8, 1][i]!, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/** A flickering light source: a warm point light plus a tiny over-bright core that blooms. */
function Flame({ position, color = '#ff9a3c', power = 6, range = 4, size = 0.08, seed = 0 }: {
  position: [number, number, number];
  color?: string;
  power?: number;
  range?: number;
  size?: number;
  seed?: number;
}) {
  const light = useRef<THREE.PointLight>(null);
  const core = useRef<THREE.Mesh>(null);
  const hot = useMemo(() => new THREE.Color(color).multiplyScalar(6), [color]);
  useFrame((state) => {
    const t = state.clock.elapsedTime + seed;
    const f = 0.82 + Math.sin(t * 11) * 0.08 + Math.sin(t * 6.3) * 0.1;
    if (light.current) light.current.intensity = power * f;
    if (core.current) core.current.scale.setScalar(0.85 + f * 0.25);
  });
  return (
    <group position={position}>
      <pointLight ref={light} color={color} distance={range} decay={1.6} />
      <mesh ref={core}>
        <sphereGeometry args={[size, 12, 8]} />
        <meshBasicMaterial color={hot} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Soft drifting ground mist made of large glowing sprites. */
function GroundMist() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,190,240,0.55)');
    grad.addColorStop(1, 'rgba(255,190,240,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ x: -14 + i * 3.6, z: -6 + ((i * 37) % 9), s: 7 + (i % 3) * 2 })),
    [],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    group.current?.children.forEach((c, i) => {
      c.position.x = puffs[i]!.x + Math.sin(t * 0.08 + i) * 2;
    });
  });
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} position={[p.x, 0.6, p.z]} scale={[p.s, p.s * 0.28, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.5} />
        </sprite>
      ))}
    </group>
  );
}

/** Slow cinematic drift plus a little pointer parallax. */
function CameraRig() {
  const { camera } = useThree();
  const look = useMemo(() => new THREE.Vector3(0, 2.6, -1), []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const tx = Math.sin(t * 0.05) * 0.8 + state.pointer.x * 0.9;
    const ty = 3.4 + state.pointer.y * 0.35;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 2, dt);
    camera.lookAt(look);
  });
  return null;
}

function Moon() {
  return (
    <group position={[19, 16, -44]}>
      <mesh>
        <sphereGeometry args={[3.4, 48, 32]} />
        <meshBasicMaterial color={new THREE.Color('#fff2fb').multiplyScalar(1.6)} toneMapped={false} fog={false} />
      </mesh>
      {[[0.9, 0.6, 0.9], [-1.1, -0.7, 0.6], [0.2, -1.4, 0.45]].map(([x, y, r], i) => (
        <mesh key={i} position={[x!, y!, 3.2]}>
          <circleGeometry args={[r!, 24]} />
          <meshBasicMaterial color="#e3c2f2" transparent opacity={0.6} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

function Graveyard() {
  const sky = useSkyTexture();
  const { scene } = useThree();
  useMemo(() => {
    scene.background = sky;
  }, [scene, sky]);

  return (
    <>
      <fog attach="fog" args={[FOG, 22, 58]} />
      <hemisphereLight args={['#a58bff', '#2a0f3a', 0.9]} />
      <directionalLight
        position={[10, 14, -12]}
        intensity={1.8}
        color="#cdc8ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[0, 6, 14]} intensity={0.55} color="#ff9ec9" />

      <Moon />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#2b1742" roughness={1} />
      </mesh>

      {/* Back: crypt, gate and autumn trees */}
      <Kay name="crypt" position={[6, 0, -10]} rotation={[0, -0.45, 0]} scale={0.8} />
      <Flame position={[5.2, 1.6, -6.6]} color="#c77dff" power={9} range={6} size={0.001} />
      <Kay name="arch_gate" position={[0, 0, -4.5]} />
      <Kay name="tree_pine_orange_large" position={[-11, 0, -10]} />
      <Kay name="tree_pine_yellow_medium" position={[-5, 0, -13]} rotation={[0, 1, 0]} />
      <Kay name="tree_pine_orange_medium" position={[1.5, 0, -14]} rotation={[0, 2, 0]} />
      <Kay name="tree_pine_orange_large" position={[12.5, 0, -12]} rotation={[0, 0.6, 0]} />
      <Kay name="tree_dead_large" position={[-15, 0, -5]} scale={1.2} />

      {/* Fence line either side of the gate */}
      {[-4.1, -8.1, -12.1].map((x) => (
        <Kay key={x} name={x === -8.1 ? 'fence_broken' : 'fence'} position={[x, 0, -4.5]} />
      ))}
      {[4.1, 8.1, 12.1].map((x) => (
        <Kay key={x} name="fence" position={[x, 0, -4.5]} />
      ))}
      {[-2.1, -6.1, -10.1, -14.1, 2.1, 6.1, 10.1, 14.1].map((x) => (
        <Kay key={x} name="fence_pillar" position={[x, 0, -4.5]} />
      ))}

      {/* Middle: the twisted tree, lantern post and shrine */}
      <Kay name="tree_dead_large_decorated" position={[-8.2, 0, -1]} scale={1.35} rotation={[0, 0.4, 0]} />
      <Kay name="tree_dead_medium" position={[9.4, 0, -1.6]} scale={1.2} rotation={[0, -0.6, 0]} />
      <Kay name="post_lantern" position={[-10.8, 0, 2.2]} rotation={[0, 0.6, 0]} />
      <Flame position={[-10.4, 2.95, 2.75]} color="#ffcf7a" power={8} range={7} size={0.12} seed={2} />
      <Kay name="shrine_candles" position={[7.6, 0, -0.8]} rotation={[0, -0.5, 0]} />
      <Flame position={[7.6, 1.35, -0.4]} color="#ffb35c" power={4} range={4} size={0.05} seed={4} />
      <Kay name="coffin_decorated" position={[-4.6, 0, -1.6]} rotation={[0, 0.5, 0]} scale={0.6} />

      {/* Front: graves, jack-o'-lanterns, candles and bones */}
      <Kay name="gravestone" position={[-5.2, 0, 2.2]} rotation={[0, 0.25, 0]} />
      <Kay name="grave_A" position={[-2.6, 0, 2.6]} rotation={[0, -0.1, 0]} />
      <Kay name="gravemarker_A" position={[3.2, 0, 2.4]} rotation={[0, -0.3, 0]} />
      <Kay name="grave_B" position={[5.6, 0, 1.6]} rotation={[0, -0.35, 0]} />
      <Kay name="gravemarker_B" position={[-7, 0, 4.2]} rotation={[0, 0.5, 0]} />

      <Kay name="pumpkin_orange_jackolantern" position={[-3.9, 0, 4.7]} rotation={[0, 0.45, 0]} />
      <Flame position={[-3.9, 0.55, 4.7]} power={9} range={5} size={0.001} seed={1} />
      <Kay name="pumpkin_yellow_jackolantern" position={[1.4, 0, 5]} rotation={[0, -0.35, 0]} scale={0.8} />
      <Flame position={[1.4, 0.45, 5]} power={8} range={4.5} size={0.001} seed={3} />
      <Kay name="pumpkin_orange_jackolantern" position={[7.2, 0, 4]} rotation={[0, -0.6, 0]} scale={1.1} />
      <Flame position={[7.2, 0.6, 4]} power={10} range={5} size={0.001} seed={5} />
      <Kay name="pumpkin_orange" position={[-1.2, 0, 5.6]} scale={0.7} />
      <Kay name="pumpkin_yellow_small" position={[4.5, 0, 5.3]} />
      <Kay name="lantern_standing" position={[9.6, 0, 3]} />
      <Flame position={[9.6, 0.5, 3]} color="#ffcf7a" power={6} range={4} size={0.07} seed={6} />
      <Kay name="candle_triple" position={[2.4, 0, 3.6]} />
      <Flame position={[2.4, 0.86, 3.6]} color="#ffb35c" power={3} range={3} size={0.05} seed={7} />
      <Kay name="skull_candle" position={[-0.5, 0, 4.2]} rotation={[0, 0.3, 0]} scale={0.8} />
      <Flame position={[-0.5, 1.02, 4.2]} color="#ffb35c" power={3} range={3} size={0.05} seed={8} />
      <Kay name="ribcage" position={[-6.2, 0, 5.6]} rotation={[0, 0.8, 0]} scale={0.8} />
      <Kay name="bone_A" position={[5.8, 0.05, 5.8]} rotation={[0, 1.2, 0]} />

      {/* More of the graveyard: a stone path to the gate, skull posts, hanging lanterns and more */}
      {[6.2, 4.3, 2.4, 0.5, -1.4, -3.3].map((z, i) => (
        <Kay key={z} name={(['path_A', 'path_B', 'path_C'] as const)[i % 3]!} position={[0, 0.01, z]} rotation={[0, i * 1.57, 0]} shadows={false} />
      ))}
      <Kay name="post_skull" position={[-2.7, 0, -3.1]} rotation={[0, 0.2, 0]} scale={0.42} />
      <Kay name="post_skull" position={[2.7, 0, -3.1]} rotation={[0, -0.2, 0]} scale={0.42} />
      <Kay name="lantern_hanging" position={[-6.75, 4.7, -0.7]} scale={0.8} />
      <Flame position={[-6.75, 3.95, -0.7]} color="#ffcf7a" power={5} range={5} size={0.08} seed={9} />
      <Kay name="lantern_hanging" position={[10.3, 3.9, -1.4]} scale={0.7} />
      <Flame position={[10.3, 3.25, -1.4]} color="#ffcf7a" power={4} range={4} size={0.07} seed={10} />
      <Kay name="bench_decorated" position={[-12.6, 0, 0.8]} rotation={[0, 0.9, 0]} scale={0.8} />
      <Kay name="plaque_candles" position={[12.4, 0, 3.4]} rotation={[0, -0.7, 0]} scale={0.8} />
      <Flame position={[12.4, 0.95, 3.4]} color="#ffb35c" power={3} range={3} size={0.05} seed={11} />
      <Kay name="grave_A_destroyed" position={[-9.3, 0, 4.4]} rotation={[0, 0.4, 0]} />
      <Kay name="arch" position={[13.5, 0, -6.5]} rotation={[0, -0.8, 0]} scale={0.8} />
      <Kay name="pillar" position={[-3.9, 0, -9]} scale={0.7} />
      <Kay name="pillar" position={[9.6, 0, -8.6]} scale={0.6} />
      <Kay name="pumpkin_orange_jackolantern" position={[3.3, 0, -6.4]} scale={0.7} rotation={[0, -0.2, 0]} />
      <Flame position={[3.3, 0.45, -6.4]} power={6} range={4} size={0.001} seed={12} />
      <Kay name="pumpkin_yellow_jackolantern" position={[-12.2, 0, 3.6]} scale={0.8} rotation={[0, 0.7, 0]} />
      <Flame position={[-12.2, 0.5, 3.6]} power={6} range={4} size={0.001} seed={13} />
      <Kay name="pumpkin_orange" position={[-1.5, 0, 0.6]} scale={0.5} />
      <Kay name="pumpkin_yellow_small" position={[1.6, 0, 1.2]} />
      <Kay name="pumpkin_orange" position={[8.6, 0, 5.4]} scale={0.6} />
      <Kay name="candle_thin" position={[-1.3, 0, 2.6]} />
      <Flame position={[-1.3, 0.82, 2.6]} color="#ffb35c" power={2} range={2.5} size={0.04} seed={14} />
      <Kay name="candle_thin" position={[1.25, 0, -0.4]} />
      <Flame position={[1.25, 0.82, -0.4]} color="#ffb35c" power={2} range={2.5} size={0.04} seed={15} />
      <Kay name="skull" position={[5, 0, 6.2]} scale={0.4} rotation={[0, -0.6, 0]} />
      <Kay name="bone_B" position={[-2.4, 0.04, 6.4]} rotation={[0, 0.4, 0]} />
      <Kay name="bone_C" position={[3.8, 0.04, 3.2]} rotation={[0, 2, 0]} />

      <Stars radius={70} depth={25} count={1400} factor={3.5} saturation={0} fade speed={0.6} />
      <SkyLife />
      <GroundMist />
      <Sparkles count={70} scale={[26, 4, 14]} position={[0, 1.6, 0]} size={4} speed={0.35} color="#ffb35c" opacity={0.9} />
      <Sparkles count={40} scale={[30, 6, 18]} position={[0, 3, -4]} size={3} speed={0.2} color="#d6a6ff" opacity={0.7} />

      <CameraRig />
    </>
  );
}

/** Fixed, full-page canvas behind all content. */
export function GraveyardCanvas() {
  return (
    <Canvas
      className="graveyard-canvas"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 3.4, 22], fov: 34, near: 0.5, far: 140 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      eventSource={document.getElementById('root')!}
      eventPrefix="client"
    >
      <Suspense fallback={null}>
        <Graveyard />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.9} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette offset={0.25} darkness={0.55} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
