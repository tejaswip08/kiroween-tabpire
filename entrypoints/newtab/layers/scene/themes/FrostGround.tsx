import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CircleGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, Color, AdditiveBlending, NormalBlending,
} from 'three';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { LAKE_Y } from '../../../../../lib/scene/uniqueScenes/frostIce';
import { type FrostAttached, type FrostPlan, gustAt } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { buildSmoothMound } from './frostShapes';
import { disposeMesh, makeInstanced, placeAt } from './frostParts';
/** Footprints in the snow, leading along the path toward the chapel: flat dark ovals, one instanced mesh. */
function Footprints({ prints }: { prints: FrostPlan['prints'] }) {
  const mesh = useMemo(
    () =>
      makeInstanced(
        new CircleGeometry(0.17, 7).rotateX(-Math.PI / 2),
        new MeshStandardMaterial({ color: '#3d5f8e', roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
        prints.map((p) => placeAt(p.x, 0.045, p.z, p.rotY, [1, 1, 1.75])),
        'frost-footprints',
        { receiveShadow: true },
      ),
    [prints],
  );
  useEffect(() => () => disposeMesh(mesh), [mesh]);
  return <primitive object={mesh} />;
}
/** A cap of snow on each ice boulder: a flat smooth ball on top, one instanced mesh. */
function RockCaps({ caps }: { caps: FrostAttached['rockCaps'] }) {
  const mesh = useMemo(
    () =>
      makeInstanced(
        buildSmoothMound(),
        new MeshStandardMaterial({ color: '#f1f7ff', emissive: '#2d4d78', emissiveIntensity: 0.3, roughness: 1 }),
        caps.map((c) => placeAt(c.x, c.y, c.z, 0, [c.radius, c.radius * 0.42, c.radius])),
        'frost-rock-caps',
        { castShadow: true, receiveShadow: true },
      ),
    [caps],
  );
  useEffect(() => () => disposeMesh(mesh), [mesh]);
  return <primitive object={mesh} />;
}
const STREAKS = 150;
const streakVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTravel; uniform float uGust; uniform float uStill;
varying vec2 vUv; varying float vAlpha;
void main() {
  vUv = uv;
  float len = (1.4 + 3.2 * aSeed.w) * (1.0 + 1.4 * uGust);
  // They blow along +x and wrap round a 70 unit span in front of the camera.
  float x = mod(aSeed.x * 70.0 + uTravel * (0.6 + aSeed.w), 70.0) - 35.0;
  vec3 c = vec3(x, 0.12 + aSeed.z * 1.3, -36.0 + aSeed.y * 40.0);
  vec4 mv = modelViewMatrix * vec4(c + vec3(position.x * len, position.y * 0.05, 0.0), 1.0);
  // A few streaks show in the calm; a gust shows them all.
  float shown = mix(step(aSeed.w, 0.28), 1.0, uGust);
  vAlpha = shown * (0.1 + 0.5 * uGust);
  gl_Position = projectionMatrix * mv;
}`;
const streakFragment = /* glsl */ `
varying vec2 vUv; varying float vAlpha; uniform vec3 uColor;
void main() {
  float along = sin(vUv.x * 3.14159);
  float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
  gl_FragColor = vec4(uColor, vAlpha * along * across);
}`;
/**
 * Wind-blown snow across the ground: thin streaks that blow along the snow. Now and then (every 22 seconds) a gust sweeps through: the
 * streaks multiply, stretch and race along. One instanced mesh. Under reduced motion there are no gusts and nothing moves.
 */
function WindSnow() {
  const display = useDisplay();
  const travel = useRef(0);
  const built = useMemo(() => {
    const rng = mulberry32(8123);
    const geometry = new PlaneGeometry(1, 1);
    const seed = new Float32Array(STREAKS * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = rng();
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4));
    const material = new ShaderMaterial({
      vertexShader: streakVertex, fragmentShader: streakFragment,
      uniforms: { uTravel: { value: 0 }, uGust: { value: 0 }, uStill: { value: 0 }, uColor: { value: new Color('#e6f2ff') } },
      transparent: true, depthWrite: false, blending: NormalBlending, fog: false,
    });
    const mesh = new InstancedMesh(geometry, material, STREAKS);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.name = 'frost-wind-snow';
    return mesh;
  }, []);
  useEffect(() => () => disposeMesh(built), [built]);
  useFrame((_, dt) => {
    const u = (built.material as ShaderMaterial).uniforms;
    const gust = display.reduced ? 0 : gustAt(display.time);
    if (!display.reduced) travel.current += Math.min(dt, 0.1) * (0.5 + 12 * gust);
    u.uTravel!.value = travel.current;
    u.uGust!.value = gust;
  });
  return <primitive object={built} />;
}
const PUFFS = 4;
const breathVertex = /* glsl */ `
attribute float aPhase;
uniform float uTime; uniform float uPixel;
varying float vAlpha; varying vec2 vUv;
void main() {
  vUv = uv;
  float life = fract(aPhase + uTime * 0.06);
  vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  centre.y += life * 1.9;
  centre.x += life * 0.7;
  float size = 0.7 + life * 1.9;
  vAlpha = sin(life * 3.14159) * 0.26;
  gl_Position = projectionMatrix * (centre + vec4(position.xy * size, 0.0, 0.0));
}`;
const breathFragment = /* glsl */ `
varying float vAlpha; varying vec2 vUv; uniform vec3 uColor;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
  gl_FragColor = vec4(uColor, a * vAlpha);
}`;
/**
 * Soft breath-like mist that rises from the lake, from the hole the hand broke through and from over the bones, and fades as it climbs:
 * the cold breath of the thing under the ice. Billboards, one instanced mesh. Still under reduced motion.
 */
function LakeBreath({ plan }: { plan: FrostPlan }) {
  const display = useDisplay();
  const built = useMemo(() => {
    const rng = mulberry32(6601);
    const sources = [plan.broken, plan.skull, ...plan.hands.slice(0, 2)];
    const geometry = new PlaneGeometry(1, 1);
    const phase = new Float32Array(sources.length * PUFFS);
    const mats: Matrix4[] = [];
    sources.forEach((s) => {
      for (let k = 0; k < PUFFS; k++) {
        phase[mats.length] = k / PUFFS + rng() * 0.15;
        mats.push(new Matrix4().makeTranslation(s.x + (rng() - 0.5) * 0.7, LAKE_Y + 0.05, s.z + (rng() - 0.5) * 0.5));
      }
    });
    geometry.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
    const material = new ShaderMaterial({
      vertexShader: breathVertex, fragmentShader: breathFragment,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: new Color('#bcd9f5') } },
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    });
    const mesh = new InstancedMesh(geometry, material, mats.length);
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    mesh.name = 'frost-lake-breath';
    return mesh;
  }, [plan]);
  useEffect(() => () => disposeMesh(built), [built]);
  useFrame(() => {
    (built.material as ShaderMaterial).uniforms.uTime!.value = display.reduced ? 5 : display.time;
  });
  return <primitive object={built} />;
}
/** The ground of the Frozen Cemetery apart from the drifts: footprints, snow on the rocks, wind-blown snow, the breath of the lake. */
export function FrostGround({ plan, attached }: { plan: FrostPlan; attached: FrostAttached }) {
  return (
    <>
      <Footprints prints={plan.prints} />
      <RockCaps caps={attached.rockCaps} />
      <WindSnow />
      <LakeBreath plan={plan} />
    </>
  );
}
