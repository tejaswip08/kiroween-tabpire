import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, CircleGeometry, Color, DoubleSide, Mesh, ShaderMaterial } from 'three';
import { CHAPEL, CHAPEL_DOOR } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import type { Icicle } from '../../../../../lib/scene/uniqueScenes/frostIce';
import { useDisplay } from '../display';
import { Icicles } from './Icicles';
import { buildChapel, buildDoorway } from './frostShapes';
import { litMaterial } from './frostParts';
const doorVertex = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// A dark pointed doorway. Faint icy blue light rises from the floor and from the middle, and breathes very slowly.
const doorFragment = /* glsl */ `
varying vec2 vP; uniform float uPulse; uniform vec3 uIce;
void main() {
  float x = abs(vP.x) / ${(CHAPEL_DOOR.width / 2).toFixed(2)};
  float h = clamp(vP.y / ${(CHAPEL_DOOR.point + 0.35).toFixed(2)}, 0.0, 1.0);
  float glow = (1.0 - smoothstep(0.0, 0.95, h)) * (1.0 - 0.55 * x * x);
  vec3 col = mix(vec3(0.008, 0.014, 0.03), uIce * (0.6 + 0.4 * uPulse), glow * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`;
const spillVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const spillFragment = /* glsl */ `
varying vec2 vUv; uniform float uPulse; uniform vec3 uIce;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.2) * (0.3 + 0.12 * uPulse);
  gl_FragColor = vec4(uIce * a, a);
}`;
/**
 * The ruined chapel at the end of the path: one merged mesh (walls, broken roof, bell tower, crooked cross, snow), a dark doorway that
 * glows faint icy blue (the crypt your tabs are saved to), a soft spill of that light on the snow, and long icicles on its eaves.
 * Under reduced motion the doorway light stands still.
 */
export function FrostChapel({ icicles }: { icicles: readonly Icicle[] }) {
  const display = useDisplay();
  const parts = useMemo(() => {
    const body = new Mesh(buildChapel(), litMaterial('#16305a', 0.55));
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'frost-chapel';
    const door = new Mesh(
      buildDoorway(),
      new ShaderMaterial({ vertexShader: doorVertex, fragmentShader: doorFragment, uniforms: { uPulse: { value: 0.7 }, uIce: { value: new Color('#7fc8ff').multiplyScalar(1.15) } }, fog: false, side: DoubleSide }),
    );
    door.position.set(0, 0.02, CHAPEL.frontZ + 0.12);
    door.name = 'frost-chapel-door';
    const spill = new Mesh(
      new CircleGeometry(1, 20).rotateX(-Math.PI / 2),
      new ShaderMaterial({
        vertexShader: spillVertex, fragmentShader: spillFragment, uniforms: { uPulse: { value: 0.7 }, uIce: { value: new Color('#6cb8ff').multiplyScalar(1.1) } },
        transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      }),
    );
    spill.position.set(0, 0.05, CHAPEL.frontZ + 2.2);
    spill.scale.set(3.2, 1, 2.8);
    spill.renderOrder = 3;
    spill.name = 'frost-chapel-light';
    return { body, door, spill };
  }, []);
  useEffect(
    () => () => {
      for (const m of [parts.body, parts.door, parts.spill]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
      }
    },
    [parts],
  );
  useFrame(() => {
    // 0.7 when still; a slow breath (about 7 seconds) otherwise.
    const k = display.reduced ? 0.7 : 0.7 + 0.3 * Math.sin(display.time * 0.9);
    (parts.door.material as ShaderMaterial).uniforms.uPulse!.value = k;
    (parts.spill.material as ShaderMaterial).uniforms.uPulse!.value = k;
  });
  return (
    <>
      <group position={[CHAPEL.x, 0, CHAPEL.z]} rotation={[0, CHAPEL.rotY, 0]} scale={CHAPEL.scale}>
        <primitive object={parts.body} />
        <primitive object={parts.door} />
        <primitive object={parts.spill} />
      </group>
      <Icicles icicles={icicles} name="chapel-icicles" />
    </>
  );
}
