import { type MeshStandardMaterial } from 'three';

/** Values the card changes each frame. One set per card. */
export interface VampireUniforms {
  uBend: { value: number };
  uDissolve: { value: number };
  uEdge: { value: number };
  uAlpha: { value: number };
  uGlow: { value: number };
}

const noise = /* glsl */ `
float vh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vh(i), vh(i + vec3(1,0,0)), f.x), mix(vh(i + vec3(0,1,0)), vh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vh(i + vec3(0,0,1)), vh(i + vec3(1,0,1)), f.x), mix(vh(i + vec3(0,1,1)), vh(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/**
 * A copy of the vampire's material (sharing its textures) with four extra controls:
 *  - bend: bends the body forward (hunch) or back (lean) with a smooth curve over its height,
 *  - dissolve and edge: a noise burn with a bright HDR orange edge (Dawn),
 *  - alpha: a fade at the end of an exit,
 *  - glow: a pulsing red rim for starving vampires.
 * Every copy patches the shader the same way, so three compiles it once.
 */
export function makeVampireMaterial(base: MeshStandardMaterial): { material: MeshStandardMaterial; uniforms: VampireUniforms } {
  const material = base.clone();
  // Opaque until an exit fades it: a transparent double-sided mesh is drawn twice.
  material.transparent = false;
  const uniforms: VampireUniforms = {
    uBend: { value: 0 },
    uDissolve: { value: 0 },
    uEdge: { value: 0 },
    uAlpha: { value: 1 },
    uGlow: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBend;\nvarying vec3 vObjPos;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
vec3 transformed = vec3(position);
{
  // Positions run from -1 (feet) to 1 (head) before the node scale.
  float hh = clamp((position.y + 1.0) * 0.5, 0.0, 1.0);
  float ang = uBend * 0.6 * smoothstep(0.3, 1.0, hh);
  vec3 pv = vec3(0.0, -0.4, 0.0);
  vec3 d = transformed - pv;
  float c = cos(ang); float s = sin(ang);
  d = vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
  transformed = pv + d;
}
vObjPos = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float uDissolve; uniform float uEdge; uniform float uAlpha; uniform float uGlow;\nvarying vec3 vObjPos;\n${noise}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
{
  float n = (vn(vObjPos * 5.0) * 0.6 + vn(vObjPos * 11.0) * 0.4) * 0.92 + 0.04;
  if (uDissolve > 0.0 && n < uDissolve) discard;
  float band = uDissolve > 0.0 ? 1.0 - smoothstep(uDissolve, uDissolve + 0.07, n) : 0.0;
  totalEmissiveRadiance += vec3(3.4, 1.1, 0.25) * band * uEdge;
  float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
  totalEmissiveRadiance += vec3(2.2, 0.08, 0.1) * fr * uGlow;
  diffuseColor.a *= uAlpha;
}`,
      );
  };
  material.customProgramCacheKey = () => 'tabpire-vampire-v1';
  return { material, uniforms };
}
