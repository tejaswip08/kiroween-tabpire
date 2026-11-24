import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Mesh, type MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { WITCH_HOUSE } from '../../../../../lib/scene/uniqueScenes/forestHouse';
import { useDisplay } from '../display';
import { HOUSE_PARTS, buildGlass, buildLanternGlass, buildWitchHouse } from './witchHouseShapes';
const SMOKE_PUFFS = 18;
const smokeVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uHalfHeight; uniform vec3 uOrigin; uniform float uScale;
varying float vAlpha;
void main() {
  float life = fract(aSeed.x + uTime * 0.06);
  // A thin trail: it rises, sways a little and drifts to one side as it thins out.
  vec3 p = uOrigin + vec3(
    (sin(uTime * 0.6 + aSeed.y * 20.0 + life * 5.0) * 0.18 + 0.55 * life) * uScale,
    life * 4.6 * uScale,
    (cos(uTime * 0.5 + aSeed.z * 20.0 + life * 4.0) * 0.12) * uScale);
  vAlpha = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.45, 1.0, life));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float world = (0.16 + life * 0.5) * uScale;
  gl_PointSize = world * projectionMatrix[1][1] * uHalfHeight / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const smokeFragment = /* glsl */ `
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6) * vAlpha * 0.5;
  gl_FragColor = vec4(vec3(0.22, 0.8, 0.3) * a, a);
}`;
/** A slow, uneven flicker between 0.7 and 1.1. Steady for reduced motion. */
export const flickerOf = (t: number, phase: number, reduced: boolean): number =>
  reduced ? 1 : 0.9 + 0.12 * Math.sin(t * 1.3 + phase) + 0.06 * Math.sin(t * 3.1 + phase * 2.3) + 0.04 * Math.sin(t * 7.3 + phase * 5.1);
/**
 * The witch's cottage at the end of the trail: one merged mesh of dark leaning wood and a bent witch's-hat roof, two small
 * windows glowing green-yellow with a slow flicker, a lantern, and a thin trail of green smoke from the crooked chimney.
 * Its materials ignore the scene fog (the haze is baked into the colours), so it stays readable while partly faded.
 */
export function ForestHouse() {
  const display = useDisplay();
  const gl = useThree((s) => s.gl);
  const body = useMemo(() => buildWitchHouse(), []);
  const glass = useMemo(() => HOUSE_PARTS.windows.map((w) => buildGlass(w.size)), []);
  const lantern = useMemo(() => buildLanternGlass(), []);
  const panes = useRef<(Mesh | null)[]>([]);
  const lamp = useRef<Mesh>(null);
  const { scale } = WITCH_HOUSE;
  const smoke = useMemo(() => {
    // The smoke starts at the chimney top, in the world frame of the house (turned and scaled with it).
    const [cx, cy, cz] = HOUSE_PARTS.chimneyTop;
    const cos = Math.cos(WITCH_HOUSE.rotY);
    const sin = Math.sin(WITCH_HOUSE.rotY);
    const rng = mulberry32(8812);
    const seeds = new Float32Array(SMOKE_PUFFS * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    for (let i = 0; i < SMOKE_PUFFS; i++) seeds[i * 4] = i / SMOKE_PUFFS;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SMOKE_PUFFS * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    const material = new ShaderMaterial({
      vertexShader: smokeVertex,
      fragmentShader: smokeFragment,
      uniforms: { uTime: { value: 0 }, uHalfHeight: { value: 540 }, uScale: { value: scale }, uOrigin: { value: new Vector3(WITCH_HOUSE.x + (cx * cos + cz * sin) * scale, cy * scale, WITCH_HOUSE.z + (-cx * sin + cz * cos) * scale) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    return { geo, material };
  }, [scale]);
  useEffect(
    () => () => {
      body.dispose();
      glass.forEach((g) => g.dispose());
      lantern.dispose();
      smoke.geo.dispose();
      smoke.material.dispose();
    },
    [body, glass, lantern, smoke],
  );
  useFrame(() => {
    const t = display.time;
    HOUSE_PARTS.windows.forEach((_, i) => {
      const m = panes.current[i]?.material as MeshBasicMaterial | undefined;
      const f = flickerOf(t, i * 2.7, display.reduced);
      m?.color.setRGB(0.95 * f, 1.25 * f, 0.3 * f);
    });
    (lamp.current?.material as MeshBasicMaterial | undefined)?.color.setRGB(1.5 * flickerOf(t, 4.1, display.reduced), 0.95 * flickerOf(t, 4.1, display.reduced), 0.3);
    const u = smoke.material.uniforms;
    u.uTime!.value = display.reduced ? 0 : t;
    u.uHalfHeight!.value = (gl.domElement.height || 1080) / 2;
  });
  return (
    <>
      <group position={[WITCH_HOUSE.x, 0, WITCH_HOUSE.z]} rotation={[0, WITCH_HOUSE.rotY, 0]} scale={scale} name="witch-house">
        <mesh geometry={body} name="witch-house-body">
          <meshStandardMaterial vertexColors roughness={1} metalness={0} flatShading fog={false} />
        </mesh>
        {HOUSE_PARTS.windows.map((w, i) => (
          <mesh
            key={i}
            ref={(el) => {
              panes.current[i] = el;
            }}
            geometry={glass[i]}
            position={[w.x, w.y, w.z + 0.02]}
            name="witch-house-window"
          >
            <meshBasicMaterial color={[0.95, 1.25, 0.3]} fog={false} />
          </mesh>
        ))}
        <mesh ref={lamp} geometry={lantern} position={[HOUSE_PARTS.lantern.x + 0.3, HOUSE_PARTS.lantern.y, HOUSE_PARTS.lantern.z]} name="witch-house-lantern">
          <meshBasicMaterial color={[1.5, 0.95, 0.3]} fog={false} />
        </mesh>
      </group>
      <points geometry={smoke.geo} material={smoke.material} frustumCulled={false} renderOrder={6} name="witch-house-smoke" />
    </>
  );
}
