import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Group, type InstancedMesh, Matrix4, Mesh, ShaderMaterial, Vector3 } from 'three';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { type FrostAttached, type FrostPlan, blink, howlAmount } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { Icicles } from './Icicles';
import {
  NECK, buildCrow, buildEyePair, buildHangingLantern, buildOwlBody, buildOwlHead, buildWolfBody, buildWolfEyes, buildWolfHead,
} from './frostShapes';
import { disposeMesh, glowMaterial, litMaterial, makeInstanced, placeAt } from './frostParts';
const EYES_BLUE = '#8fe0ff';
const REST = -0.2;
const RAISED = 0.95;
/** The pivot of a wolf's head: the base of its neck, turned a little. */
const headMatrix = (base: Matrix4, angle: number) => base.clone().multiply(new Matrix4().makeTranslation(NECK.x, NECK.y, 0)).multiply(new Matrix4().makeRotationZ(angle));
/**
 * A pack of three wolf silhouettes on the far ridge, with glowing ice-blue eyes. Two stand watching; the third slowly raises its head to
 * howl at the moon, holds it, and lowers it again. Under reduced motion it keeps its head down.
 */
function Wolves({ wolves }: { wolves: FrostPlan['wolves'] }) {
  const display = useDisplay();
  const neck = useRef<Group>(null);
  const howler = wolves.find((w) => w.howl);
  const built = useMemo(() => {
    const dark = () => litMaterial('#16305a', 0.45);
    const bases = wolves.map((w) => placeAt(w.x, w.y, w.z, w.rotY, w.scale));
    const still = wolves.map((w, i) => ({ w, base: bases[i]! })).filter((e) => !e.w.howl);
    const eyeMat = glowMaterial(EYES_BLUE, 3.2);
    const meshes: InstancedMesh[] = [
      makeInstanced(buildWolfBody(), dark(), bases, 'frost-wolves', { castShadow: true }),
      makeInstanced(buildWolfHead(), dark(), still.map((e) => headMatrix(e.base, REST)), 'frost-wolf-heads'),
      makeInstanced(buildWolfEyes(), eyeMat, still.map((e) => headMatrix(e.base, REST)), 'frost-wolf-eyes'),
    ];
    const head = new Mesh(buildWolfHead(), dark());
    head.name = 'frost-wolf-howl-head';
    const eyes = new Mesh(buildWolfEyes(), glowMaterial(EYES_BLUE, 3.2));
    eyes.name = 'frost-wolf-howl-eyes';
    return { meshes, head, eyes };
  }, [wolves]);
  useEffect(
    () => () => {
      built.meshes.forEach(disposeMesh);
      disposeMesh(built.head);
      disposeMesh(built.eyes);
    },
    [built],
  );
  useFrame(() => {
    if (neck.current) neck.current.rotation.z = display.reduced ? REST : REST + (RAISED - REST) * howlAmount(display.time);
  });
  return (
    <>
      {built.meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
      {howler && (
        <group position={[howler.x, howler.y, howler.z]} rotation={[0, howler.rotY, 0]} scale={howler.scale}>
          <group ref={neck} position={[NECK.x, NECK.y, 0]} rotation={[0, 0, REST]}>
            <primitive object={built.head} />
            <primitive object={built.eyes} />
          </group>
        </group>
      )}
    </>
  );
}
/** Pairs of glowing eyes low between the pines. Each pair blinks now and then, at its own time. */
function EyePairs({ eyes }: { eyes: FrostAttached['eyes'] }) {
  const display = useDisplay();
  const mesh = useMemo(() => {
    const m = makeInstanced(buildEyePair(), glowMaterial('#9dffe0', 2.6), eyes.map((e) => placeAt(e.x, e.y, e.z, Math.atan2(0.5 - e.x, 16 - e.z))), 'frost-eyes');
    return m;
  }, [eyes]);
  useEffect(() => () => disposeMesh(mesh), [mesh]);
  const m = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    eyes.forEach((e, i) => {
      const open = display.reduced ? 1 : blink(display.time, e.phase);
      mesh.setMatrixAt(i, placeAt(e.x, e.y, e.z, Math.atan2(0.5 - e.x, 16 - e.z), [1, open, 1], undefined, m));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
/** A snowy owl on a tombstone. Its head slowly turns from side to side and back (it holds still under reduced motion). */
function SnowyOwl({ owl }: { owl: FrostPlan['owl'] }) {
  const display = useDisplay();
  const head = useRef<Group>(null);
  const built = useMemo(() => {
    const body = new Mesh(buildOwlBody(), litMaterial('#3a5a8c', 0.5));
    body.name = 'frost-owl';
    body.castShadow = true;
    const top = new Mesh(buildOwlHead(), litMaterial('#3a5a8c', 0.5));
    top.name = 'frost-owl-head';
    return { body, top };
  }, []);
  useEffect(() => () => {
    disposeMesh(built.body);
    disposeMesh(built.top);
  }, [built]);
  useFrame(() => {
    if (head.current) head.current.rotation.y = display.reduced ? 0 : 0.7 * Math.sin(display.time * 0.28) * Math.abs(Math.sin(display.time * 0.11));
  });
  return (
    <group position={[owl.x, owl.y, owl.z]} rotation={[0, owl.rotY, 0]} scale={1.3}>
      <primitive object={built.body} />
      <group ref={head} position={[0, 0.58, 0.02]}>
        <primitive object={built.top} />
      </group>
    </group>
  );
}
/** Empty iron lanterns hanging from the dead trees' branches (they sway a little) and crows sitting on other branches. */
function TreeThings({ attached }: { attached: FrostAttached }) {
  const display = useDisplay();
  const meshes = useMemo(
    () => ({
      lanterns: makeInstanced(buildHangingLantern(), litMaterial('#10203a', 0.5), attached.hanging.map((h) => placeAt(h.x, h.y, h.z, h.rotY, 1.3)), 'frost-hanging-lanterns', { castShadow: true }),
      crows: makeInstanced(buildCrow(), litMaterial('#14305a', 0.5), attached.crows.map((c) => placeAt(c.x, c.y, c.z, c.rotY, 1.5)), 'frost-crows', { castShadow: true }),
    }),
    [attached],
  );
  useEffect(() => () => Object.values(meshes).forEach(disposeMesh), [meshes]);
  const m = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    if (display.reduced) return;
    attached.hanging.forEach((h, i) => {
      meshes.lanterns.setMatrixAt(i, placeAt(h.x, h.y, h.z, h.rotY, 1.3, [0, 0.07 * Math.sin(display.time * 0.7 + i * 1.9)], m));
    });
    meshes.lanterns.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <primitive object={meshes.lanterns} />
      <primitive object={meshes.crows} />
      <Icicles icicles={attached.treeIcicles} name="tree-icicles" />
    </>
  );
}
const TRAIL = 16;
const GHOSTS = 3;
const trailVertex = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime; uniform float uPixel; uniform float uShown; uniform vec3 uSpots[${GHOSTS}];
varying float vAlpha;
// Where the shared ghost layer puts ghost number \`id\` at a time (see Ghosts.tsx): the spot, bobbing and drifting.
vec3 ghostAt(float id, float t) {
  vec3 s = uSpots[int(id)];
  return vec3(s.x + sin(t * 0.23 + id * 1.7) * 0.9, s.y + sin(t * 0.9 + id * 2.0) * 0.22, s.z + cos(t * 0.19 + id * 2.3) * 0.7);
}
void main() {
  float id = aSeed.x; float k = aSeed.y; float r = aSeed.z;
  float f = k / ${(TRAIL - 1).toFixed(1)};
  vec3 p = ghostAt(id, uTime - 0.35 * (k + 1.0));
  p.y += 0.5 - f * 0.45;
  p.x += (r - 0.5) * 0.5 * (0.3 + f);
  p.z += (fract(r * 7.3) - 0.5) * 0.4 * (0.3 + f);
  vAlpha = pow(1.0 - f, 1.4) * 0.5 * clamp(uShown - id, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPixel * (0.45 + (1.0 - f) * 0.7 + r * 0.3) * 15.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const trailFragment = /* glsl */ `
varying float vAlpha; uniform vec3 uColor;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - length(c), 0.0, 1.0);
  gl_FragColor = vec4(uColor, a * a * vAlpha);
}`;
/**
 * A faint trail of frost behind each ghost: tiny cold sparks that sit where the ghost was a moment ago and fade away. One Points object;
 * it follows the same drift as the ghosts (their motion is a function of time, so no state is kept). Still under reduced motion.
 */
function GhostTrail({ spots, tint }: { spots: readonly { x: number; y: number; z: number }[]; tint: string }) {
  const display = useDisplay();
  const built = useMemo(() => {
    const rng = mulberry32(4411);
    const seed = new Float32Array(GHOSTS * TRAIL * 3);
    for (let g = 0; g < GHOSTS; g++) for (let k = 0; k < TRAIL; k++) seed.set([g, k, rng()], (g * TRAIL + k) * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(GHOSTS * TRAIL * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 3));
    const mat = new ShaderMaterial({
      vertexShader: trailVertex, fragmentShader: trailFragment,
      uniforms: {
        uTime: { value: 0 }, uPixel: { value: 1 }, uShown: { value: 2 }, uColor: { value: new Color(tint).lerp(new Color('#ffffff'), 0.3) },
        // The ghost layer draws a ghost 0.6 below the spot and the body is 2 tall.
        uSpots: { value: Array.from({ length: GHOSTS }, (_, i) => new Vector3(spots[i]?.x ?? 0, (spots[i]?.y ?? 0) - 0.6, spots[i]?.z ?? 0)) },
      },
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    });
    return { geo, mat };
  }, [spots, tint]);
  useEffect(() => () => { built.geo.dispose(); built.mat.dispose(); }, [built]);
  useFrame(({ gl }) => {
    const u = built.mat.uniforms;
    u.uTime!.value = display.reduced ? 0 : display.time;
    u.uPixel!.value = gl.getPixelRatio();
    u.uShown!.value = Math.min(GHOSTS, Math.max(2, display.ghosts));
  });
  return <points geometry={built.geo} material={built.mat} frustumCulled={false} renderOrder={5} name="frost-ghost-trail" />;
}
/** The creatures of the Frozen Cemetery: wolves, eyes in the pines, the owl, crows and lanterns on the dead trees, the ghosts' frost trail. */
export function FrostCreatures({ plan, attached, ghostSpots, ghostTint }: { plan: FrostPlan; attached: FrostAttached; ghostSpots: readonly { x: number; y: number; z: number }[]; ghostTint: string }) {
  return (
    <>
      <Wolves wolves={plan.wolves} />
      <EyePairs eyes={attached.eyes} />
      <SnowyOwl owl={plan.owl} />
      <TreeThings attached={attached} />
      <GhostTrail spots={ghostSpots} tint={ghostTint} />
    </>
  );
}
