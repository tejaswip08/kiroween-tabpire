import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { gustAt, windTravel } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { frostWind } from './frostWind';
const mistVertex = /* glsl */ `
varying vec3 vWorld; varying vec2 vLocal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz; vLocal = position.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// Soft noise that rolls along with the wind (uTravel is how far the wind has carried it).
const mistFragment = /* glsl */ `
varying vec3 vWorld; varying vec2 vLocal;
uniform float uTravel; uniform float uAlpha; uniform float uScale; uniform vec3 uColor; uniform vec2 uHalf;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vWorld.xz * uScale - vec2(uTravel * uScale, uTravel * uScale * 0.15);
  float n = noise(p) * 0.55 + noise(p * 2.2 + 5.0) * 0.3 + noise(p * 4.7 + 1.0) * 0.15;
  float d = smoothstep(0.42, 0.85, n);
  float edge = 1.0 - smoothstep(0.5, 1.0, length(vLocal / uHalf));
  gl_FragColor = vec4(uColor, d * edge * uAlpha);
}`;
/** The two mist sheets: height above the snow, how fast the wind carries them, how thick and how coarse they are. */
const SHEETS = [
  { y: 0.14, speed: 1.6, alpha: 0.32, scale: 0.11, z: -14, w: 80, d: 52 },
  { y: 0.42, speed: 2.4, alpha: 0.2, scale: 0.075, z: -14, w: 80, d: 52 },
  // A far band between the house and the horizon: it fades the far cottages and the steeple for depth.
  { y: 1.1, speed: 1.2, alpha: 0.22, scale: 0.05, z: -44, w: 130, d: 26 },
] as const;
/**
 * The cold wind (gale) of the Frozen Cemetery. Writes the shared wind clock once a frame (the trees, the flag, the lanterns read it; under reduced
 * motion its amplitude is 0, so they stand still) and draws the thin ground mist: two low sheets and a far band of soft noise rolling across the snow
 * with the wind (three draw calls, no textures). Under reduced motion the mist holds still.
 */
export function FrostGale() {
  const display = useDisplay();
  const sheets = useMemo(
    () =>
      SHEETS.map((s, i) => {
        const m = new Mesh(
          new PlaneGeometry(s.w, s.d).rotateX(-Math.PI / 2),
          new ShaderMaterial({
            vertexShader: mistVertex,
            fragmentShader: mistFragment,
            uniforms: { uTravel: { value: 0 }, uAlpha: { value: s.alpha }, uScale: { value: s.scale }, uColor: { value: new Color('#a8c2e8') }, uHalf: { value: [s.w / 2, s.d / 2] } },
            transparent: true, depthWrite: false, side: DoubleSide, fog: false,
          }),
        );
        m.position.set(0, s.y, s.z);
        m.renderOrder = 2 + i;
        m.frustumCulled = false;
        m.name = `frost-mist-${i}`;
        return m;
      }),
    [],
  );
  useEffect(
    () => () => {
      for (const m of sheets) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
      }
    },
    [sheets],
  );
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    frostWind.time.value = t;
    frostWind.gust.value = display.reduced ? 0.5 : gustAt(t);
    frostWind.amp.value = display.reduced ? 0 : 1;
    const travel = windTravel(t);
    SHEETS.forEach((s, i) => ((sheets[i]!.material as ShaderMaterial).uniforms.uTravel!.value = travel * s.speed));
  });
  return (
    <>
      {sheets.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </>
  );
}
