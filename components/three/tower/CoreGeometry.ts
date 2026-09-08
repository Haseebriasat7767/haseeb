import type { PropPlacement } from './SiteProps';
import type { BoxSpec, Range } from '../villa/VillaTypes';
import type { TowerPlan } from './TowerTypes';

/**
 * The lift lobby, repeated on every residential level.
 *
 * ## Why this is one set and not fifteen
 *
 * The asset schedule calls the core "1 set, repeated on every level", and that
 * is exactly what a tower is: the apartments differ, the way into them does
 * not. So this is one arrangement generated at every floor height rather than
 * fifteen designs, which is also why it costs almost nothing — the fabric
 * merges into the existing meshes and the fittings instance by piece.
 *
 * ## What it fixed
 *
 * The service blade was solid for its whole height. That was structurally
 * honest and architecturally impossible: fifteen floors of apartments with no
 * way into any of them, and a walkthrough that stepped from a spa on the
 * lowest level straight into a living room on the twelfth with nothing in
 * between. A building is largely the parts of it nobody photographs.
 *
 * ## What it does not do
 *
 * It does not connect to the apartment. The fit-out on the furnished level
 * plans the whole plate as one dwelling, with a bed against the wall this
 * lobby would open through, so the door here is a leaf on a wall rather than a
 * way in. Re-planning the residential floors around a real entrance hall is a
 * question about how many apartments are on a floor and where their front
 * doors go, and that is `DAT-01` — the floor plans, which have to come from
 * the client. Everything else here is honest; this one thing is a placeholder
 * and is marked as one.
 */

const FACE = {
  north: 0,
  east: -Math.PI / 2,
  south: Math.PI,
  west: Math.PI / 2,
} as const;

export type CoreLayout = {
  /** The stair screen and the apartment door leaf. */
  joinery: BoxSpec[];
  /** A lit cove at the head of the walls. */
  coves: BoxSpec[];
  /** Glazed screen to the escape stair. */
  screens: BoxSpec[];
  /** The lobby rug. */
  soft: BoxSpec[];
  models: PropPlacement[];
};

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return { key, position: [mid(x), mid(y), mid(z)], scale: [span(x), span(y), span(z)] };
}

/** Matches the hollow cut through the service blade in `TowerGeometry`. */
const LOBBY_Z: Range = [-3.2, 3.2];
const CORE_WALL = 0.35;

export function createCore(plan: TowerPlan, levels: number): CoreLayout {
  const joinery: BoxSpec[] = [];
  const coves: BoxSpec[] = [];
  const screens: BoxSpec[] = [];
  const soft: BoxSpec[] = [];
  const models: PropPlacement[] = [];

  // The blade's own bounds, less its walls.
  const coreX: Range = [plan.towerX[0], plan.glazedX[0]];
  const inner: Range = [coreX[0] + CORE_WALL, coreX[1] - CORE_WALL];

  for (let level = 0; level < levels; level += 1) {
    const floorY = plan.levelY(level);
    const ceilingY = floorY + 3.0;
    const chunk = `core-${level}`;
    const put = (
      key: string,
      name: PropPlacement['name'],
      px: number,
      pz: number,
      facing: keyof typeof FACE,
    ) => {
      models.push({
        key: `${key}-${level}`,
        name,
        position: [px, floorY, pz],
        rotationY: FACE[facing],
        chunk,
      });
    };

    // Two lifts in the north blade, opening south into the lobby.
    put('core-lift-a', 'lift-doors', inner[0] + 1.3, LOBBY_Z[0] + 0.06, 'south');
    put('core-lift-b', 'lift-doors', inner[1] - 1.3, LOBBY_Z[0] + 0.06, 'south');

    // The escape stair behind a glazed screen in the south blade, so the
    // lobby reads as having somewhere else to go.
    screens.push(
      box(
        `core-stair-screen-${level}`,
        [inner[0] + 0.9, inner[1] - 0.9],
        [floorY, ceilingY - 0.35],
        [LOBBY_Z[1] - 0.06, LOBBY_Z[1]],
      ),
    );

    // The apartment door. A leaf on a wall, not a way through — see the note
    // at the top of this file.
    joinery.push(
      box(
        `core-apt-door-${level}`,
        [coreX[1] - CORE_WALL - 0.05, coreX[1] - CORE_WALL],
        [floorY, floorY + 2.25],
        [-0.55, 0.55],
      ),
    );

    soft.push(
      box(
        `core-rug-${level}`,
        [inner[0] + 0.7, inner[1] - 0.7],
        [floorY, floorY + 0.018],
        [LOBBY_Z[0] + 1.4, LOBBY_Z[1] - 1.4],
      ),
    );

    // A console against the west wall with something on it, and a light
    // either side of the lifts. A lift lobby with nothing in it reads as a
    // fire escape.
    //
    // The lights flank the lift doors rather than the apartment door. Put on
    // the apartment wall they sat behind every camera that would ever stand
    // here, which is a fitting nobody sees lighting a wall nobody looks at.
    put('core-console', 'nightstand', inner[0] + 0.45, 1.1, 'east');
    put('core-vessel', 'vessel-round', inner[0] + 0.45, 1.1, 'north');
    put('core-planter', 'planter-cyl', inner[0] + 0.55, -2.3, 'north');
    put('core-light-a', 'wall-light', inner[0] + 0.55, LOBBY_Z[0] + 0.05, 'south');
    put('core-light-b', 'wall-light', inner[1] - 0.55, LOBBY_Z[0] + 0.05, 'south');

    // A cove at the head of the two long walls. This room is in the middle of
    // a solid blade with no window in it, so unlike everywhere else in the
    // building it has no daylight at all and whatever light it has is the
    // light somebody specified.
    for (const [key, cx] of [
      ['w', [inner[0], inner[0] + 0.16]],
      ['e', [inner[1] - 0.16, inner[1]]],
    ] as [string, Range][]) {
      coves.push(
        box(
          `core-cove-${key}-${level}`,
          cx,
          [ceilingY - 0.24, ceilingY - 0.12],
          [LOBBY_Z[0] + 0.3, LOBBY_Z[1] - 0.3],
        ),
      );
    }
  }

  return { joinery, coves, screens, soft, models };
}
