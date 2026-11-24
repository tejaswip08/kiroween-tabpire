import { BufferAttribute, type BufferGeometry, Matrix4, type Material } from 'three';
import { SWAY_CLOTH, swayWeights, type SwayModel } from '../../../../../lib/scene/uniqueScenes/castleParts';
import { compose, type Batch, type Owned } from '../ModelBatch';
/** The two numbers every swaying cloth reads: the animation time, and how far the cloth swings (0 stands still). Shared by all of them. */
export interface SwayClock {
  time: { value: number };
  amp: { value: number };
}
/** The one vertex-shader sway. `aSway` is the swing of each vertex (0 where the cloth hangs, up to its amplitude at the free end). */
export const SWAY_HEAD = /* glsl */ `
attribute float aSway;
uniform float uSwayTime;
uniform float uSwayAmp;`;
export const SWAY_BODY = /* glsl */ `
// Each instance has its own phase, from where it stands: neighbouring cloths do not swing together.
float swayPhase = instanceMatrix[3].x * 0.83 + instanceMatrix[3].z * 0.57;
float swayWave = sin(uSwayTime * 1.6 + swayPhase) + 0.45 * sin(uSwayTime * 2.9 + swayPhase * 1.7);
transformed.x += aSway * uSwayAmp * swayWave;
transformed.z += aSway * uSwayAmp * 0.4 * cos(uSwayTime * 1.3 + swayPhase);`;
export const SWAY_KEY = 'tabpire-cloth-sway';
/** A copy of a material whose vertex shader sways the cloth (the file's own material is never changed). */
export function makeSwayMaterial(src: Material, clock: SwayClock): Material {
  const mat = src.clone();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = clock.time;
    shader.uniforms.uSwayAmp = clock.amp;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWAY_BODY}`);
  };
  mat.customProgramCacheKey = () => SWAY_KEY;
  return mat;
}
/**
 * A copy of a part's geometry in the model's own space (the part's matrix applied), with the sway weight of every vertex:
 * hanging from its top edge, swinging most at its lowest point. Built once, never per frame.
 */
export function swayGeometry(geometry: BufferGeometry, local: Matrix4, amplitude: number): BufferGeometry {
  const g = geometry.clone().applyMatrix4(local);
  const pos = g.getAttribute('position');
  const ys = new Float32Array(pos.count);
  let top = -Infinity;
  let bottom = Infinity;
  for (let i = 0; i < pos.count; i++) {
    ys[i] = pos.getY(i);
    top = Math.max(top, ys[i]!);
    bottom = Math.min(bottom, ys[i]!);
  }
  g.setAttribute('aSway', new BufferAttribute(swayWeights(ys, top, bottom, amplitude), 1));
  return g;
}
/**
 * Makes the cloth part of a model sway: its geometry and material are swapped for the sway copies and its instances no longer
 * carry the part's own matrix (it is baked into the geometry). Only the part with the cloth material changes. Returns how many.
 */
export function applySway(id: SwayModel, batches: readonly Batch[], clock: SwayClock, owned: Owned): number {
  const cloth = SWAY_CLOTH[id];
  let n = 0;
  for (const b of batches) {
    if (b.part.material.name !== cloth.material) continue;
    const geometry = swayGeometry(b.part.geometry, b.part.local, cloth.amplitude);
    const material = makeSwayMaterial(b.part.material, clock);
    b.mesh.geometry = geometry;
    b.mesh.material = material;
    b.mesh.castShadow = false;
    const m = new Matrix4();
    for (const e of b.entries) b.mesh.setMatrixAt(e.index, compose(e.placement, 1, m));
    b.mesh.instanceMatrix.needsUpdate = true;
    owned.geometries.push(geometry);
    owned.materials.push(material);
    n++;
  }
  return n;
}
