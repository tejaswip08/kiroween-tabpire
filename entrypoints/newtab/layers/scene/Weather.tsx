import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, ShaderMaterial, Vector3 } from 'three';
import { MAX_ANCHORS, REDUCED_TIME, emberAnchors, weatherDrawCount, weatherSeeds, type WeatherSpec } from '../../../../lib/scene/weather';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';
// Seed: x, z (spread over the graveyard), y: phase, w: size. All motion is a function of the seed and uTime.
const vertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uPixel;
uniform vec3 uAnchors[${MAX_ANCHORS}]; uniform float uAnchorCount;
varying float vAlpha; varying float vMix; varying float vAngle;
void main() {
  float x = aSeed.x * 56.0 - 28.0;
  float z = aSeed.y * 54.0 - 40.0;
  float ph = aSeed.z;
  float size = 0.6 + aSeed.w * 0.8;
  vec3 p; float alpha = 1.0; float base = 1.0; float angle = 0.0;
  #if defined(KIND_SNOW)
    float t = fract(ph + uTime * (0.025 + aSeed.w * 0.02));
    p = vec3(x + sin(uTime * 0.5 + ph * 40.0) * 0.8, 18.0 * (1.0 - t), z + cos(uTime * 0.4 + ph * 30.0) * 0.6);
    base = 9.0; alpha = 0.9;
  #elif defined(KIND_ASH)
    float t = fract(ph + uTime * (0.012 + aSeed.w * 0.01));
    p = vec3(x + uTime * 0.25 * (aSeed.w - 0.3) + sin(uTime * 0.3 + ph * 50.0) * 1.4, 16.0 * (1.0 - t), z + cos(uTime * 0.25 + ph * 20.0) * 1.2);
    base = 8.0; alpha = 0.75;
  #elif defined(KIND_FIREFLIES)
    p = vec3(x + sin(uTime * 0.22 + ph * 60.0) * 2.5, 0.6 + (0.5 + 0.5 * sin(uTime * 0.17 + ph * 40.0)) * 2.4, z + cos(uTime * 0.19 + ph * 50.0) * 2.5);
    alpha = pow(max(sin(uTime * (0.9 + aSeed.w * 1.2) + ph * 100.0), 0.0), 3.0);
    base = 14.0;
  #elif defined(KIND_LEAVES)
    float t = fract(ph + uTime * (0.02 + aSeed.w * 0.012));
    p = vec3(x + sin(uTime * 0.6 + ph * 40.0) * 3.0 + t * 4.0, 14.0 * (1.0 - t), z + cos(uTime * 0.5 + ph * 30.0) * 2.0);
    angle = ph * 6.2832 + uTime * (0.8 + aSeed.w);
    base = 18.0; alpha = 1.0;
  #else
    float k = floor(aSeed.x * uAnchorCount * 0.9999);
    vec3 a = uAnchors[int(k)];
    float life = fract(ph + uTime * (0.08 + aSeed.w * 0.08));
    p = a + vec3(sin(uTime * 0.7 + ph * 40.0) * 0.5 * life, 0.2 + life * 5.0, cos(uTime * 0.6 + ph * 30.0) * 0.5 * life);
    alpha = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.5, 1.0, life));
    base = 12.0;
  #endif
  vAlpha = alpha; vMix = step(0.5, fract(aSeed.w * 13.7 + ph * 7.0)); vAngle = angle;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPixel * size * base / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const fragment = /* glsl */ `
varying float vAlpha; varying float vMix; varying float vAngle;
uniform vec3 uColorA; uniform vec3 uColorB;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float a;
  #if defined(KIND_LEAVES)
    float s = sin(vAngle); float k = cos(vAngle);
    vec2 q = vec2(k * c.x - s * c.y, s * c.x + k * c.y);
    // Pointed oval: wide in the middle, a point at each end.
    float w = 0.55 * cos(clamp(q.y, -1.0, 1.0) * 1.5708);
    a = (1.0 - smoothstep(w - 0.08, w, abs(q.x))) * step(abs(q.y), 1.0);
  #else
    a = clamp(1.0 - length(c), 0.0, 1.0);
    a = min(1.0, a * 2.0);
  #endif
  a *= vAlpha;
  gl_FragColor = vec4(mix(uColorA, uColorB, vMix), a);
}`;
/** One kind of weather in one draw call. All motion is in the shader; JavaScript only sets uniforms. */
export function Weather({ spec }: { spec: WeatherSpec }) {
  const display = useDisplay();
  const { scene } = useSceneTheme();
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(spec.count * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(weatherSeeds(spec.kind, spec.count), 4));
    g.setDrawRange(0, weatherDrawCount(spec, display.reduced));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);
  const anchors = useMemo(() => emberAnchors(scene.anchors), [scene.anchors]);
  const uniforms = useMemo(() => {
    const c = sceneColorsFor('crypt');
    return {
      uTime: { value: 0 },
      uPixel: { value: 1 },
      uColorA: { value: c.weatherA.clone() },
      uColorB: { value: c.weatherB.clone() },
      uAnchors: { value: Array.from({ length: MAX_ANCHORS }, () => new Vector3()) },
      uAnchorCount: { value: 1 },
    };
  }, []);
  useColorSync((c) => {
    uniforms.uColorA.value.copy(c.weatherA);
    uniforms.uColorB.value.copy(c.weatherB);
  });
  useMemo(() => {
    anchors.forEach((a, i) => uniforms.uAnchors.value[i]!.set(a.x, a.y, a.z));
    uniforms.uAnchorCount.value = anchors.length;
  }, [anchors, uniforms]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        defines: { [`KIND_${spec.kind.toUpperCase()}`]: '' },
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: spec.blending === 'additive' ? AdditiveBlending : NormalBlending,
        fog: false,
      }),
    [spec, uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ gl }) => {
    uniforms.uTime.value = display.reduced ? REDUCED_TIME : display.time;
    uniforms.uPixel.value = gl.getPixelRatio();
    const n = weatherDrawCount(spec, display.reduced);
    if (geometry.drawRange.count !== n) geometry.setDrawRange(0, n);
  });
  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={6}>
      <primitive object={material} attach="material" dispose={null} />
    </points>
  );
}
/** Weather of the shown theme, or nothing for the Crypt. */
export function SceneWeather() {
  const { scene } = useSceneTheme();
  return scene.weather ? <Weather key={scene.weather.kind} spec={scene.weather} /> : null;
}
