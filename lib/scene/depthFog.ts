// The Crypt's ground fog between the backdrop layers: soft upright bands of fog that lie low on the ground behind the fence, so the far
// trees, mausoleums and the village fade into depth. Pure: no three.
// Coordinates are world coordinates (x right, y up, z toward the camera).
export interface FogBand {
  /** Centre of the band's bottom edge. */
  x: number;
  z: number;
  /** Width and height (world units) of the band. */
  w: number;
  h: number;
  /** Peak opacity, drift speed (noise units per second, signed) and noise scale. */
  alpha: number;
  speed: number;
  scale: number;
}
/** Near the fence first, then the dead trees, then the village hills: farther bands are wider, taller and a little thicker. */
export const FOG_BANDS: readonly FogBand[] = [
  { x: 0.5, z: -12, w: 70, h: 2.2, alpha: 0.28, speed: 0.05, scale: 0.12 },
  { x: 0.5, z: -24, w: 96, h: 3.6, alpha: 0.34, speed: -0.035, scale: 0.08 },
  { x: 0.5, z: -38, w: 130, h: 5, alpha: 0.4, speed: 0.025, scale: 0.06 },
  { x: 0.5, z: -70, w: 200, h: 9, alpha: 0.45, speed: -0.015, scale: 0.035 },
];
/** Two triangles per band, one draw call each. */
export const FOG_BAND_TRIS = FOG_BANDS.length * 2;
