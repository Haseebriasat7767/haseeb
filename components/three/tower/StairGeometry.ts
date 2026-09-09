import type { BoxSpec, Range } from '../villa/VillaTypes';

/**
 * A dogleg stair, and the shaft it runs in.
 *
 * ## Why this exists
 *
 * The building had a lift lobby on every level and a glazed screen where the
 * escape stair should be, with solid stone behind it. That reads correctly
 * from inside the lobby and is a lie the moment anyone tries to use it: the
 * only way between floors was a camera cut. Once the visitor is on foot,
 * every floor above the ground is unreachable, which makes fifteen storeys of
 * apartments scenery.
 *
 * ## What it is
 *
 * One shaft for the whole height of the building — through the retail podium
 * and on up the service blade — because that is what a fire stair is. Two
 * flights and a half landing per storey, arriving at the same end of the
 * shaft on every floor, so the door is in the same place every time.
 *
 * Storey heights differ (the podium is 5m, the tower 3.4m) so the tread count
 * is computed per storey from a target riser rather than fixed. That is also
 * what stops the going from running out of shaft on the taller storeys.
 *
 * ## Collision
 *
 * Nothing here is special-cased for walking. A tread is a box; the capsule
 * lands on it and is pushed up out of it. The stair works because the steps
 * are shallower than the capsule's radius, which is the same reason a real
 * stair works and a ladder does not.
 */

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return { key, position: [mid(x), mid(y), mid(z)], scale: [span(x), span(y), span(z)] };
}

/** Riser we aim for. The tread count per flight is whatever hits it closest. */
const TARGET_RISER = 0.175;
/** Deepest going worth having; the shaft is wider than the stair needs. */
const MAX_GOING = 0.3;
/** Landing depth at each end of the shaft. */
const LANDING = 1.35;
/** The well between the two flights. */
const WELL = 0.2;
/** How far a tread's soffit hangs below its own nosing. */
const TREAD_DEPTH = 0.22;

export type StairLayout = {
  /** Treads and landings — the thing you walk on. */
  steps: BoxSpec[];
  /** The shaft enclosure, with a doorway at every level it serves. */
  walls: BoxSpec[];
  /**
   * Where the doorway is, so whatever screens the shaft can leave the same
   * gap. Published rather than recomputed: the lift lobby's glazed screen is
   * built in another file, and two files agreeing by arithmetic is two files
   * that will one day disagree.
   */
  doorX: Range;
};

export type StairOptions = {
  key: string;
  /** Outer bounds of the shaft, walls included. */
  x: Range;
  z: Range;
  wall: number;
  /**
   * Finished floor height of every level the stair serves, ascending.
   *
   * Heights, not indices: the podium's storeys and the tower's are different
   * and the stair does not care, it just walks from one number to the next.
   */
  levels: readonly number[];
  /** Top of the enclosure. Usually above the last level it serves. */
  topY: number;
  /** Which end of the shaft the doors are at. */
  doorEnd: 'min' | 'max';
  doorWidth?: number;
  doorHeight?: number;
};

export function createStair({
  key,
  x,
  z,
  wall,
  levels,
  topY,
  doorEnd,
  doorWidth = 1.15,
  doorHeight = 2.2,
}: StairOptions): StairLayout {
  const steps: BoxSpec[] = [];
  const walls: BoxSpec[] = [];

  const innerX: Range = [x[0] + wall, x[1] - wall];
  const innerZ: Range = [z[0] + wall, z[1] - wall];

  // Doors at the near end; the half landing is always at the far end.
  const near = doorEnd === 'min' ? innerZ[0] : innerZ[1];
  const sign = doorEnd === 'min' ? 1 : -1;
  const nearLanding: Range =
    doorEnd === 'min' ? [innerZ[0], innerZ[0] + LANDING] : [innerZ[1] - LANDING, innerZ[1]];
  const farLanding: Range =
    doorEnd === 'min' ? [innerZ[1] - LANDING, innerZ[1]] : [innerZ[0], innerZ[0] + LANDING];

  // The two flights, side by side with the well between them.
  const centreX = mid(innerX);
  const flightA: Range = [innerX[0], centreX - WELL / 2];
  const flightB: Range = [centreX + WELL / 2, innerX[1]];

  // Centred on the flight you climb, not on the shaft.
  //
  // Centred on the shaft it lands on the well between the two flights, and
  // walking straight in from the door steps into a hole — which is exactly
  // what the first version did: the visitor entered at ground level, walked
  // the length of the stairwell on the slab below it, and never touched a
  // tread. A stair door opens onto the foot of a flight.
  const doorCentre = mid(flightA);
  const doorX: Range = [doorCentre - doorWidth / 2, doorCentre + doorWidth / 2];

  // Where a flight starts and stops running, measured from the near end.
  const runStart = near + sign * LANDING;
  const runLength = span(innerZ) - 2 * LANDING;

  /** A landing slab, sitting with its top at `y`. */
  const landing = (name: string, y: number, zr: Range) =>
    steps.push(box(name, innerX, [y - TREAD_DEPTH, y], zr));

  const floors = [...levels].sort((a, b) => a - b);
  const bottom = floors[0];
  if (bottom === undefined) return { steps, walls, doorX };

  // The bottom landing. Every storey above lands on the one below's arrival.
  landing(`${key}-landing-0`, bottom, nearLanding);

  for (let i = 0; i < floors.length - 1; i += 1) {
    const from = floors[i] as number;
    const to = floors[i + 1] as number;
    const rise = to - from;
    // Two flights, so each climbs half the storey.
    const treads = Math.max(2, Math.round(rise / 2 / TARGET_RISER));
    const riser = rise / 2 / treads;
    const going = Math.min(MAX_GOING, runLength / treads);

    // Flight one: near end to far end, in the first half of the shaft.
    for (let t = 0; t < treads; t += 1) {
      const top = from + (t + 1) * riser;
      const z0 = runStart + sign * t * going;
      const z1 = z0 + sign * going;
      steps.push(
        box(
          `${key}-f${i}a-${t}`,
          flightA,
          [top - riser - TREAD_DEPTH, top],
          sign > 0 ? [z0, z1] : [z1, z0],
        ),
      );
    }

    // The half landing, turning you round.
    landing(`${key}-half-${i}`, from + rise / 2, farLanding);

    // Flight two: far end back to near, in the other half.
    const backStart = near + sign * (LANDING + treads * going);
    for (let t = 0; t < treads; t += 1) {
      const top = from + rise / 2 + (t + 1) * riser;
      const z0 = backStart - sign * t * going;
      const z1 = z0 - sign * going;
      steps.push(
        box(
          `${key}-f${i}b-${t}`,
          flightB,
          [top - riser - TREAD_DEPTH, top],
          sign > 0 ? [z1, z0] : [z0, z1],
        ),
      );
    }

    // Arrival: the landing you step off onto, and the floor of the next storey.
    landing(`${key}-landing-${i + 1}`, to, nearLanding);
  }

  // ── The enclosure ───────────────────────────────────────────────────────
  //
  // Three sides solid for the full height; the door side is split around the
  // openings. The doorways are the only reason this is not four boxes.
  const baseY = bottom - TREAD_DEPTH;
  const full: Range = [baseY, topY];

  const doorSideZ: Range = doorEnd === 'min' ? [z[0], z[0] + wall] : [z[1] - wall, z[1]];
  const backSideZ: Range = doorEnd === 'min' ? [z[1] - wall, z[1]] : [z[0], z[0] + wall];

  walls.push(box(`${key}-wall-back`, x, full, backSideZ));
  walls.push(box(`${key}-wall-w`, [x[0], x[0] + wall], full, innerZ));
  walls.push(box(`${key}-wall-e`, [x[1] - wall, x[1]], full, innerZ));

  walls.push(box(`${key}-wall-door-w`, [x[0], doorX[0]], full, doorSideZ));
  walls.push(box(`${key}-wall-door-e`, [doorX[1], x[1]], full, doorSideZ));
  // Over and under each opening, in one strip up the middle of the wall.
  let y = baseY;
  for (const level of floors) {
    if (level > y) walls.push(box(`${key}-wall-door-u${level}`, doorX, [y, level], doorSideZ));
    y = level + doorHeight;
  }
  if (topY > y) walls.push(box(`${key}-wall-door-top`, doorX, [y, topY], doorSideZ));

  return { steps, walls, doorX };
}
