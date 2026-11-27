import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, LinearSRGBColorSpace, ShaderMaterial } from 'three';
import { fovForAspect } from '../../../../../lib/scene/camera';
import { DUSK_CLOUDS, DUSK_DISTANCE, DUSK_LAYERS, duskMoonRim, duskPuffCount, duskPuffsOnScreen, duskWorld } from '../../../../../lib/scene/uniqueScenes/pumpkinFar';
import { useDisplay } from '../display';

const vertex = /* glsl */ `
attribute vec3 aCenter; attribute vec2 aCorner; attribute vec2 aSize; attribute vec4 aLook; attribute float aRim;
varying vec2 vCorner; varying vec4 vLook; varying float vRim;
void main() {
  vCorner = aCorner; vLook = aLook; vRim = aRim;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = aCenter + camRight * aCorner.x * aSize.x + camUp * aCorner.y * aSize.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
// vLook: x = tone in the bank (0 underside, 1 top), y = layer opacity, z = haze, w = seed.
const fragment = /* glsl */ `
varying vec2 vCorner; varying vec4 vLook; varying float vRim;
uniform vec3 uPeach; uniform vec3 uAmber; uniform vec3 uRose; uniform vec3 uPlum; uniform vec3 uHaze; uniform vec3 uPale;
float hash2(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 q) {
  vec2 i = floor(q); vec2 f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 p = vCorner;
  float d = length(p);
  // Ragged, uneven edges: two octaves of value noise, stretched sideways like a streak.
  vec2 q = vec2(p.x * 2.2, p.y * 1.3) + vLook.w;
  float n = vn(q * 1.7) * 0.65 + vn(q * 4.1 + 7.0) * 0.35;
  float edge = 1.0 - d + (n - 0.5) * 0.55;
  float a = smoothstep(0.0, 0.55, edge) * vLook.y;
  // A flatter, denser base; the top thins out into wisps.
  a *= mix(1.0, smoothstep(-0.2, 0.6, n), smoothstep(0.0, 1.0, p.y));
  if (a < 0.004) discard;
  // Lit from below by the sunset behind the barn: plum undersides, dusky rose, then amber and peach on the lit edges.
  float lit = clamp(vLook.x * 0.55 + p.y * 0.35 + 0.15 + (n - 0.5) * 0.3, 0.0, 1.0);
  vec3 col = mix(uPlum, uRose, smoothstep(0.0, 0.45, lit));
  col = mix(col, uAmber, smoothstep(0.4, 0.75, lit));
  col = mix(col, uPeach, smoothstep(0.75, 1.0, lit) * smoothstep(0.35, 0.95, d));
  // Near the moon: a faint pale rim on the outer edge.
  col = mix(col, uPale, vRim * smoothstep(0.55, 0.95, d) * 0.35);
  // Far banks fade toward the dusk haze.
  col = mix(col, uHaze, vLook.z);
  gl_FragColor = vec4(col, a);
}`;

const PUFFS = duskPuffCount();
/** The shader writes its colour as is (no colour-space step), so the hex values are taken without conversion. */
const raw = (hex: number) => new Color().setHex(hex, LinearSRGBColorSpace);

/**
 * The Pumpkin Patch's sunset clouds: long flat banks and thin streaks in three depth layers, lit by the sun behind the barn
 * (peach and amber edges, dusky rose, plum undersides), with soft ragged see-through edges. Each layer drifts slowly sideways
 * at its own speed; none covers the moon's face or the header text (`tests/pumpkinFar.test.ts`). Camera-facing puffs, two
 * triangles each, one draw call. With reduced motion they hold still.
 */
export function DuskClouds() {
  const display = useDisplay();
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const { geo, mat } = useMemo(() => {
    const g = new BufferGeometry();
    const corners = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
    const corner = new Float32Array(PUFFS * 12);
    for (let i = 0; i < PUFFS; i++) corner.set(corners, i * 12);
    g.setAttribute('position', new BufferAttribute(new Float32Array(PUFFS * 18), 3));
    g.setAttribute('aCenter', new BufferAttribute(new Float32Array(PUFFS * 18), 3));
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(PUFFS * 12), 2));
    g.setAttribute('aLook', new BufferAttribute(new Float32Array(PUFFS * 24), 4));
    g.setAttribute('aRim', new BufferAttribute(new Float32Array(PUFFS * 6), 1));
    g.setAttribute('aCorner', new BufferAttribute(corner, 2));
    const m = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uPeach: { value: raw(0xffc08a) },
        uAmber: { value: raw(0xf08a3e) },
        uRose: { value: raw(0xa8474a) },
        uPlum: { value: raw(0x4a1f33) },
        uHaze: { value: raw(0xb85a3a) },
        uPale: { value: raw(0xfff0c8) },
      },
    });
    return { geo: g, mat: m };
  }, []);
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  const place = (t: number) => {
    const center = geo.getAttribute('aCenter') as BufferAttribute;
    const size = geo.getAttribute('aSize') as BufferAttribute;
    const look = geo.getAttribute('aLook') as BufferAttribute;
    const rim = geo.getAttribute('aRim') as BufferAttribute;
    const tanH = Math.tan((fovForAspect(aspect) * Math.PI) / 360);
    duskPuffsOnScreen(aspect, t).forEach((p, i) => {
      const c = DUSK_CLOUDS[p.cloud]!;
      const layer = DUSK_LAYERS[c.layer];
      const dist = DUSK_DISTANCE[c.layer];
      // World size of one window height at this layer's distance.
      const span = 2 * dist * tanH;
      const [x, y, z] = duskWorld(p.x, p.y, aspect, dist);
      const r = duskMoonRim(c, aspect);
      for (let v = 0; v < 6; v++) {
        const k = i * 6 + v;
        center.setXYZ(k, x, y, z);
        size.setXY(k, p.rx * span, p.ry * span);
        look.setXYZW(k, p.puff.tone, layer.alpha * (c.wisp ? 0.6 : 1), layer.haze, p.puff.seed);
        rim.setX(k, r);
      }
    });
    center.needsUpdate = true;
    size.needsUpdate = true;
    look.needsUpdate = true;
    rim.needsUpdate = true;
  };
  useMemo(() => place(0), [aspect]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    if (!display.reduced) place(display.time);
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} name="pumpkin-dusk-clouds" renderOrder={-1} />;
}
