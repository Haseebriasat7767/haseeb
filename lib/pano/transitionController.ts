/**
 * The timing half of a panorama crossfade, with no three.js and no React in
 * it: given elapsed time it says how far through the transition we are and
 * how opaque the incoming room should be. Kept separate so the curve can be
 * tested directly, rather than inferred from pixels.
 */

/** Community consensus and our own eye agree on roughly this. */
export const DEFAULT_TRANSITION_MS = 600;

/** How far the incoming room is pushed away at the start, in scale units. */
export const DEFAULT_DOLLY = 0.06;

export type TransitionOptions = {
  durationMs?: number;
  /**
   * Simulates stepping forward: the incoming shell starts slightly enlarged
   * and settles to 1. Applied to the shell rather than the camera because
   * the camera is under the visitor's control, and moving it mid-gesture
   * fights them.
   */
  dolly?: number;
};

export type TransitionFrame = {
  /** 0 at the start, 1 when finished. */
  progress: number;
  /**
   * What the incoming room's material opacity should be. The outgoing room
   * is never faded out — it is covered. Fading both is what produces the
   * black flash between them.
   */
  incomingOpacity: number;
  /** Multiplier for the incoming shell's scale. */
  incomingScale: number;
  done: boolean;
};

export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export type TransitionController = {
  /** Restarts the curve from zero. */
  start(): void;
  /** Jumps straight to the finished state, with no animation. */
  finish(): void;
  /** Advances by a frame delta in milliseconds and reports the new state. */
  advance(deltaMs: number): TransitionFrame;
  /** The current state without advancing. */
  frame(): TransitionFrame;
  readonly running: boolean;
};

export function createTransitionController(options: TransitionOptions = {}): TransitionController {
  const durationMs = Math.max(1, options.durationMs ?? DEFAULT_TRANSITION_MS);
  const dolly = options.dolly ?? DEFAULT_DOLLY;

  let elapsed = durationMs;

  const frameAt = (ms: number): TransitionFrame => {
    const progress = Math.min(1, ms / durationMs);
    const eased = easeInOutCubic(progress);
    return {
      progress,
      incomingOpacity: eased,
      incomingScale: 1 + dolly * (1 - eased),
      done: progress >= 1,
    };
  };

  return {
    start() {
      elapsed = 0;
    },
    finish() {
      elapsed = durationMs;
    },
    advance(deltaMs: number) {
      elapsed = Math.min(durationMs, elapsed + Math.max(0, deltaMs));
      return frameAt(elapsed);
    },
    frame() {
      return frameAt(elapsed);
    },
    get running() {
      return elapsed < durationMs;
    },
  };
}
