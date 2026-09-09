import type { PropPlacement } from './SiteProps';
import type { BoxSpec, Range } from '../villa/VillaTypes';
import { APT_DOOR_HEIGHT, APT_DOOR_Z } from './TowerGeometry';
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
 * ## The front door
 *
 * It used to be a leaf painted on a solid wall, marked here as a placeholder,
 * because with the camera on rails nobody could ever try it. Once the lift
 * would take a visitor to any of fourteen floors, arriving in a sealed lobby
 * became the most obvious thing wrong with the building. The opening is cut
 * in `TowerGeometry` and lined here, and it lands in the hall between the
 * bedroom and the kitchen — which is where the plan already had circulation,
 * so nothing had to move to make room for it.
 *
 * How many flats share a floor and where each front door goes is still
 * `DAT-01`, the floor plans, which have to come from the client. One flat per
 * plate with its door off the lift lobby is an assumption, and a normal one.
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
/** Head height of the stair door, matching `createStair`. */
const STAIR_DOOR_HEIGHT = 2.2;

export function createCore(plan: TowerPlan, levels: number, stairDoorX: Range): CoreLayout {
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

    // The screen to the escape stair in the south blade. Split around the
    // stair door: the stair is real now and walked, so a screen across the
    // whole opening is a pane of glass in a doorway.
    const screenX: Range = [inner[0] + 0.9, inner[1] - 0.9];
    // The stair's own opening, not a guess at where it is.
    const doorX = stairDoorX;
    const screenZ: Range = [LOBBY_Z[1] - 0.06, LOBBY_Z[1]];
    const screenY: Range = [floorY, ceilingY - 0.35];
    screens.push(box(`core-stair-screen-w-${level}`, [screenX[0], doorX[0]], screenY, screenZ));
    screens.push(box(`core-stair-screen-e-${level}`, [doorX[1], screenX[1]], screenY, screenZ));
    screens.push(
      box(`core-stair-screen-t-${level}`, doorX, [floorY + STAIR_DOOR_HEIGHT, screenY[1]], screenZ),
    );

    // The front door, standing open against the wall inside the flat, and
    // the head over the opening.
    //
    // Open rather than shut, and hung on the apartment side: a walkthrough
    // that stops at a closed door is a walkthrough of a corridor. The leaf is
    // parked clear of the reveal on purpose — the collider gives thin, tall
    // volumes a wall's thickness so that a pane of glass can stop somebody,
    // and a leaf swung across the opening would be a 700mm plug in a 1200mm
    // doorway.
    joinery.push(
      box(
        `core-apt-leaf-${level}`,
        [coreX[1] - 0.05, coreX[1]],
        [floorY, floorY + APT_DOOR_HEIGHT],
        [APT_DOOR_Z[1] + 0.15, APT_DOOR_Z[1] + 1.25],
      ),
    );
    joinery.push(
      box(
        `core-apt-head-${level}`,
        [coreX[1] - CORE_WALL, coreX[1]],
        [floorY + APT_DOOR_HEIGHT, floorY + APT_DOOR_HEIGHT + 0.04],
        APT_DOOR_Z,
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
