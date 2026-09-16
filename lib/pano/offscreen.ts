/**
 * Whether a door is somewhere the visitor can currently see, and if not,
 * which way to turn for it.
 *
 * The problem this answers is specific to portrait. A panorama has doors all
 * around the standpoint, and a phone held upright shows perhaps 50° of that
 * — so most of the time every exit is behind you, with nothing on screen
 * suggesting there is anywhere to go. The compass gives heading, which does
 * not help: it says where north is, not where the doors are.
 *
 * Pure trigonometry, no three, so the thresholds are testable directly
 * rather than inferred from a rendered frame.
 */

/** Signed difference between two bearings, wrapped to (-π, π]. */
export function bearingDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Half the horizontal field of view, from the vertical fov and the aspect
 * ratio. Portrait is the case that matters: at 3:4 the horizontal angle is
 * *narrower* than the vertical one, which is exactly why doors go missing
 * there and not on a desktop frame.
 */
export function horizontalHalfFov(verticalFovDeg: number, aspect: number): number {
  const halfVertical = (verticalFovDeg * Math.PI) / 360;
  return Math.atan(Math.tan(halfVertical) * aspect);
}

export type OffscreenHint = {
  /** Which side of the frame to put the chevron on. */
  side: 'left' | 'right';
  /** Signed bearing difference, radians. Negative is to the left. */
  delta: number;
};

/**
 * A hint when the door is outside the frame, and null when it is inside.
 *
 * Null is the important half: a chevron that keeps pointing at a door the
 * visitor is already looking at is noise, and trains them to ignore it.
 * `margin` pulls the boundary slightly inside the frame edge so the hint
 * does not flicker on and off while a door sits exactly on it.
 */
export function offscreenHint(
  cameraYaw: number,
  hotspotYaw: number,
  halfFov: number,
  margin = 0.05,
): OffscreenHint | null {
  const delta = bearingDelta(cameraYaw, hotspotYaw);
  if (Math.abs(delta) <= Math.max(0, halfFov - margin)) return null;
  return { side: delta < 0 ? 'left' : 'right', delta };
}
