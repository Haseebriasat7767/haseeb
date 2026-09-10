/**
 * Analog movement and look, written from the DOM and read inside the canvas.
 *
 * The on-screen sticks live in ordinary DOM above the canvas — a touch
 * target inside a WebGL scene would have to be raycast, and a thumb resting
 * on a joystick is not something to resolve against building geometry every
 * frame. So the sticks write here and `WalkControls` reads here, the same
 * arrangement `walk-floors` already uses for the lift.
 *
 * Deliberately mutable module state rather than React state: this changes on
 * every pointer move and is read every frame, and re-rendering a canvas host
 * sixty times a second to carry two numbers would be the whole frame budget.
 *
 * Both are ref-shaped so they can be handed straight to `WalkControls`.
 */

/** Strafe and forward, each −1…1. `y` is forward-positive. */
export const walkMove = { current: { x: 0, y: 0 } };

/** Yaw and pitch rate, each −1…1. */
export const walkLook = { current: { x: 0, y: 0 } };

/** Centres both sticks. Called when a touch ends or walk mode is left. */
export function resetWalkInput(): void {
  walkMove.current.x = 0;
  walkMove.current.y = 0;
  walkLook.current.x = 0;
  walkLook.current.y = 0;
}

/** Travel, in pixels, at which a stick reads as fully deflected. */
export const STICK_RANGE = 56;

/** Below this fraction the thumb is resting, not steering. */
export const STICK_DEADZONE = 0.12;

/**
 * How far a stick is pushed, as a pair in −1…1.
 *
 * Clamped to the unit circle rather than the square: without that a diagonal
 * would be √2 times faster than a straight line, which is the oldest bug in
 * analog movement and reads as the building lurching when you turn a corner.
 */
export function stickDeflection(
  origin: { x: number; y: number },
  point: { x: number; y: number },
  range = STICK_RANGE,
): { x: number; y: number } {
  const dx = (point.x - origin.x) / range;
  const dy = (point.y - origin.y) / range;
  const distance = Math.hypot(dx, dy);
  if (distance < STICK_DEADZONE) return { x: 0, y: 0 };
  const scale = Math.min(1, distance) / distance;
  return { x: dx * scale, y: dy * scale };
}
