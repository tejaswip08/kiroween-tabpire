import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { INK, clamp01, ease, span, toon } from './toon';

/** Reads 0..1 progress of an effect that started at `start` (performance.now ms). */
export function progress(start: RefObject<number>, ms: number) {
  return clamp01((performance.now() - start.current) / ms);
}

// ---------- Particle burst (dust for stakes, embers for dawn) ----------
const COUNT = 80;

// Soft round sprite so particles read as specks, not squares.
let dot: THREE.Texture | null = null;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

export function Burst({
  start,
  ms,
  from = 0,
  color,
  rise = 0,
  spread = 1.6,
  size = 0.07,
  additive = false,
}: {
  start: RefObject<number>;
  ms: number;
  from?: number;
  color: string;
  rise?: number;
  spread?: number;
  size?: number;
  additive?: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const { geometry, dirs, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const d = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Deterministic pseudo-random directions on a sphere.
      const u = ((i * 0.618034) % 1) * 2 - 1;
      const a = i * 2.39996;
      const r = Math.sqrt(1 - u * u);
      const speed = 0.5 + ((i * 7919) % 100) / 100;
      d.set([Math.cos(a) * r * speed, u * speed * 0.8, Math.sin(a) * r * speed * 0.6], i * 3);
    }
    const m = new THREE.PointsMaterial({
      color,
      size,
      map: dotTexture(),
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    return { geometry: g, dirs: d, material: m };
  }, [color, size, additive]);

  useFrame(() => {
    const p = span(progress(start, ms), from, 1);
    const pts = points.current;
    if (!pts) return;
    pts.visible = p > 0 && p < 1;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const e = ease.out(p);
    for (let i = 0; i < COUNT; i++) {
      pos.setXYZ(
        i,
        dirs[i * 3]! * e * spread,
        0.1 + dirs[i * 3 + 1]! * e * spread + rise * p - (rise ? 0 : 0.8 * p * p),
        dirs[i * 3 + 2]! * e * spread,
      );
    }
    pos.needsUpdate = true;
    material.opacity = 1 - p;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------- Wooden stake that drops into the heart ----------
const stakeShaft = new THREE.CylinderGeometry(0.06, 0.08, 1.3, 10);
const stakeTip = new THREE.ConeGeometry(0.08, 0.32, 10);

export function FallingStake({ start, ms }: { start: RefObject<number>; ms: number }) {
  const g = useRef<THREE.Group>(null);
  const wood = useMemo(() => toon('#c79a62'), []);
  useFrame(() => {
    const p = progress(start, ms);
    const k = ease.in(span(p, 0, 0.32));
    if (!g.current) return;
    g.current.visible = p < 0.75;
    // Flies in along its own axis from the right and lands in the chest.
    const back = (1 - k) * 2.6;
    g.current.position.set(0.18 + 0.89 * back, -0.3 + 0.45 * back, 0.9);
    const shake = p > 0.32 ? Math.sin(p * 120) * 0.05 * (1 - span(p, 0.32, 0.6)) : 0;
    g.current.rotation.set(0, 0, -1.1 + shake);
  });
  return (
    <group ref={g}>
      <mesh geometry={stakeShaft} material={wood} position={[0, 0.65, 0]}>
        <Outlines thickness={0.02} color={INK} />
      </mesh>
      <mesh geometry={stakeTip} material={wood} position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
        <Outlines thickness={0.02} color={INK} />
      </mesh>
    </group>
  );
}

// ---------- Bat that escapes to the crypt ----------
const batBody = new THREE.SphereGeometry(0.14, 16, 12);
const batWing = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.35, 0.28, 0.75, 0.12);
  s.quadraticCurveTo(0.6, 0.02, 0.62, -0.12);
  s.quadraticCurveTo(0.48, -0.04, 0.4, -0.14);
  s.quadraticCurveTo(0.3, -0.04, 0.2, -0.12);
  s.quadraticCurveTo(0.12, -0.02, 0, -0.06);
  return new THREE.ShapeGeometry(s);
})();

export function FlyingBat({ start, ms, delay = 0.25 }: { start: RefObject<number>; ms: number; delay?: number }) {
  const g = useRef<THREE.Group>(null);
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => toon('#2a1f4a', { side: THREE.DoubleSide }), []);
  useFrame((state) => {
    const p = span(progress(start, ms), delay, 1);
    if (!g.current) return;
    g.current.visible = p > 0 && p < 1;
    const e = ease.inOut(p);
    g.current.position.set(Math.sin(p * 9) * 0.25 + e * 0.9, -0.1 + e * 1.5, 0.8);
    g.current.scale.setScalar((0.4 + Math.min(1, p * 4) * 0.9) * (1 - span(p, 0.75, 1)));
    const flap = Math.sin(state.clock.elapsedTime * 38) * 0.9;
    if (l.current) l.current.rotation.y = flap;
    if (r.current) r.current.rotation.y = -flap;
  });
  return (
    <group ref={g}>
      <mesh geometry={batBody} material={mat} scale={[1, 1.2, 1]} />
      <mesh ref={r} geometry={batWing} material={mat} position={[0.08, 0, 0]} />
      <mesh ref={l} geometry={batWing} material={mat} position={[-0.08, 0, 0]} scale={[-1, 1, 1]} />
    </group>
  );
}
