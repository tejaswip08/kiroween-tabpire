import * as THREE from 'three';

// Shared cel-shading ramp: three hard light bands give the cartoon look.
let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toon(color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

export const INK = '#0b0816';

export type Fx = 'stake' | 'crypt' | 'coffin' | 'burn';
export const FX_MS: Record<Fx, number> = { stake: 1100, crypt: 1300, coffin: 1100, burn: 1700 };

export const ease = {
  in: (k: number) => k * k * k,
  out: (k: number) => 1 - Math.pow(1 - k, 3),
  inOut: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Progress of the sub-range [a, b] within overall progress p, clamped to 0..1. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
