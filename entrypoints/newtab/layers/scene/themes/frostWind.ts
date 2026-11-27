// The wind of the Frozen Cemetery in the shaders: one shared clock (time, gust, amplitude) that every swaying thing reads. JavaScript
// writes the three numbers once a frame (`FrostGale`); the bending runs in the vertex shaders. Under reduced motion the amplitude is 0.
import type { Material } from 'three';
export interface WindClock {
  time: { value: number };
  /** The wind of `gustAt`, about 0.35 (calm) to 1 (a gust). */
  gust: { value: number };
  /** 1 moves, 0 stands still. */
  amp: { value: number };
}
/** The one wind clock of the scene. */
export const frostWind: WindClock = { time: { value: 0 }, gust: { value: 0.5 }, amp: { value: 0 } };
const HEAD = /* glsl */ `
uniform float uWindTime;
uniform float uWindGust;
uniform float uWindAmp;`;
/**
 * Bends an instanced model with the wind: each vertex moves sideways by the square of its height above the instance's foot (the foot
 * stays put, the top moves most), with its own phase per instance so neighbours never sway together, and leans a little downwind in a
 * gust. `height` is the model's height in the units of the instance matrix's y column, so the bend fits every scale.
 */
const body = (height: number, strength: number) => /* glsl */ `
#ifdef USE_INSTANCING
{
  vec3 windFoot = instanceMatrix[3].xyz;
  vec3 windAt = (instanceMatrix * vec4(transformed, 1.0)).xyz;
  float windTall = ${height.toFixed(4)} * length(instanceMatrix[1].xyz);
  float windH = clamp((windAt.y - windFoot.y) / max(windTall, 0.001), 0.0, 1.2);
  float windPh = windFoot.x * 0.71 + windFoot.z * 0.37;
  float windS = sin(uWindTime * 1.25 + windPh) * 0.65 + sin(uWindTime * 2.6 + windPh * 1.9) * 0.25;
  float windK = ${strength.toFixed(4)} * windTall * windH * windH * uWindAmp;
  vec3 windOff = vec3(windK * (0.7 * uWindGust + windS * (0.45 + 0.55 * uWindGust)), 0.0, windK * 0.35 * sin(uWindTime * 0.9 + windPh));
  transformed += inverse(mat3(instanceMatrix)) * windOff;
}
#endif`;
/** Makes a material (already a copy owned by its caller) sway with the wind. Keeps whatever the material did before compiling. */
export function addWind(mat: Material, height: number, strength: number, clock: WindClock = frostWind): Material {
  const before = mat.onBeforeCompile.bind(mat);
  const key = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uWindTime = clock.time;
    shader.uniforms.uWindGust = clock.gust;
    shader.uniforms.uWindAmp = clock.amp;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${body(height, strength)}`);
  };
  mat.customProgramCacheKey = () => `${key()}|wind-${height.toFixed(3)}-${strength.toFixed(3)}`;
  return mat;
}
/**
 * The flag's cloth ripples: waves run from the pole to the free end, bigger toward the free end and in a gust; the cloth also streams
 * out downwind. `aCloth`-free: the weight is the distance from the pole (x, 0 to `length`).
 */
export function addFlutter(mat: Material, length: number, clock: WindClock = frostWind): Material {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = clock.time;
    shader.uniforms.uWindGust = clock.gust;
    shader.uniforms.uWindAmp = clock.amp;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${HEAD}`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
{
  float flagK = clamp(position.x / ${length.toFixed(3)}, 0.0, 1.0);
  float flagW = sin(position.x * 5.5 - uWindTime * 7.0) * 0.6 + sin(position.x * 9.0 - uWindTime * 11.0 + position.y * 4.0) * 0.25;
  transformed.z += flagK * (0.12 + 0.16 * uWindGust) * flagW * uWindAmp;
  transformed.y += flagK * flagK * (0.18 * uWindGust - 0.12) * uWindAmp + flagK * flagK * -0.12 * (1.0 - uWindAmp);
}`,
    );
  };
  mat.customProgramCacheKey = () => 'frost-flag-flutter';
  return mat;
}
