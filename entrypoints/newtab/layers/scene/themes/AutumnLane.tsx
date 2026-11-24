import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, Color, DoubleSide, Euler, type Group, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { kidsAt, pointAlong, type AutumnPlan, type FallenLeaf, type LeafTone, type Route } from '../../../../../lib/scene/uniqueScenes/autumn';
import { useDisplay } from '../display';
import {
  buildBanks, buildDryStalk, buildFence, buildFieldStalk, buildFlatLeaf, buildTreeLeaves, buildTreeWood, buildTuft, buildWitchKid,
} from './autumnBuild';

const m4 = new Matrix4();
const quat = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const eul = new Euler();

/** The autumn tree: a twisted trunk with a knot hole, four limbs and a round crown of leaves, and canopy leaves that sway a little. Two meshes (wood, leaves). */
export function AutumnTree({ plan }: { plan: AutumnPlan['tree'] }) {
  const display = useDisplay();
  const wood = useMemo(() => buildTreeWood(plan), [plan]);
  const leaves = useMemo(() => buildTreeLeaves(plan.clusters), [plan]);
  const uTime = useMemo(() => ({ value: 0 }), []);
  const leafMaterial = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, emissive: new Color('#ff5a1a'), emissiveIntensity: 0.16 });
    // The sway is in the vertex shader, driven by one time uniform, so the leaves cost no work on the CPU.
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.x += sin(uTime * 0.9 + position.y * 0.7 + position.z * 0.5) * 0.045;
          transformed.y += sin(uTime * 1.3 + position.x * 0.6) * 0.02;
          transformed.z += cos(uTime * 0.8 + position.y * 0.6 + position.x * 0.4) * 0.04;`,
        );
    };
    m.customProgramCacheKey = () => 'autumn-leaves-sway';
    return m;
  }, [uTime]);
  useEffect(() => () => leafMaterial.dispose(), [leafMaterial]);
  useEffect(() => () => wood.dispose(), [wood]);
  useEffect(() => () => leaves.dispose(), [leaves]);
  useFrame(() => {
    uTime.value = display.time;
  });
  return (
    <>
      <mesh geometry={wood} name="autumn-tree" frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={leaves} material={leafMaterial} name="autumn-leaves" frustumCulled={false} />
    </>
  );
}

/**
 * A little witch seen from behind, with a pumpkin bucket, walking slowly away down the trail toward the barn. She bobs as she
 * walks, shrinks away at the barn and comes back at the start. With reduced motion she stands still.
 */
export function TrickOrTreater({ route }: { route: Route }) {
  const display = useDisplay();
  const witch = useMemo(buildWitchKid, []);
  useEffect(() => () => witch.dispose(), [witch]);
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const { s, scale } = kidsAt(route, display.time, display.reduced);
    const p = pointAlong(route, s);
    const phase = display.time * 3.4;
    const bob = display.reduced ? 0 : Math.abs(Math.sin(phase)) * 0.05;
    g.visible = scale > 0.01;
    g.position.set(p.x, bob, p.z);
    g.rotation.set(0, Math.atan2(-p.dx, -p.dz), display.reduced ? 0 : Math.sin(phase) * 0.05);
    g.scale.setScalar(Math.max(scale, 0.001));
  });
  return (
    <group ref={ref}>
      <mesh geometry={witch} name="kid-witch" frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** Corn stalks, leaning a little: one instanced mesh. `kind` picks the tall dry stalks of the lane or the green field corn. */
export function Stalks({ stalks, kind }: { stalks: AutumnPlan['stalks']; kind: 'dry' | 'field' }) {
  const { mesh, geometry, material } = useMemo(() => {
    const geometry = kind === 'dry' ? buildDryStalk() : buildFieldStalk();
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: DoubleSide });
    const mesh = new InstancedMesh(geometry, material, Math.max(1, stalks.length));
    mesh.count = stalks.length;
    mesh.name = kind === 'dry' ? 'dry-corn' : 'field-corn';
    mesh.frustumCulled = false;
    stalks.forEach((s, i) => {
      quat.setFromEuler(eul.set(s.leanX, s.rotY, s.leanZ));
      m4.compose(pos.set(s.x, s.y, s.z), quat, scl.setScalar(s.scale));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, geometry, material };
  }, [stalks, kind]);
  useEffect(() => () => {
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  }, [mesh, geometry, material]);
  return <primitive object={mesh} />;
}

/** The rustic fence along both sides of the trail: leaning posts and uneven rails, one mesh. */
export function RusticFence({ fence }: { fence: AutumnPlan['fence'] }) {
  const geometry = useMemo(() => buildFence(fence), [fence]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} name="rustic-fence" frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} flatShading />
    </mesh>
  );
}

const TUFT_GREEN = new Color('#bfe070');
const TUFT_YELLOW = new Color('#fff0a0');
/** Soft grass banks on both sides of the trail, with grass tufts on them. Two meshes. */
export function GrassBanks({ plan }: { plan: AutumnPlan }) {
  const banks = useMemo(() => buildBanks(plan.line), [plan.line]);
  const tuft = useMemo(() => {
    const geometry = buildTuft();
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: DoubleSide });
    const mesh = new InstancedMesh(geometry, material, plan.tufts.length);
    mesh.name = 'grass-tufts';
    mesh.frustumCulled = false;
    const c = new Color();
    plan.tufts.forEach((t, i) => {
      quat.setFromEuler(eul.set(0, t.rotY, 0));
      m4.compose(pos.set(t.x, t.y, t.z), quat, scl.set(t.scale, t.scale * (0.8 + 0.5 * t.hue), t.scale));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.copy(TUFT_GREEN).lerp(TUFT_YELLOW, t.hue));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return { mesh, geometry, material };
  }, [plan.tufts]);
  useEffect(() => () => banks.dispose(), [banks]);
  useEffect(() => () => {
    tuft.mesh.dispose();
    tuft.geometry.dispose();
    tuft.material.dispose();
  }, [tuft]);
  return (
    <>
      <mesh geometry={banks} name="grass-banks" receiveShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <primitive object={tuft.mesh} />
    </>
  );
}

const LEAF_TONES: Record<LeafTone | 'brown', string> = { red: '#e0401f', orange: '#f58a2c', gold: '#f8c040', deep: '#b02a1c', brown: '#7a4a24' };
/** Red, orange and gold leaves lying on the trail and the grass: one instanced mesh. */
export function FallenLeaves({ leaves }: { leaves: readonly FallenLeaf[] }) {
  const { mesh, geometry, material } = useMemo(() => {
    const geometry = buildFlatLeaf();
    const material = new MeshStandardMaterial({ roughness: 1, metalness: 0, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mesh = new InstancedMesh(geometry, material, leaves.length);
    mesh.name = 'fallen-leaves';
    mesh.frustumCulled = false;
    const c = new Color();
    leaves.forEach((l, i) => {
      quat.setFromEuler(eul.set(0, l.rotY, 0));
      m4.compose(pos.set(l.x, l.y, l.z), quat, scl.setScalar(l.scale * 1.5));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.set(LEAF_TONES[l.tone]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return { mesh, geometry, material };
  }, [leaves]);
  useEffect(() => () => {
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  }, [mesh, geometry, material]);
  return <primitive object={mesh} />;
}

const patchVertex = /* glsl */ `
varying vec2 vUv; varying float vPhase;
void main() {
  vUv = uv;
  vPhase = instanceMatrix[3].x * 2.3 + instanceMatrix[3].z * 1.7;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const patchFragment = /* glsl */ `
varying vec2 vUv; varying float vPhase; uniform float uTime; uniform vec3 uColor;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.7) * (0.8 + 0.2 * sin(uTime * 0.6 + vPhase));
  gl_FragColor = vec4(uColor * a, a);
}`;
/** Warm patches of light on the dirt trail, from the lanterns and the last of the dusk. One instanced mesh. */
export function LightPatches({ patches }: { patches: AutumnPlan['patches'] }) {
  const display = useDisplay();
  const { mesh, geometry, material } = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({
      vertexShader: patchVertex,
      fragmentShader: patchFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color(1.0, 0.62, 0.22).multiplyScalar(0.42) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const mesh = new InstancedMesh(geometry, material, patches.length);
    mesh.name = 'light-patches';
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    patches.forEach((p, i) => {
      quat.setFromEuler(eul.set(0, p.rotY, 0));
      m4.compose(pos.set(p.x, 0.09, p.z), quat, scl.set(p.rx * 2, 1, p.rz * 2));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, geometry, material };
  }, [patches]);
  useEffect(() => () => {
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  }, [mesh, geometry, material]);
  useFrame(() => {
    material.uniforms.uTime!.value = display.time;
  });
  return <primitive object={mesh} />;
}

/** Everything the autumn lane adds to the Pumpkin Patch. */
export function AutumnLane({ plan }: { plan: AutumnPlan }) {
  return (
    <>
      <GrassBanks plan={plan} />
      <LightPatches patches={plan.patches} />
      <FallenLeaves leaves={plan.leaves} />
      <Stalks stalks={plan.stalks} kind="dry" />
      <Stalks stalks={plan.fieldCorn} kind="field" />
      <RusticFence fence={plan.fence} />
      <AutumnTree plan={plan.tree} />
      {plan.extraTrees?.map((t, i) => (
        <AutumnTree key={i} plan={t} />
      ))}
      <TrickOrTreater route={plan.route} />
    </>
  );
}
