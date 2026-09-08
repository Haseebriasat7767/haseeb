import type { PropPlacement } from './SiteProps';
import type { BoxSpec, Range } from '../villa/VillaTypes';
import type { TowerPlan } from './TowerTypes';

/**
 * The amenity floor — gym, spa and residents' lounge — at the base of the
 * tower, opening onto the pool deck.
 *
 * ## Why this level and not another
 *
 * The tower's lowest residential level sits at 25 m, which is the podium roof,
 * which is the deck. So it is already the one floor in the building with an
 * outdoor room attached, and putting apartments on it would waste that on four
 * households while making the deck a place residents can only reach by lift
 * from somewhere else. Every building of this type does the same thing for the
 * same reason.
 *
 * ## The plan
 *
 * Three rooms across a 29 by 22 metre plate, divided the way the views divide
 * it. The gym and the lounge take the ocean end because that is where the
 * glazing and the deck are; the spa takes the landward third against the
 * service core, because a treatment room wants no daylight and no view, and
 * because it is the only part of the programme that needs plumbing near the
 * risers.
 */

const FACE = {
  north: 0,
  east: -Math.PI / 2,
  south: Math.PI,
  west: Math.PI / 2,
} as const;

export type AmenityLayout = {
  /** Partitions, in plaster. */
  walls: BoxSpec[];
  /** Wet-room linings — the spa and the changing rooms. */
  tiling: BoxSpec[];
  /** Mirrors on the gym wall, and the glass to the treatment bays. */
  mirrors: BoxSpec[];
  /** The plunge pool shell, and its water. */
  plungeShell: BoxSpec[];
  plungeWater: BoxSpec[];
  /** Exercise mats and the rug in the lounge. */
  soft: BoxSpec[];
  /** Timber: the sauna, benches, the reception front. */
  joinery: BoxSpec[];
  models: PropPlacement[];
};

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return { key, position: [mid(x), mid(y), mid(z)], scale: [span(x), span(y), span(z)] };
}

export function createAmenity(plan: TowerPlan): AmenityLayout {
  const walls: BoxSpec[] = [];
  const tiling: BoxSpec[] = [];
  const mirrors: BoxSpec[] = [];
  const plungeShell: BoxSpec[] = [];
  const plungeWater: BoxSpec[] = [];
  const soft: BoxSpec[] = [];
  const joinery: BoxSpec[] = [];
  const models: PropPlacement[] = [];

  const floorY = plan.levelY(0);
  const ceilingY = floorY + 3.0;
  const x = plan.glazedX;
  const z = plan.towerZ;

  const put = (
    key: string,
    name: PropPlacement['name'],
    px: number,
    pz: number,
    facing: keyof typeof FACE,
    chunk: string,
  ) => {
    models.push({ key, name, position: [px, floorY, pz], rotationY: FACE[facing], chunk });
  };

  // ── Division ──────────────────────────────────────────────────────────
  // The spa is walled off at x = spaLine; the gym and lounge share the ocean
  // end and are separated only by the circulation between them, because a
  // wall there would put both of them in a corridor.
  const spaLine = x[0] + 11.5;
  const splitZ = 0;

  walls.push(box('amn-wall-spa', [spaLine, spaLine + 0.22], [floorY, ceilingY], z));
  // A gap in it, which is the way in.
  walls.push(
    box(
      'amn-wall-gym',
      [spaLine + 0.22, x[1] - 9.5],
      [floorY, ceilingY],
      [splitZ - 0.11, splitZ + 0.11],
    ),
  );

  // ── Gym: the ocean end, north side ────────────────────────────────────
  const gymZ: Range = [z[0] + 0.4, splitZ - 0.4];
  // Mirrored back wall. A gym without one reads as a room with equipment in
  // it; the mirror is what makes it a gym, and it doubles the apparent depth
  // of a space that is only ten metres deep.
  mirrors.push(
    box('amn-gym-mirror', [spaLine + 0.22, spaLine + 0.28], [floorY + 0.15, ceilingY - 0.35], gymZ),
  );
  soft.push(
    box(
      'amn-gym-mat',
      [x[1] - 6.6, x[1] - 2.2],
      [floorY, floorY + 0.03],
      [gymZ[0] + 1.2, gymZ[0] + 5.0],
    ),
  );

  // Treadmills facing the glass. Nobody runs facing a wall when the
  // alternative is the Atlantic.
  for (let i = 0; i < 4; i += 1) {
    put(`amn-tread-${i}`, 'treadmill', x[1] - 2.0, gymZ[1] - 1.4 - i * 1.35, 'east', 'amenity-gym');
  }
  put('amn-rack-a', 'gym-rack', spaLine + 1.4, gymZ[0] + 1.6, 'east', 'amenity-gym');
  put('amn-rack-b', 'gym-rack', spaLine + 1.4, gymZ[0] + 3.4, 'east', 'amenity-gym');
  put('amn-bench-a', 'gym-bench', spaLine + 3.6, gymZ[0] + 2.0, 'north', 'amenity-gym');
  put('amn-bench-b', 'gym-bench', spaLine + 3.6, gymZ[0] + 4.2, 'north', 'amenity-gym');
  put('amn-gym-person', 'person-standing', x[1] - 3.6, gymZ[1] - 2.2, 'west', 'amenity-gym');

  // ── Residents' lounge: the ocean end, south side ──────────────────────
  const loungeZ: Range = [splitZ + 0.4, z[1] - 0.4];
  soft.push(
    box(
      'amn-lounge-rug',
      [x[1] - 8.4, x[1] - 1.6],
      [floorY, floorY + 0.022],
      [loungeZ[0] + 1.4, loungeZ[0] + 7.2],
    ),
  );

  put('amn-sofa-a', 'sofa-3seat', x[1] - 6.4, loungeZ[0] + 2.6, 'east', 'amenity-lounge');
  put('amn-sofa-b', 'sofa-3seat', x[1] - 2.6, loungeZ[0] + 5.6, 'west', 'amenity-lounge');
  put('amn-chair-a', 'lounge-chair', x[1] - 2.8, loungeZ[0] + 2.2, 'west', 'amenity-lounge');
  put('amn-chair-b', 'lounge-chair', x[1] - 5.6, loungeZ[0] + 6.4, 'east', 'amenity-lounge');
  put('amn-table', 'organic-table-lg', x[1] - 4.6, loungeZ[0] + 4.2, 'north', 'amenity-lounge');
  put('amn-drum', 'side-drum', x[1] - 7.4, loungeZ[0] + 5.0, 'north', 'amenity-lounge');
  put('amn-lamp', 'floor-lamp', x[1] - 8.0, loungeZ[0] + 1.6, 'north', 'amenity-lounge');
  put('amn-trough', 'planter-trough', spaLine + 1.6, loungeZ[0] + 3.0, 'east', 'amenity-lounge');
  put('amn-vessel', 'vessel-tall', spaLine + 1.6, loungeZ[0] + 6.4, 'north', 'amenity-lounge');
  put('amn-lounge-person', 'person-seated', x[1] - 6.2, loungeZ[0] + 2.4, 'east', 'amenity-lounge');

  // ── Spa: the landward third ───────────────────────────────────────────
  //
  // Planned around a corridor rather than around the rooms. The first cut put
  // the bays, the lockers and the plunge pool all in the same strip against
  // the core, which left nowhere to walk and stood the camera in the pool.
  // A wet zone is a spine with rooms off it, and the spine comes first.
  const corridorX: Range = [x[0] + 5.5, x[0] + 8.0];
  const bayX: Range = [x[0] + 0.4, corridorX[0]];
  const wetX: Range = [corridorX[1], spaLine - 0.5];

  tiling.push(box('amn-spa-floor', [x[0], spaLine], [floorY - 0.02, floorY + 0.01], z));

  // Three treatment bays down the west side, opening onto the corridor.
  for (let i = 0; i < 3; i += 1) {
    const bz = z[0] + 1.6 + i * 5.4;
    const bay: Range = [bz, bz + 4.6];
    walls.push(box(`amn-bay-${i}`, bayX, [floorY, ceilingY], [bay[1], bay[1] + 0.14]));
    put(`amn-treat-${i}`, 'treatment-table', mid(bayX) + 0.5, mid(bay), 'north', 'amenity-spa');
    put(`amn-treat-drum-${i}`, 'side-drum', bayX[0] + 0.9, bay[0] + 0.9, 'north', 'amenity-spa');
  }

  // Changing, on the corridor's other side at the entry end: lockers facing
  // into the room, which is what the +Y authoring of that piece is for.
  put('amn-locker-a', 'locker-bank', mid(wetX) + 0.6, z[0] + 2.4, 'west', 'amenity-spa');
  put('amn-locker-b', 'locker-bank', mid(wetX) + 0.6, z[0] + 5.2, 'west', 'amenity-spa');

  // The plunge pool. Small, deep and cold — the counterpart to the warm pool
  // on the deck outside, and the reason the spa is tiled rather than
  // plastered.
  //
  // Raised rather than sunk. Sunk, the whole thing is inside the floor slab
  // and the tiled floor laid over the top of it hides everything but two
  // centimetres of rim — which is exactly what the first version did. A
  // plunge with an upstand you step over reads as a pool from any angle and
  // needs no hole cut in a structural plate to do it.
  const poolX: Range = [wetX[0] + 0.4, wetX[1] - 0.4];
  const poolZ: Range = [z[1] - 9.4, z[1] - 5.0];
  //
  // Built as a vessel — four upstands and a floor — not as a solid block with
  // water laid on it. A solid shell taller than its own water level simply
  // contains the water and hides it, which is what the first version did.
  const rim = floorY + 0.46;
  const t = 0.16;
  for (const [key, bx, bz] of [
    ['n', poolX, [poolZ[0], poolZ[0] + t]],
    ['s', poolX, [poolZ[1] - t, poolZ[1]]],
    ['w', [poolX[0], poolX[0] + t], [poolZ[0] + t, poolZ[1] - t]],
    ['e', [poolX[1] - t, poolX[1]], [poolZ[0] + t, poolZ[1] - t]],
  ] as [string, Range, Range][]) {
    plungeShell.push(box(`amn-plunge-${key}`, bx, [floorY, rim], bz));
  }
  plungeShell.push(
    box(
      'amn-plunge-base',
      [poolX[0] + t, poolX[1] - t],
      [floorY, floorY + 0.06],
      [poolZ[0] + t, poolZ[1] - t],
    ),
  );
  plungeWater.push(
    box(
      'amn-plunge-water',
      [poolX[0] + t, poolX[1] - t],
      [rim - 0.14, rim - 0.08],
      [poolZ[0] + t, poolZ[1] - t],
    ),
  );
  // A tiled coping around it, so the upstand reads as built rather than as a
  // tank standing on the floor.
  tiling.push(
    box(
      'amn-plunge-coping',
      [poolX[0] - 0.5, poolX[1] + 0.5],
      [floorY + 0.01, floorY + 0.05],
      [poolZ[0] - 0.5, poolZ[1] + 0.5],
    ),
  );

  // The sauna: a cedar box with a glazed door, at the end of the corridor.
  const saunaX: Range = [wetX[0], wetX[1]];
  const saunaZ: Range = [z[1] - 4.0, z[1] - 0.6];
  joinery.push(box('amn-sauna-n', saunaX, [floorY, ceilingY - 0.4], [saunaZ[0], saunaZ[0] + 0.16]));
  joinery.push(box('amn-sauna-s', saunaX, [floorY, ceilingY - 0.4], [saunaZ[1] - 0.16, saunaZ[1]]));
  joinery.push(box('amn-sauna-e', [saunaX[1] - 0.16, saunaX[1]], [floorY, ceilingY - 0.4], saunaZ));
  joinery.push(box('amn-sauna-roof', saunaX, [ceilingY - 0.4, ceilingY - 0.26], saunaZ));
  joinery.push(
    box(
      'amn-sauna-bench',
      [saunaX[0] + 0.3, saunaX[1] - 0.3],
      [floorY + 0.42, floorY + 0.5],
      [saunaZ[1] - 0.9, saunaZ[1] - 0.3],
    ),
  );
  // The door faces the corridor, which is the only side anybody approaches
  // it from.
  mirrors.push(
    box(
      'amn-sauna-door',
      [saunaX[0], saunaX[0] + 0.06],
      [floorY, ceilingY - 0.55],
      [saunaZ[0] + 0.7, saunaZ[1] - 0.7],
    ),
  );

  // Reception at the lift lobby, where the floor is arrived at.
  put('amn-desk', 'retail-counter', spaLine + 2.4, splitZ + 0.1, 'east', 'amenity-lounge');

  return { walls, tiling, mirrors, plungeShell, plungeWater, soft, joinery, models };
}
