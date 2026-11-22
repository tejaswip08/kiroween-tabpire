// The one file to tune quality and budgets. Pure: no three, no browser APIs.

export const QUALITY = {
  /** Background canvas pixel ratio (roadmap: 1). Raise it if the #fps readout has room. */
  sceneDpr: 1,
  sceneAntialias: false,
  /**
   * Bloom uses mipmap blur, which starts from a half-resolution image, so Bloom is
   * half resolution by design. The old resolutionScale option is deprecated.
   */
  bloomMipmapBlur: true,
  shadowMapSize: 2048,
  /** The shadow map is redrawn every this many frames. */
  shadowRefreshFrames: 20,
  /** Highest pixel ratio of the portrait canvas. */
  portraitDprMax: 1.25,
  portraitAntialias: true,
} as const;

export const BUDGET = {
  sceneDrawCalls: 150,
  /** Raised from 150,000 for the richer yard (far village, critters, more trees). Every hidden instance and the shadow pass are counted. */
  sceneTriangles: 175_000,
  vampireTriangles: 15_000,
  maxPointLights: 6,
  /** No exit animation, including the Dawn stagger, lasts longer than this. */
  maxExitMs: 1600,
  maxBundleBytes: 12 * 1024 * 1024,
} as const;

/** Caps for the data-driven things in the scene (Requirement 7). */
export const CAPS = {
  ghosts: 8,
  bats: 24,
  candles: 12,
  newGraves: 24,
  coffins: 8,
} as const;

/**
 * Numbers that decide how the scene looks. Tune them here after you see it in Chrome.
 * Nothing here changes resolution, shadow size or model detail.
 */
export const LOOK = {
  bloom: { intensity: 0.9, threshold: 0.95, smoothing: 0.2, radius: 0.72 },
  vignette: { offset: 0.3, darkness: 0.75 },
  /** Depth fog density before the memory factor is applied. */
  fogDensity: 0.009,
  moonlight: { intensity: 1.1, distance: 70 },
  /** Soft purple light on everything, so no part of the scene is black. */
  hemisphere: { intensity: 2.1 },
  /** A purple fill from the camera's side, so the faces of props toward us are lit. */
  fill: { intensity: 1.3 },
  rim: { intensity: 1.1 },
  /** Real warm lights: intensity in candela, reach in world units. */
  warmLight: { intensity: 60, distance: 11, decay: 2 },
  /** Brightness of glowing things (above 1 so they bloom). */
  glow: { moon: 1.3, flame: 4.5, glass: 3.2, jack: 3.4, door: 2.6, ember: 3.6, ghostRim: 1.6 },
  mist: { alpha: 0.2 },
  /** Seconds a new or removed prop takes to appear or go. */
  propFadeSeconds: 0.8,
  /** How fast shown numbers follow the data, per second. */
  stateEaseRate: 1.6,
} as const;
