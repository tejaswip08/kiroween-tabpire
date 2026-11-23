// Numbers about the vampire model and the coffin. Pure.
// The facing and the eye fractions are guesses made without looking at the model.
// They are the first things to check in Chrome (see the check list in tasks.md).

/** Size of vampire.glb after its node scale: feet at y = 0, centred sideways. */
export const VAMPIRE = {
  height: 1.0,
  width: 0.72,
  depth: 0.57,
  /**
   * Turn (radians about the vertical axis) that makes the model face the camera.
   * 0 means the model's front is already on +z. If it looks away, try Math.PI.
   * If it looks sideways, try Math.PI / 2 or -Math.PI / 2.
   */
  facingYaw: 0,
  /**
   * Where the eyes are, as fractions of the model. Used to place the eyelids when asleep.
   * `y` is the share of the height from the feet. `x` is how far each eye is from the
   * middle, as a share of the full width. Change them if the lids miss the eyes.
   */
  eyeY: 0.8,
  eyeX: 0.16,
  /** Eyelid arc size as a share of the width. */
  eyelidWidth: 0.11,
} as const;

/** coffin.glb: body and lid. The lid sits 0.2 above the body. */
export const COFFIN = {
  width: 0.574,
  length: 0.838,
  bodyHeight: 0.2,
  lidOffsetY: 0.2,
  /** The open lid is lifted, turned up and moved to the side by these amounts. */
  lidOpenAngle: 1.15,
  lidOpenShift: { x: 0.0, y: 0.08, z: -0.46 },
} as const;

/**
 * How the lying vampire sits in the open coffin, in the coffin's own space.
 * Lying on its back means turning it by -90 degrees about x: its head points toward
 * -z and its face points up. Its height then runs along the coffin's length.
 */
export function coffinFit(): { scale: number; x: number; y: number; z: number; rotX: number } {
  const scale = (COFFIN.length * 0.86) / VAMPIRE.height;
  return {
    scale,
    x: 0,
    // The body sinks into the coffin so only its upper half shows above the rim.
    y: COFFIN.bodyHeight * 0.55,
    // The feet are at the model's origin, so shift to centre the body along the coffin.
    z: (VAMPIRE.height * scale) / 2,
    rotX: -Math.PI / 2,
  };
}

/** Portrait slot size, and how the standing vampire is framed in it: the whole body on its tomb, in an arch. */
export const SLOT = { width: 190, height: 170 } as const;
export const FRAME = {
  /** World height shown in the slot. The whole vampire and the top of its stone tomb. */
  worldHeight: 1.35,
  /** Height of the middle of the frame above the feet (the head top is at 1.0, the tomb is below 0). */
  centreY: 0.395,
  /** Camera distance and vertical field of view that give `worldHeight` at that distance. */
  distance: 3.47,
  fov: 22,
} as const;

/** The world height a camera at `distance` with `fov` degrees sees. Used to check the framing. */
export function visibleHeight(distance: number, fovDeg: number): number {
  return 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
}

/**
 * A ray from the front of the model toward one eye, in the model's own space (before the
 * group is turned to face the camera). Its first hit on the surface is where the eyelid goes.
 * `side` is -1 for the left eye as seen from the front, 1 for the right.
 */
export function eyeRay(side: -1 | 1, facingYaw: number = VAMPIRE.facingYaw): {
  origin: [number, number, number];
  dir: [number, number, number];
} {
  const s = Math.sin(facingYaw);
  const c = Math.cos(facingYaw);
  // Direction the model's front points, and its sideways axis, once the yaw is undone.
  const front: [number, number, number] = [-s, 0, c];
  const right: [number, number, number] = [c, 0, s];
  const off = side * VAMPIRE.eyeX * VAMPIRE.width;
  const y = VAMPIRE.eyeY * VAMPIRE.height;
  const reach = 2;
  return {
    origin: [right[0] * off + front[0] * reach, y, right[2] * off + front[2] * reach],
    dir: [-front[0], 0, -front[2]],
  };
}
