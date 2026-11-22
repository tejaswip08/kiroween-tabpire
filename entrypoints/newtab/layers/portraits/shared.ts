import type { ExitFrame, TimelineKind } from '../../../../lib/vampire/exits';
import type { Pose } from '../../../../lib/vampire/pose';
import type { VampireUniforms } from './vampireMaterial';

/** What one card's vampire is showing right now. The vampire writes it each frame; the coffin, the z letters and the camera read it. */
export interface PortraitState {
  pose: Pose;
  uniforms: VampireUniforms;
  /** Set while an exit or the coffin transition plays. */
  exit: ExitFrame | null;
}

export type PortraitRef = { current: PortraitState | null };


/** An exit or transition that is playing for one card. */
export interface ExitRun {
  kind: TimelineKind;
  /** performance.now() when it began. */
  t0: number;
  /** Position among the cards that leave together (Dawn staggers by it). */
  order: number;
  /** The pose the vampire had when the exit began. Taken on the first frame. */
  idle: Pose | null;
}
