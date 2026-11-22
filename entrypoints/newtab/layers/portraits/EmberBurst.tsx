import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points } from 'three';
import { mulberry32 } from '../../../../lib/scene/rng';

const COUNT = 70;
const vertex = /* glsl */ `
attribute vec4 aSeed; uniform float uTime; uniform float uAmount; varying float vA;
void main() {
  float life = fract(aSeed.w + uTime * (0.5 + aSeed.x * 0.5));
  vec3 p = vec3((aSeed.x - 0.5) * 0.6 + sin(uTime * 3.0 + aSeed.y * 20.0) * 0.04, 0.5 + aSeed.y * 0.5 + life * 0.6, (aSeed.z - 0.5) * 0.3);
  vA = uAmount * sin(3.14159 * life);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (3.0 + aSeed.z * 5.0) * 2.6 / max(0.5, -mv.z) * 6.0;
  gl_Position = projectionMatrix * mv;
}`;
const fragment = /* glsl */ `
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = clamp(1.0 - r, 0.0, 1.0) * vA;
  gl_FragColor = vec4(vec3(3.2, 1.2, 0.3) * a, a);
}`;

/** Embers that rise from the vampire while it burns away in the Dawn exit. */
export function EmberBurst({ state }: { state: { current: { exit: { embers: number } | null } | null } }) {
  const ref = useRef<Points>(null);
  const geo = useMemo(() => {
    const rng = mulberry32(5);
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAmount: { value: 0 } }), []);
  useFrame(({ clock }) => {
    const amount = state.current?.exit?.embers ?? 0;
    if (ref.current) ref.current.visible = amount > 0.01;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uAmount.value = amount;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false} visible={false}>
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}
