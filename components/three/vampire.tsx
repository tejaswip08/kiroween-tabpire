// The Tabpire Count: a custom AI-generated vampire (Tripo, from our own concept art).
// The model has no skeleton, so every state and action is animated as whole-body motion.
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Stage } from '../../lib/hunger';
import { Burst, FallingStake, FlyingBat, progress } from './Effects';
import { RisingCoffin } from './kenney';
import { FX_MS, ease, span, type Fx } from './toon';

const URL = '/models/vampire.glb';
useGLTF.preload(URL);

const WHITE = new THREE.Color('#ffffff');
const CORPSE = new THREE.Color('#a7abd6');
const FLUSH = new THREE.Color('#ffd6e2');
const EMBER = new THREE.Color('#ff7a2a');
const CHAR = new THREE.Color('#15100c');

export interface VampireProps {
  stage: Stage;
  pallor: number;
  variant?: number;
  fx?: Fx;
  /** Increment to make the vampire do a quick celebratory hop. */
  cheer?: number;
  height?: number;
}

export function Vampire({ stage, pallor, variant = 0, fx, cheer = 0, height = 1.25 }: VampireProps) {
  const { scene } = useGLTF(URL);
  const model = useMemo(() => {
    const obj = scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
        mats.push(mesh.material as THREE.MeshStandardMaterial);
      }
    });
    return { obj, mats };
  }, [scene]);
  useEffect(() => () => model.mats.forEach((m) => m.dispose()), [model]);

  const root = useRef<THREE.Group>(null); // position + facing
  const body = useRef<THREE.Group>(null); // squash, lean, fall
  const fxStart = useRef(0);
  const cheerStart = useRef(-1e9);
  const pal = useRef(pallor);
  const seed = (variant % 97) * 0.61;

  useEffect(() => {
    if (fx) fxStart.current = performance.now();
  }, [fx]);
  useEffect(() => {
    if (cheer) cheerStart.current = performance.now();
  }, [cheer]);

  useFrame((state, dt) => {
    const r = root.current;
    const b = body.current;
    if (!r || !b) return;
    const t = state.clock.elapsedTime + seed;
    const px = state.pointer.x;
    pal.current = THREE.MathUtils.damp(pal.current, stage === 'feeding' ? 0 : pallor, 3, dt);

    // ---- Idle life per state ----
    let x = 0;
    let y = 0;
    let face = px * 0.55; // look towards the cursor
    let lean = 0; // forward/back tilt
    let roll = Math.sin(t * 1.1) * 0.03;
    let squash = 1 + Math.sin(t * 2.2) * 0.015; // breathing
    if (stage === 'feeding') {
      y = Math.abs(Math.sin(t * 4.2)) * 0.06; // happy bounce
      roll = Math.sin(t * 4.2) * 0.07;
      squash = 1 + Math.abs(Math.sin(t * 4.2)) * 0.03;
    } else if (stage === 'starving') {
      // Restless pacing: stride side to side, turning to face the way it walks.
      const pace = Math.sin(t * 0.9);
      x = pace * 0.2;
      face = Math.cos(t * 0.9) > 0 ? 0.9 : -0.9;
      y = Math.abs(Math.sin(t * 5.4)) * 0.035;
      roll = Math.sin(t * 5.4) * 0.05;
      lean = 0.12; // hunched and hungry
    } else if (stage === 'garlic') {
      // Frightened of the garlic: leans back, turned away, trembling.
      face = -0.7;
      lean = -0.14;
      x = Math.sin(t * 38) * 0.008;
      roll = Math.sin(t * 31) * 0.02;
    } else {
      roll += Math.sin(t * 0.6) * 0.02;
    }

    const ch = (performance.now() - cheerStart.current) / 900;
    if (ch < 1) {
      y += Math.abs(Math.sin(ch * Math.PI * 2)) * 0.35 * (1 - ch * 0.4);
      face += ch * Math.PI * 2;
    }

    // ---- Action effects ----
    let scale = 1;
    let charK = 0;
    let emberK = 0;
    let fall = 0;
    let sink = 0;
    if (fx) {
      const p = progress(fxStart, FX_MS[fx]);
      face = 0;
      x = 0;
      if (fx === 'stake') {
        if (p > 0.3 && p < 0.45) x = Math.sin(p * 220) * 0.03; // impact shudder
        fall = ease.in(span(p, 0.38, 0.62)); // topples backwards
        charK = span(p, 0.4, 0.8) * 0.75;
        scale = 1 - ease.in(span(p, 0.68, 1));
      } else if (fx === 'burn') {
        emberK = Math.sin(span(p, 0, 0.6) * Math.PI);
        charK = span(p, 0.3, 0.85);
        y += span(p, 0.45, 1) * 0.35;
        scale = 1 - ease.in(span(p, 0.6, 1));
      } else if (fx === 'crypt') {
        const hop = span(p, 0, 0.4);
        y += Math.sin(hop * Math.PI) * 0.45;
        face = ease.inOut(span(p, 0.1, 0.5)) * Math.PI * 4;
        scale = 1 - ease.inOut(span(p, 0.3, 0.55));
      } else if (fx === 'coffin') {
        sink = ease.in(span(p, 0.15, 0.6)) * 1.1;
      }
    }

    r.position.set(x, y - sink, 0);
    r.rotation.y = fx || ch < 1 || stage === 'starving' ? face : THREE.MathUtils.damp(r.rotation.y, face, 4, dt);
    if (stage === 'starving' && !fx) r.rotation.y = THREE.MathUtils.damp(r.rotation.y, face, 3, dt);
    r.scale.setScalar(Math.max(0.0001, scale) * height);
    b.rotation.set(lean - fall * (Math.PI / 2 - 0.15), 0, roll);
    b.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // ---- Colour: pallor, flush, embers, char ----
    const glow = stage === 'starving' && !fx ? 0.05 + Math.sin(t * 5) * 0.04 : 0;
    for (const m of model.mats) {
      m.color
        .copy(WHITE)
        .lerp(stage === 'feeding' ? FLUSH : CORPSE, stage === 'feeding' ? 0.3 : pal.current * 0.7)
        .lerp(EMBER, emberK * 0.6)
        .lerp(CHAR, charK);
      m.emissive.setRGB(glow + emberK * 0.5, emberK * 0.15, 0);
    }
  });

  return (
    <group>
      <group ref={root}>
        {/* Pivot at the heels so leaning and falling rotate around the feet. */}
        <group ref={body}>
          <primitive object={model.obj} />
        </group>
      </group>
      {fx === 'stake' && (
        <group position={[0, height * 0.42, 0.2]} scale={height * 0.42}>
          <FallingStake start={fxStart} ms={FX_MS.stake} />
          <Burst start={fxStart} ms={FX_MS.stake} from={0.62} color="#d8cfc0" spread={1.4} size={0.035} />
        </group>
      )}
      {fx === 'burn' && (
        <group position={[0, height * 0.35, 0]} scale={height * 0.45}>
          <Burst start={fxStart} ms={FX_MS.burn} from={0.2} color="#ffb15c" rise={2.2} spread={1.2} size={0.05} additive />
          <Burst start={fxStart} ms={FX_MS.burn} from={0.55} color="#4a4038" rise={1.2} spread={1.4} size={0.035} />
        </group>
      )}
      {fx === 'crypt' && (
        <group position={[0, height * 0.6, 0]} scale={height * 0.5}>
          <FlyingBat start={fxStart} ms={FX_MS.crypt} delay={0.4} />
        </group>
      )}
      {fx === 'coffin' && <RisingCoffin start={fxStart} />}
    </group>
  );
}
