import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CircleGeometry, Color, DoubleSide, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import { LAKE, LAKE_SEGMENTS, LAKE_Y } from '../../../../../lib/scene/uniqueScenes/frostIce';
import type { FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { icePulse } from './frostParts';
import { useColorSync } from '../themeColors';

const vertex = /* glsl */ `
varying vec2 vP; varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vP = position.xz;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
// One flat disc with its own shader: pale blue ice with a soft gradient, faint cracks (cell edges), a slow moving sheen and a
// streak of moonlight worked out from the view direction. No reflection pass, no blur: everything is arithmetic on the disc.
const fragment = /* glsl */ `
varying vec2 vP; varying vec3 vWorld;
uniform float uTime; uniform vec3 uMoonDir; uniform vec3 uMoonColor;
uniform vec3 uIceNear; uniform vec3 uIceFar; uniform vec3 uRim; uniform float uPulse; uniform vec3 uSpots[6]; uniform vec3 uGlow;
#include <fog_pars_fragment>
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// Distance between the two nearest cell points: small along the cell edges, which are the cracks.
float crack(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float d1 = 8.0; float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      float d = length(g + hash2(i + g) - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}
void main() {
  float r = length(vP);
  // Dark glassy ice: deep navy, a little lighter toward the far shore.
  vec3 col = mix(uIceNear, uIceFar, smoothstep(0.9, -0.9, vP.y));
  // White cracks at two sizes, bright, in most patches.
  vec2 w = vWorld.xz;
  float patch = smoothstep(0.25, 0.6, noise(w * 0.16 + 3.0));
  float c1 = 1.0 - smoothstep(0.0, 0.05, crack(w * 0.24));
  float c2 = 1.0 - smoothstep(0.0, 0.07, crack(w * 0.7 + 7.0));
  float cracks = (c1 * 0.95 + c2 * 0.5) * (0.4 + 0.6 * patch);
  col = mix(col, vec3(0.9, 0.97, 1.0), clamp(cracks, 0.0, 1.0));
  // The slow pulse of light under the ice: a pale blue glow round every bone, brightest in the cracks.
  float under = 0.0;
  for (int i = 0; i < 6; i++) {
    vec3 s = uSpots[i];
    float d = length(w - s.xy) / max(s.z, 0.001);
    under += s.z > 0.0 ? exp(-d * d * 1.6) : 0.0;
  }
  col += uGlow * under * (0.2 + 0.8 * uPulse) * (0.5 + 0.8 * cracks);
  // A soft sheen that slowly moves across the ice.
  float band = sin(dot(w, vec2(0.21, 0.11)) + uTime * 0.25) * 0.5 + 0.5;
  col += uMoonColor * smoothstep(0.7, 1.0, band) * 0.06 * (0.5 + 0.5 * noise(w * 0.5));
  // The moon's streak: the view ray bounced off the flat ice, compared with the moon's direction.
  vec3 v = normalize(vWorld - cameraPosition);
  vec3 rf = vec3(v.x, abs(v.y), v.z);
  vec3 m = normalize(uMoonDir);
  float da = atan(rf.x, -rf.z) - atan(m.x, -m.z);
  da = atan(sin(da), cos(da));
  float de = asin(clamp(rf.y, -1.0, 1.0)) - asin(clamp(m.y, -1.0, 1.0));
  float glints = 0.55 + 0.45 * noise(w * vec2(2.2, 0.7) + vec2(0.0, uTime * 0.3));
  float streak = exp(-da * da / (2.0 * 0.03 * 0.03)) * exp(-de * de / (2.0 * 0.16 * 0.16));
  float wide = exp(-da * da / (2.0 * 0.12 * 0.12)) * exp(-de * de / (2.0 * 0.22 * 0.22));
  col += uMoonColor * (streak * 0.7 * glints + wide * 0.1);
  // A frosted rim at the shore.
  col = mix(col, uRim, smoothstep(0.88, 1.0, r) * 0.6);
  gl_FragColor = vec4(col, 0.97 * (1.0 - smoothstep(0.96, 1.0, r)));
  #include <fog_fragment>
}`;

/**
 * The frozen lake, the centrepiece of the Frozen Cemetery: one flat ellipse (one mesh, one draw call), a little above the snow.
 * Its shader paints the ice, the cracks, the sheen and the moonlight streak. The sheen moves with `display.time`, which stays
 * at 0 under reduced motion, so the ice then stands still.
 */
export function FrozenLake({ plan }: { plan?: FrostPlan }) {
  const display = useDisplay();
  const geometry = useMemo(() => new CircleGeometry(1, LAKE_SEGMENTS).rotateX(-Math.PI / 2), []);
  const spots = useMemo(() => {
    const list = plan ? [[plan.hand.x, plan.hand.z, 2.4]] : [];
    return Array.from({ length: 6 }, (_, i) => new Vector3(list[i]?.[0] ?? 0, list[i]?.[1] ?? 0, list[i]?.[2] ?? 0));
  }, [plan]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uTime: { value: 0 },
            uMoonDir: { value: new Vector3(0.5, 0.2, -0.8) },
            uMoonColor: { value: new Color('#e8f4ff') },
            uIceNear: { value: new Color('#071a33') },
            uIceFar: { value: new Color('#12345c') },
            uRim: { value: new Color('#9ec8ee') },
            uPulse: { value: 0.6 },
            uGlow: { value: new Color('#2f8cff').multiplyScalar(2.4) },
            uSpots: { value: [] as Vector3[] },
          },
        ]),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  material.uniforms.uSpots!.value = spots;
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  // The moon's colour follows the theme.
  useColorSync((c) => {
    (material.uniforms.uMoonColor!.value as Color).copy(c.moon).multiplyScalar(0.9);
  });
  useFrame(() => {
    // Under reduced motion the ice stands still.
    material.uniforms.uTime!.value = display.reduced ? 0 : display.time;
    (material.uniforms.uMoonDir!.value as Vector3).copy(display.moon);
    // The pulse of light under the ice stands still under reduced motion.
    material.uniforms.uPulse!.value = icePulse(display.time, display.reduced);
  });
  return <mesh geometry={geometry} material={material} position={[LAKE.x, LAKE_Y, LAKE.z]} scale={[LAKE.rx, 1, LAKE.rz]} renderOrder={1} name="frozen-lake" />;
}
