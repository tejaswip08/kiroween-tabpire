import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, type Mesh, type ShaderMaterial, Vector3 } from 'three';
import { FLASH_BOOST } from '../../../../lib/scene/lightning';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uHaze; uniform vec3 uMoonGlow;
uniform vec3 uMoonDir; uniform float uTime; uniform float uHalo;
uniform vec3 uLeft; uniform vec3 uRight; uniform float uTwoTone;
uniform float uFlash; uniform vec3 uFlashColor;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  // Deep indigo at the top, warm violet-crimson near the horizon.
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
  col = mix(col, uTop, smoothstep(0.12, 0.7, h));
  col = mix(col, uHorizon * 0.3, smoothstep(0.0, -0.25, d.y));
  // Third fog layer: a band of haze at the horizon, strongest around the moon.
  vec2 az = normalize(d.xz + 1e-4);
  vec2 maz = normalize(uMoonDir.xz + 1e-4);
  float aligned = max(dot(az, maz), 0.0);
  col += uHaze * exp(-abs(d.y) * 8.0) * (0.3 + 0.7 * pow(aligned, 3.0));
  // Scatter of the moon. A two-tone sky has no moon: only the broad glow stays, never the bright spot.
  float md = max(dot(d, uMoonDir), 0.0);
  col += uMoonGlow * (pow(md, 400.0) * 0.35 * (1.0 - uTwoTone) * mix(0.15, 1.0, uHalo) + pow(md, 14.0) * 0.07 * uHalo);
  // Two-tone sky: a hot glow high on the left and a green mist low on the right. Zero for the other themes.
  float wl = smoothstep(0.45, -0.55, d.x);
  float wr = smoothstep(-0.45, 0.55, d.x);
  col += uLeft * wl * (0.3 + 0.7 * smoothstep(0.0, 0.5, h));
  col += uRight * wr * exp(-h * 5.0);
  // A few faint stars, kept away from the moon.
  vec3 cell = floor(d * 240.0);
  float r = hash(cell);
  float star = step(0.9975, r) * smoothstep(0.12, 0.4, h) * (1.0 - smoothstep(0.96, 0.995, md)) * (1.0 - uTwoTone);
  col += vec3(0.7, 0.78, 1.0) * star * (0.45 + 0.25 * sin(uTime * 1.5 + r * 80.0));
  // Lightning: a brightness change only, a little stronger toward the horizon. Zero for every theme but the castle.
  col += uFlashColor * uFlash * (0.55 + 0.45 * exp(-h * 3.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const ZERO = new Color(0, 0, 0);
const HAZE_LEVEL = 0.45;
/** How strong the two sides of a two-tone sky are. */
const SIDE_LEVEL = 0.5;
const MOON_GLOW_LEVEL = 0.8;
/** The sky: a dome that follows the camera's position, so the moon and stars sit at infinity. */
export function Sky() {
  const display = useDisplay();
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => {
    const c = sceneColorsFor('crypt');
    return {
      uTop: { value: c.skyTop.clone() },
      uMid: { value: c.skyMid.clone() },
      uHorizon: { value: c.skyHorizon.clone() },
      uHaze: { value: c.haze.clone().multiplyScalar(HAZE_LEVEL) },
      uMoonGlow: { value: c.moon.clone().multiplyScalar(MOON_GLOW_LEVEL) },
      uMoonDir: { value: new Vector3() },
      uTime: { value: 0 },
      uLeft: { value: new Color(0, 0, 0) },
      uRight: { value: new Color(0, 0, 0) },
      uTwoTone: { value: 0 },
      uHalo: { value: 1 },
      uFlash: { value: 0 },
      uFlashColor: { value: new Color(...FLASH_BOOST.sky) },
    };
  }, []);
  useColorSync((c) => {
    uniforms.uTop.value.copy(c.skyTop);
    uniforms.uMid.value.copy(c.skyMid);
    uniforms.uHorizon.value.copy(c.skyHorizon);
    uniforms.uHaze.value.copy(c.haze).multiplyScalar(HAZE_LEVEL);
    uniforms.uMoonGlow.value.copy(c.moon).multiplyScalar(MOON_GLOW_LEVEL);
    uniforms.uLeft.value.copy(c.skyLeft ?? ZERO).multiplyScalar(SIDE_LEVEL);
    uniforms.uRight.value.copy(c.skyRight ?? ZERO).multiplyScalar(SIDE_LEVEL);
    uniforms.uTwoTone.value = c.skyLeft && c.skyRight ? 1 : 0;
  });
  // A crisp moon (the Pumpkin Patch) has no wide halo in the sky around it.
  const halo = useSceneTheme().scene.unique?.moon.crisp ? 0 : 1;
  useFrame(({ camera }) => {
    uniforms.uHalo.value = halo;
    mesh.current?.position.copy(camera.position);
    uniforms.uMoonDir.value.copy(display.moon);
    uniforms.uTime.value = display.time;
    // Scalar uniforms are read from the material itself: r3f copies the `{ value }` wrappers of the `uniforms` prop (vectors and colours stay shared).
    const material = mesh.current?.material as ShaderMaterial | undefined;
    if (material) material.uniforms.uFlash!.value = display.flash ?? 0;
  });
  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[500, 32, 16]} />
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        side={BackSide}
        depthWrite={false}
        depthTest={false}
        fog={false}
      />
    </mesh>
  );
}
