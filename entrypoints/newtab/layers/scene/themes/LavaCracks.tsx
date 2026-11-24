import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';
import { crackRibbon, type Crack } from '../../../../../lib/scene/uniqueScenes/bloodmoonParts';
import { useDisplay } from '../display';

const vertex = /* glsl */ `
attribute float aSide; attribute float aAlong; attribute float aSeed;
varying float vSide; varying float vAlong; varying float vSeed;
void main() {
  vSide = aSide; vAlong = aAlong; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
// A glowing crack: a hot yellow-orange core fading to deep red at the edges. The colour is above 1 in the core, so Bloom picks
// it up. A slow pulse runs along each crack, offset per crack. The pulse follows `uTime`, which stays 0 under reduced motion.
const fragment = /* glsl */ `
varying float vSide; varying float vAlong; varying float vSeed;
uniform float uTime; uniform vec3 uCore; uniform vec3 uEdge;
void main() {
  float d = abs(vSide);
  float glow = 1.0 - smoothstep(0.0, 1.0, d);
  float tip = 1.0 - smoothstep(0.7, 1.0, vAlong);
  float pulse = 0.82 + 0.18 * sin(uTime * 0.9 + vSeed * 6.2831 + vAlong * 3.0);
  vec3 col = mix(uEdge, uCore, glow * glow) * (1.1 + 1.5 * glow * glow) * pulse;
  float a = glow * (0.35 + 0.65 * tip);
  gl_FragColor = vec4(col * a, a);
}`;

/** The geometry of all cracks: one indexed strip mesh (the pure ribbon in `bloodmoonParts`). */
export function buildCrackGeometry(cracks: readonly Crack[]): BufferGeometry {
  const r = crackRibbon(cracks);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(r.position, 3));
  g.setAttribute('aSide', new BufferAttribute(r.side, 1));
  g.setAttribute('aAlong', new BufferAttribute(r.along, 1));
  g.setAttribute('aSeed', new BufferAttribute(r.seed, 1));
  g.setIndex(r.index);
  return g;
}

/**
 * The lava cracks of the Blood Moon: one merged ribbon mesh lying on the ground (one draw call), additive and brighter than the
 * Bloom threshold, so it glows. The slow pulse runs in the shader; under reduced motion the time stays 0 and the cracks stand still.
 */
export function LavaCracks({ cracks }: { cracks: readonly Crack[] }) {
  const display = useDisplay();
  const geometry = useMemo(() => buildCrackGeometry(cracks), [cracks]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uTime: { value: 0 }, uCore: { value: new Color(1.0, 0.55, 0.12) }, uEdge: { value: new Color(0.7, 0.05, 0.03) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uTime!.value = display.reduced ? 0 : display.time;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} name="lava-cracks" />;
}
