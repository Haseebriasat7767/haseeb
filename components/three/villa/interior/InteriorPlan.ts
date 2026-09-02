import type { BoxSpec, Range, ShellSides, VillaLevels, VillaPlan, WallGap } from '../VillaTypes';
import { box } from '../SpecBuilders';

/**
 * How a room's floor is finished. Timber is used where a room is stood on
 * barefoot; honed stone everywhere else.
 */
export type FloorFinish = 'stone' | 'timber';

/** A habitable volume, resolved from the villa's own structure. */
export type Room = {
  id: string;
  label: string;
  level: 'ground' | 'upper';
  x: Range;
  z: Range;
  floorY: number;
  ceilingY: number;
  floor: FloorFinish;
  /** Plan centre, the anchor most furniture is placed against. */
  center: readonly [number, number];
};

/** Interior partitions are lighter than the structural shell. */
const PARTITION_THICKNESS = 0.16;

/**
 * Depth of the finished floor build-up over each structural slab. A room's
 * `floorY` is the level you actually stand on — the top of this build-up —
 * so furniture, rugs, and skirtings all sit on the finish rather than
 * sinking into it.
 */
export const FLOOR_BUILD_UP = 0.05;

/** Standard clear door height above finished floor. */
const DOOR_HEIGHT = 2.1;
/** Standard clear door width. */
const DOOR_WIDTH = 1.2;
/** Wide, frameless room-to-room openings in the principal rooms. */
const PORTAL_HEIGHT = 2.4;

function makeRoom(
  id: string,
  label: string,
  level: Room['level'],
  x: Range,
  z: Range,
  floorY: number,
  ceilingY: number,
  floor: FloorFinish,
): Room {
  return {
    id,
    label,
    level,
    x,
    z,
    floorY,
    ceilingY,
    floor,
    center: [(x[0] + x[1]) / 2, (z[0] + z[1]) / 2] as const,
  };
}

/** A door-sized void centred on `at`, along whichever axis the wall runs. */
function door(at: number, floorY: number, width = DOOR_WIDTH): WallGap {
  return { across: [at - width / 2, at + width / 2], y: [floorY, floorY + DOOR_HEIGHT] };
}

/** A wide architectural opening between two principal rooms. */
function portal(across: Range, floorY: number, height = PORTAL_HEIGHT): WallGap {
  return { across, y: [floorY, floorY + height] };
}

/**
 * A partition wall centred on a plan line, punched with its own doors. The
 * villa's structural `punchedWall` is not reused here because partitions are
 * thin, non-structural, and always full storey height — a single dedicated
 * builder keeps the room schedule below readable.
 */
function partition(
  key: string,
  axis: 'x' | 'z',
  at: number,
  across: Range,
  y: Range,
  doors: readonly WallGap[] = [],
): BoxSpec[] {
  const half = PARTITION_THICKNESS / 2;
  const thickness: Range = [at - half, at + half];
  const make = (a: Range, yy: Range, k: string): BoxSpec =>
    axis === 'x' ? box(k, thickness, yy, a) : box(k, a, yy, thickness);

  const sorted = [...doors].sort((a, b) => a.across[0] - b.across[0]);
  const parts: BoxSpec[] = [];
  let cursor = across[0];

  sorted.forEach((gap, index) => {
    if (gap.across[0] > cursor) parts.push(make([cursor, gap.across[0]], y, `${key}-p${index}`));
    if (gap.y[1] < y[1]) parts.push(make(gap.across, [gap.y[1], y[1]], `${key}-head${index}`));
    cursor = Math.max(cursor, gap.across[1]);
  });

  if (cursor < across[1]) parts.push(make([cursor, across[1]], y, `${key}-end`));
  return parts;
}

/**
 * The residence's room schedule and everything the enclosure needs to serve
 * it: which faces of each structural volume are omitted, where doors are
 * punched through the shell, and where the upper slab is voided for the
 * stair.
 *
 * Pure and deterministic, and derived entirely from the villa's own plan
 * lines and levels — not one coordinate here is authored independently of
 * the building. `createVillaLayout` calls it to hollow its masses, and
 * `createInteriorLayout` calls it again to furnish the result; both get the
 * same answer for the same villa.
 */
export function createInteriorPlan(plan: VillaPlan, levels: VillaLevels) {
  const t = plan.wallThickness;
  const { groundFloorTopY, upperFloorTopY } = levels;
  const groundY = levels.groundY + FLOOR_BUILD_UP;
  const upperFloorY = levels.upperFloorY + FLOOR_BUILD_UP;

  const gfY: Range = [groundY, groundFloorTopY];
  const upY: Range = [upperFloorY, upperFloorTopY];

  const halfW = plan.halfWidth;
  const halfD = plan.halfDepth;
  const rearZ = -halfD;

  // ── Rear service bar: the ground floor's private band ─────────────────
  const barZ: Range = [rearZ + t, plan.rearBarFrontZ - t];
  const barMidZ = (barZ[0] + barZ[1]) / 2;
  const guestBathX = plan.westWingEastX - 2.4;
  const kitchenEastX = plan.eastWingWestX - 5;
  const pantryEastX = plan.eastWingWestX - 0.6;
  const barWestX = -halfW + t;
  const barEastX = halfW - t;

  // ── Upper floor divisions ────────────────────────────────────────────
  const masterFrontZ = plan.upperWestFrontZ - 0.3;
  const masterBackZ = plan.upperWestFrontZ - 6;
  const upperBarZ = rearZ + t;
  const bedroomFrontZ = -5.5;
  const hallFrontZ = -3.5;
  const masterEastX = plan.entranceX[0] - 0.3;
  const masterBathEastX = -11.4;
  const bedroom2EastX = 3;
  const bath2EastX = 6.5;
  const upperWestX = plan.entranceX[1] + 0.3;
  const upperEastX = halfW - t;

  const rooms = {
    // Ground floor — arrival, principal rooms, service band, guest suite.
    foyer: makeRoom(
      'foyer',
      'Entrance foyer',
      'ground',
      [plan.westWingEastX, plan.entranceX[1]],
      [plan.rearBarFrontZ, plan.entranceBackZ],
      groundY,
      upperFloorTopY,
      'stone',
    ),
    living: makeRoom(
      'living',
      'Living room',
      'ground',
      [2.5, plan.eastWingWestX],
      [plan.rearBarFrontZ, plan.livingGlassZ],
      groundY,
      groundFloorTopY,
      'stone',
    ),
    dining: makeRoom(
      'dining',
      'Dining room',
      'ground',
      [plan.entranceX[1], 2.5],
      [plan.rearBarFrontZ, plan.livingGlassZ],
      groundY,
      groundFloorTopY,
      'stone',
    ),
    kitchen: makeRoom(
      'kitchen',
      'Kitchen',
      'ground',
      [plan.entranceX[1], kitchenEastX],
      barZ,
      groundY,
      groundFloorTopY,
      'stone',
    ),
    pantry: makeRoom(
      'pantry',
      'Pantry',
      'ground',
      [kitchenEastX, pantryEastX],
      barZ,
      groundY,
      groundFloorTopY,
      'stone',
    ),
    utility: makeRoom(
      'utility',
      'Utility',
      'ground',
      [pantryEastX, barEastX],
      barZ,
      groundY,
      groundFloorTopY,
      'stone',
    ),
    stairHall: makeRoom(
      'stairHall',
      'Stair hall',
      'ground',
      plan.entranceX,
      barZ,
      groundY,
      groundFloorTopY,
      'stone',
    ),
    guestBath: makeRoom(
      'guestBath',
      'Guest bathroom',
      'ground',
      [guestBathX, plan.entranceX[0]],
      barZ,
      groundY,
      groundFloorTopY,
      'stone',
    ),
    guestBedroom: makeRoom(
      'guestBedroom',
      'Guest bedroom',
      'ground',
      [barWestX, guestBathX],
      barZ,
      groundY,
      groundFloorTopY,
      'timber',
    ),
    study: makeRoom(
      'study',
      'Study',
      'ground',
      [barWestX, plan.westWingEastX - t],
      [plan.rearBarFrontZ + t, plan.frontZ - t],
      groundY,
      groundFloorTopY,
      'timber',
    ),
    media: makeRoom(
      'media',
      'Media room',
      'ground',
      [plan.eastWingWestX + t, barEastX],
      [plan.rearBarFrontZ + t, plan.frontZ - t],
      groundY,
      groundFloorTopY,
      'timber',
    ),

    // Upper floor — master suite, secondary bedrooms, upper living.
    masterBedroom: makeRoom(
      'masterBedroom',
      'Master bedroom',
      'upper',
      [barWestX, masterEastX],
      [masterBackZ, masterFrontZ],
      upperFloorY,
      upperFloorTopY,
      'timber',
    ),
    masterBath: makeRoom(
      'masterBath',
      'Master bathroom',
      'upper',
      [barWestX, masterBathEastX],
      [upperBarZ, masterBackZ],
      upperFloorY,
      upperFloorTopY,
      'stone',
    ),
    dressing: makeRoom(
      'dressing',
      'Dressing room',
      'upper',
      [masterBathEastX, masterEastX],
      [upperBarZ, masterBackZ],
      upperFloorY,
      upperFloorTopY,
      'timber',
    ),
    landing: makeRoom(
      'landing',
      'Upper landing',
      'upper',
      [plan.entranceX[0] + t, plan.entranceX[1] - t],
      [upperBarZ, plan.entranceVoidBackZ],
      upperFloorY,
      upperFloorTopY,
      'stone',
    ),
    bedroom2: makeRoom(
      'bedroom2',
      'Bedroom two',
      'upper',
      [upperWestX, bedroom2EastX],
      [upperBarZ, bedroomFrontZ],
      upperFloorY,
      upperFloorTopY,
      'timber',
    ),
    bath2: makeRoom(
      'bath2',
      'Bathroom two',
      'upper',
      [bedroom2EastX, bath2EastX],
      [upperBarZ, bedroomFrontZ],
      upperFloorY,
      upperFloorTopY,
      'stone',
    ),
    bedroom3: makeRoom(
      'bedroom3',
      'Bedroom three',
      'upper',
      [bath2EastX, upperEastX],
      [upperBarZ, bedroomFrontZ],
      upperFloorY,
      upperFloorTopY,
      'timber',
    ),
    upperHall: makeRoom(
      'upperHall',
      'Upper hall',
      'upper',
      [upperWestX, upperEastX],
      [bedroomFrontZ, hallFrontZ],
      upperFloorY,
      upperFloorTopY,
      'stone',
    ),
    upperLounge: makeRoom(
      'upperLounge',
      'Upper lounge',
      'upper',
      [upperWestX, plan.cantileverAxisX[0]],
      [hallFrontZ, plan.upperFrontZ - t],
      upperFloorY,
      upperFloorTopY,
      'timber',
    ),
    library: makeRoom(
      'library',
      'Library',
      'upper',
      [plan.cantileverAxisX[0], upperEastX],
      [hallFrontZ, plan.cantileverZ[1] - t],
      upperFloorY,
      upperFloorTopY,
      'timber',
    ),
  } as const;

  // ── Partitions ────────────────────────────────────────────────────────
  const partitions: BoxSpec[] = [
    ...partition('part-guest-bath', 'x', guestBathX, barZ, gfY, [door(barMidZ - 2.5, groundY)]),
    ...partition('part-bath-stair', 'x', plan.entranceX[0], barZ, gfY),
    ...partition('part-stair-kitchen', 'x', plan.entranceX[1], barZ, gfY, [
      door(barMidZ - 1.1, groundY),
    ]),
    ...partition('part-kitchen-pantry', 'x', kitchenEastX, barZ, gfY, [
      door(barMidZ - 0.3, groundY),
    ]),
    ...partition('part-pantry-utility', 'x', pantryEastX, barZ, gfY, [
      door(barMidZ - 0.3, groundY),
    ]),

    ...partition('part-master', 'z', masterBackZ, [barWestX, masterEastX], upY, [
      door(-13, upperFloorY),
      door(-10, upperFloorY),
    ]),
    ...partition('part-master-bath', 'x', masterBathEastX, [upperBarZ, masterBackZ], upY),
    ...partition('part-bedrooms', 'z', bedroomFrontZ, [upperWestX, upperEastX], upY, [
      door(-1, upperFloorY),
      door(4.9, upperFloorY),
      door(10.2, upperFloorY),
    ]),
    ...partition('part-bed2-bath2', 'x', bedroom2EastX, [upperBarZ, bedroomFrontZ], upY),
    ...partition('part-bath2-bed3', 'x', bath2EastX, [upperBarZ, bedroomFrontZ], upY),
    ...partition(
      'part-lounge-library',
      'x',
      plan.cantileverAxisX[0],
      [hallFrontZ, plan.upperFrontZ - t],
      upY,
      [portal([-1.6, 0.8], upperFloorY, 2.75)],
    ),
  ];

  // ── Enclosure: which shell faces open, and where doors pierce them ─────
  const shellGaps = {
    rearBar: {
      south: [
        door(-12.9, groundY),
        portal([plan.entranceX[0] + 0.3, plan.entranceX[1] - 0.3], groundY, 2.75),
        portal([-3.4, -0.6], groundY, 2.75),
      ],
    } satisfies ShellSides,
    westWing: {
      north: [door(-12.9, groundY)],
      east: [door(1, groundY)],
    } satisfies ShellSides,
    eastWing: {
      west: [portal([-3.4, -2.2], groundY, 2.4)],
    } satisfies ShellSides,
    upWest: {
      east: [door(-5.9, upperFloorY)],
    } satisfies ShellSides,
    upLink: {
      west: [door(-5.9, upperFloorY)],
      east: [portal([bedroomFrontZ, hallFrontZ], upperFloorY, 2.45)],
      // The link's front edge is the double-height entrance void; a glass
      // balustrade replaces the wall so the foyer reads through both storeys.
      south: false,
    } satisfies ShellSides,
    upEast: {
      west: [portal([bedroomFrontZ, hallFrontZ], upperFloorY, 2.45)],
      // The cantilever is the same room continuing forward, not a next room.
      south: [{ across: plan.cantileverAxisX, y: upY }],
    } satisfies ShellSides,
    upCantilever: { north: false } satisfies ShellSides,
  };

  // Void in the upper link slab that gives the stair its headroom and its
  // arrival edge. Sized from the flights below, not chosen by eye.
  const stairwellZ: Range = [-8.5, -5.2];

  return { rooms, partitions, shellGaps, stairwellZ, barZ, barMidZ, hallFrontZ, bedroomFrontZ };
}

export type InteriorPlanResult = ReturnType<typeof createInteriorPlan>;
export type InteriorRooms = InteriorPlanResult['rooms'];
export type RoomId = keyof InteriorRooms;
