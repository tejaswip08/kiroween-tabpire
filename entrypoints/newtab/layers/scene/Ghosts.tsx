import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { Color, FrontSide, InstancedMesh, LatheGeometry, Matrix4, ShaderMaterial, Vector2 } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';

const HEIGHT = 2.0;
/** Two ghosts are always out; a Crypt with items shows a third. */
const MIN_GHOSTS = 2;
const MAX_GHOSTS = 3;

/** A sheet-ghost: a round head, a body that widens toward a scalloped hem. */
function ghostGeometry(): LatheGeometry {
  const profile = [
    [0.62, 0.0], [0.7, 0.3], [0.67, 0.8], [0.62, 1.2], [0.57, 1.5], [0.48, 1.74], [0.34, 1.9], [0.16, 1.98], [0.0, 2.0],
  ].map(([r, y]) => new Vector2(r, y));
  return new LatheGeometry(profile, 32);
}

const vertex = /* glsl */ `
uniform float uTime; uniform float uCount; uniform float uWind;
varying vec3 vLocal; varying vec3 vN; varying vec3 vView; varying float vShown;
void main() {
  float id = float(gl_InstanceID);
  vec3 p = position;
  float ang = atan(p.z, p.x);
  // A scalloped hem that ripples, and a slow bob.
  float hem = 1.0 - clamp(p.y / 0.5, 0.0, 1.0);
  p.y += hem * 0.17 * (1.0 + 0.6 * uWind) * (0.5 + 0.5 * sin(ang * 6.0 + uTime * (2.4 + 1.6 * uWind) + id * 2.0)) - hem * 0.1;
  vLocal = p;
  vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  // In a wind (uWind 1) the sideways drift follows the gusts instead of a plain sway, and stays inside the same 0.9.
  float gust = 0.5 + 0.5 * sin(uTime * 0.7 + 1.3 + id * 0.9);
  float blown = clamp(0.4 * sin(uTime * 0.21 + id * 1.7) + 0.6 * (2.0 * gust * gust - 1.0), -1.0, 1.0);
  center += vec3(mix(sin(uTime * 0.23 + id * 1.7), blown, uWind) * 0.9, sin(uTime * 0.9 + id * 2.0) * 0.22, cos(uTime * 0.19 + id * 2.3) * 0.7);
  // Turn to face the camera.
  float a = atan(cameraPosition.x - center.x, cameraPosition.z - center.z);
  float c = cos(a); float s = sin(a);
  vec3 q = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  // The hem trails downwind (+x) and the head leans with it.
  q.x += uWind * (0.12 + 0.2 * gust) * (hem * 0.8 + p.y * 0.08);
  vec3 n = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
  vec4 mv = viewMatrix * vec4(center + q, 1.0);
  vN = normalize(mat3(viewMatrix) * n);
  vView = normalize(-mv.xyz);
  vShown = clamp(uCount - id, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const fragment = /* glsl */ `
varying vec3 vLocal; varying vec3 vN; varying vec3 vView; varying float vShown;
uniform vec3 uBody; uniform vec3 uRim;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  // Soft mint shading: lighter toward the top and the middle of the front.
  float y = vLocal.y / ${HEIGHT.toFixed(1)};
  vec3 col = uBody * (0.78 + 0.3 * y + 0.2 * (1.0 - fres)) + uRim * fres;
  // Hollow eyes and a small round mouth on the front: dark holes.
  if (vLocal.z > 0.0) {
    float eyes = 0.0;
    for (int i = 0; i < 2; i++) {
      float sx = i == 0 ? -0.22 : 0.22;
      eyes = max(eyes, 1.0 - smoothstep(0.075, 0.1, length((vLocal.xy - vec2(sx, 1.46)) * vec2(1.25, 0.8))));
    }
    float mouth = 1.0 - smoothstep(0.045, 0.065, length((vLocal.xy - vec2(0.0, 1.18)) * vec2(1.0, 0.8)));
    float hole = max(eyes, mouth);
    col = mix(col, vec3(0.02, 0.07, 0.07), hole);
  }
  // Slightly see-through, more at the middle of the front and solid-ish at the edge, with a soft glow.
  float alpha = (0.55 + 0.3 * fres) * vShown;
  col += uRim * 0.35 * (0.4 + fres);
  gl_FragColor = vec4(col, alpha);
}`;

const GHOST_BODY = 0.95;
/**
 * Cute mint-green ghosts with hollow eyes, floating over the graves (a theme may pass a `tint`). Two are always out, and a Crypt
 * with items shows a third. They bob and sway, and always turn to face the camera. A theme with `wind` (the Frozen Cemetery) has them
 * drift with its gusts, their hems trailing downwind.
 */
export function Ghosts({ tint, wind = 0 }: { tint?: string; wind?: number } = {}) {
  const display = useDisplay();
  const { scene } = useSceneTheme();
  const mesh = useMemo(() => {
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uCount: { value: MIN_GHOSTS },
        uWind: { value: 0 },
        uBody: { value: sceneColorsFor('crypt').ghost.clone().multiplyScalar(GHOST_BODY) },
        uRim: { value: sceneColorsFor('crypt').ghost.clone().multiplyScalar(LOOK.glow.ghostRim) },
      },
      transparent: true,
      depthWrite: false,
      side: FrontSide,
      fog: false,
    });
    const m = new InstancedMesh(ghostGeometry(), mat, MAX_GHOSTS);
    m.frustumCulled = false;
    m.renderOrder = 4;
    return m;
  }, []);
  // The spots follow the shown theme. A theme switch moves the ghosts; it never builds a new mesh.
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const mat4 = new Matrix4();
    scene.layout.ghostSpots.slice(0, MAX_GHOSTS).forEach((g, i) => {
      mat4.makeTranslation(g.x, g.y - HEIGHT / 2 + 0.4, g.z);
      mesh.setMatrixAt(i, mat4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [mesh, scene.layout.ghostSpots, invalidate]);
  // A theme may tint its ghosts (Frozen Cemetery: icy blue); without a tint they keep the palette's ghost colour.
  const tinted = useMemo(() => (tint ? new Color(tint) : null), [tint]);
  useColorSync((c) => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    const base = tinted ?? c.ghost;
    (u.uBody!.value as Color).copy(base).multiplyScalar(GHOST_BODY);
    (u.uRim!.value as Color).copy(base).multiplyScalar(LOOK.glow.ghostRim);
  });
  // A theme with only two ghost spots (the Crypt) never shows a third.
  const spots = scene.layout.ghostSpots.length;
  useFrame(() => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime!.value = display.time;
    u.uWind!.value = display.reduced ? 0 : wind;
    u.uCount!.value = Math.min(MAX_GHOSTS, spots, Math.max(MIN_GHOSTS, display.ghosts));
  });
  return <primitive object={mesh} />;
}
