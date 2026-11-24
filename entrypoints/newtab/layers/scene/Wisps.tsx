import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, type Color, ShaderMaterial, Vector3 } from 'three';
import { wispGlow, wispOffset } from '../../../../lib/scene/critters';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';

const vertex = /* glsl */ `
attribute float aGlow;
varying vec2 vUv; varying float vGlow;
void main() {
  vUv = uv; vGlow = aGlow;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * (c + vec4(position.xy * s, 0.0, 0.0));
}`;
const fragment = /* glsl */ `
varying vec2 vUv; varying float vGlow; uniform vec3 uColor;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  // A bright small core inside a wide soft halo.
  float core = pow(clamp(1.0 - r * 2.6, 0.0, 1.0), 1.5);
  float halo = pow(clamp(1.0 - r, 0.0, 1.0), 2.4) * 0.5;
  float a = (core * 1.8 + halo) * vGlow;
  gl_FragColor = vec4(uColor * a, a);
}`;

const m4 = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const sc = new Vector3();
const off = { x: 0, y: 0, z: 0 };

/** Small blue-green lights that drift in slow loops between the graves and glow softly. One draw call. */
const WISP_LEVEL = 2.2;
export function Wisps() {
  const display = useDisplay();
  const { scene } = useSceneTheme();
  const wisps = useMemo(() => scene.layout.scenery.wisps, [scene.layout.scenery.wisps]);
  const mesh = useMemo(() => {
    const geo = new PlaneGeometry(1, 1);
    geo.setAttribute('aGlow', new InstancedBufferAttribute(new Float32Array(wisps.length).fill(1), 1));
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uColor: { value: sceneColorsFor('crypt').wisp.clone().multiplyScalar(WISP_LEVEL) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const m = new InstancedMesh(geo, mat, wisps.length);
    m.frustumCulled = false;
    m.renderOrder = 7;
    return m;
  }, [wisps]);
  useColorSync((c) => {
    ((mesh.material as ShaderMaterial).uniforms.uColor!.value as Color).copy(c.wisp).multiplyScalar(WISP_LEVEL);
  });
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    const glow = mesh.geometry.getAttribute('aGlow') as InstancedBufferAttribute;
    wisps.forEach((w, i) => {
      wispOffset(t, w.seed, off);
      p.set(w.x + off.x, w.y + off.y, w.z + off.z);
      sc.setScalar(0.85);
      mesh.setMatrixAt(i, m4.compose(p, q, sc));
      glow.setX(i, wispGlow(t, w.seed));
    });
    mesh.instanceMatrix.needsUpdate = true;
    glow.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
