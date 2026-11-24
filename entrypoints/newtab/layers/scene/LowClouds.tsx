import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color, InstancedBufferAttribute, InstancedMesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { LOW_CLOUD_MOON_FADE_DEG, lowCloudPuffs } from '../../../../lib/scene/depth';
import { LOOK } from '../../../../lib/scene/config';
import { MOON_KEEP_OUT_DEG } from '../../../../lib/scene/sky';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync } from './themeColors';

const vertex = /* glsl */ `
attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
uniform float uTime;
varying vec2 vUv; varying vec3 vWorld; varying float vFade; varying float vShade;
float sm(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main() {
  vUv = uv; vShade = aC.z;
  // Same drift and wrap as lib/scene/depth.ts lowCloudX, and the same fade at both ends.
  float span = aC.y - aC.x;
  float raw = aA.x - aC.x + aA.y * uTime;
  float cx = aC.x + mod(mod(raw, span) + span, span);
  float f = clamp((cx - aC.x) / span, 0.0, 1.0);
  vFade = sm(f / 0.12) * (1.0 - sm((f - 0.88) / 0.12));
  vec3 center = vec3(cx + aB.x, aA.z + aB.y, aA.w);
  vec3 p = center + vec3(position.x * aB.z * 2.0, position.y * aB.w * 2.0, 0.0);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const fragment = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld; varying float vFade; varying float vShade;
uniform vec3 uMoon; uniform float uKeep; uniform float uKeepFade; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uBody;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  r *= 1.0 + 0.1 * sin(ang * 3.0 + vShade * 17.0) + 0.05 * sin(ang * 7.0 + vShade * 8.0);
  float a = smoothstep(1.0, 0.25, r) * 0.55 * vFade;
  // Never over the moon: the cloud fades to nothing near the moon's direction, as seen from the camera.
  vec3 dir = normalize(vWorld - cameraPosition);
  float angle = degrees(acos(clamp(dot(dir, normalize(uMoon)), -1.0, 1.0)));
  float t = clamp((angle - uKeep) / uKeepFade, 0.0, 1.0);
  a *= t * t * (3.0 - 2.0 * t);
  // Dark purple, a little lighter on top, then blended into the fog by distance like everything else.
  vec3 col = uBody * (0.85 + 0.3 * vShade) + vec3(0.03, 0.02, 0.06) * smoothstep(-0.2, 0.9, p.y);
  float dist = length(vWorld - cameraPosition);
  float fog = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
  col = mix(col, uFogColor, fog * 0.8);
  gl_FragColor = vec4(col, a);
}`;

/**
 * Soft dark clouds at three depths, drifting slowly. The nearer layers pass in front of the far hills and the
 * village. They fade out around the moon, so they never cover it. One draw call.
 */
export function LowClouds() {
  const display = useDisplay();
  const puffs = useMemo(() => lowCloudPuffs(), []);
  const mesh = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    const a = new Float32Array(puffs.length * 4);
    const b = new Float32Array(puffs.length * 4);
    const c = new Float32Array(puffs.length * 4);
    puffs.forEach((p, i) => {
      a.set([p.x0, p.speed, p.y, p.z], i * 4);
      b.set([p.offX, p.offY, p.rx, p.ry], i * 4);
      c.set([p.xMin, p.xMax, p.shade, p.layer], i * 4);
    });
    geo.setAttribute('aA', new InstancedBufferAttribute(a, 4));
    geo.setAttribute('aB', new InstancedBufferAttribute(b, 4));
    geo.setAttribute('aC', new InstancedBufferAttribute(c, 4));
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uMoon: { value: new Vector3() },
        uKeep: { value: MOON_KEEP_OUT_DEG },
        uKeepFade: { value: LOW_CLOUD_MOON_FADE_DEG },
        uFogColor: { value: sceneColorsFor('crypt').fog.clone() },
        uFogDensity: { value: LOOK.fogDensity },
        uBody: { value: sceneColorsFor('crypt').lowCloud.clone() },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const m = new InstancedMesh(geo, mat, puffs.length);
    m.frustumCulled = false;
    m.renderOrder = -55;
    return m;
  }, [puffs]);
  useColorSync((c) => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    (u.uFogColor!.value as Color).copy(c.fog);
    (u.uBody!.value as Color).copy(c.lowCloud);
  });
  useFrame(() => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime!.value = display.time;
    (u.uMoon!.value as Vector3).copy(display.moon);
    u.uFogDensity!.value = LOOK.fogDensity * display.fogFactor;
  });
  return <primitive object={mesh} />;
}
