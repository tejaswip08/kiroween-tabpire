import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { type Group, type Mesh, type MeshStandardMaterial } from 'three';
import type { VampireState } from '../../../../lib/hunger';
import { coffinFit } from '../../../../lib/vampire/rig';
import { exitDurationMs, exitFrame, exitRemoves, type ExitFrame } from '../../../../lib/vampire/exits';
import { approachPose, BLEND_RATE, lookAngles, NO_LOOK, statePose, type Pose } from '../../../../lib/vampire/pose';
import { useReducedMotion } from '../motion';
import { cursor } from './cursor';
import { makeEyelids } from './eyelids';
import type { ExitRun, PortraitRef } from './shared';
import { makeVampireMaterial } from './vampireMaterial';

export const VAMPIRE_URL = '/models/vampire.glb';
// The vampire is loaded once and shared by every card. It needs the meshopt decoder, not Draco.
useGLTF.preload(VAMPIRE_URL, false, true);

/** Window pixels from the portrait's centre to the cursor, in portrait sizes. */
function cursorLook(el: HTMLElement) {
  if (!cursor.known) return NO_LOOK;
  const r = el.getBoundingClientRect();
  return lookAngles((cursor.x - (r.left + r.width / 2)) / r.width, (cursor.y - (r.top + r.height / 2)) / r.height);
}

/**
 * The 3D vampire for one card. Every card gets its own material copy (sharing the textures), its
 * own start time and speed from the tab id, and blends smoothly when the card's state changes.
 */
export function Vampire({
  slotEl,
  state,
  seed,
  poseRef,
  exitRun,
}: {
  slotEl: HTMLElement;
  state: VampireState;
  seed: number;
  /** Receives the pose and material controls each frame, for the coffin, the z letters and the camera. */
  poseRef: PortraitRef;
  /** The exit or transition that is playing, if any. */
  exitRun: { current: ExitRun | null };
}) {
  const reduced = useReducedMotion();
  const gltf = useGLTF(VAMPIRE_URL, false, true);
  const group = useRef<Group>(null);
  const current = useRef<Pose | null>(null);

  const { mesh, material, uniforms, lids } = useMemo(() => {
    let source: Mesh | undefined;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!source && (o as Mesh).isMesh) source = o as Mesh;
    });
    const mesh = source!.clone();
    const made = makeVampireMaterial(source!.material as MeshStandardMaterial);
    mesh.material = made.material;
    const tex = (made.material as MeshStandardMaterial).map;
    if (tex) tex.anisotropy = 4;
    return { mesh, material: made.material, uniforms: made.uniforms, lids: makeEyelids(mesh) };
  }, [gltf]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const target = statePose(state, clock.elapsedTime, seed, reduced ? NO_LOOK : cursorLook(slotEl), reduced);
    current.current = current.current ? approachPose(current.current, target, Math.min(dt, 0.1), BLEND_RATE) : target;
    let p = current.current;
    let ex: ExitFrame | null = null;
    const run = exitRun.current;
    if (run) {
      // An exit plays from the pose the vampire had when it began.
      run.idle ??= p;
      const elapsed = performance.now() - run.t0;
      ex = exitFrame(run.kind, elapsed, run.idle, run.order, seed);
      p = ex.pose;
      if (elapsed >= exitDurationMs(run.kind, run.order) && !exitRemoves(run.kind)) {
        // The Coffin transition ends in the Asleep pose, and the vampire carries on from there.
        current.current = ex.pose;
        exitRun.current = null;
      }
    }
    uniforms.uAlpha.value = ex ? ex.alpha : 1;
    uniforms.uDissolve.value = ex ? ex.dissolve : 0;
    uniforms.uEdge.value = ex ? ex.edge : 0;
    // Lying down: the whole body turns onto its back and moves into the coffin.
    const fit = coffinFit();
    const l = p.lying;
    const sc = 1 + (fit.scale - 1) * l;
    g.position.set(p.x + (fit.x - p.x) * l, p.y + (fit.y - p.y) * l, fit.z * l);
    g.rotation.set(p.rotX + fit.rotX * l, p.rotY, p.rotZ, 'YXZ');
    g.scale.set(p.scaleX * sc, p.scaleY * sc, p.scaleZ * sc);
    lids.setClosed(p.eyesClosed);
    uniforms.uBend.value = p.bend;
    uniforms.uGlow.value = p.glow;
    material.transparent = uniforms.uAlpha.value < 1;
    poseRef.current = { pose: p, uniforms, exit: ex };
  });

  return (
    <group ref={group}>
      <primitive object={mesh} />
      <primitive object={lids.group} />
    </group>
  );
}
