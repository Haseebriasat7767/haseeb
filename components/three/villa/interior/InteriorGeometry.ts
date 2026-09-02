import type { BoxSpec, DetailTier, Range, VillaLevels, VillaPlan } from '../VillaTypes';
import { box, mid, span, stairRun } from '../SpecBuilders';
import {
  createArmchair,
  createBalustrade,
  createBathtub,
  createBed,
  createBuiltIn,
  createCoffeeTable,
  createConsole,
  createCounterRun,
  createCove,
  createDesk,
  createDiningSet,
  createFireplace,
  createFloorLamp,
  createIsland,
  createMediaUnit,
  createNiche,
  createNightstand,
  createPendant,
  createRug,
  createShelving,
  createShower,
  createSideTable,
  createSofa,
  createVanity,
  createWC,
  emptyParts,
} from './Furniture';
import { createInteriorPlan, FLOOR_BUILD_UP, type Room } from './InteriorPlan';
import type { InteriorConfig, InteriorLayout, InteriorLight } from './InteriorTypes';

/** Default interior dimensions, in metres. */
export const INTERIOR_CONFIG: InteriorConfig = {
  floorDepth: 0.05,
  ceilingDepth: 0.06,
  balustradeHeight: 1.05,
  stairRisersPerFlight: 9,
  stairGoing: 0.3,
  stairFlightWidth: 1.2,
  pendantDrop: 2.1,
  wallClearance: 0.12,
};

/**
 * What thins out on weaker GPUs. The architecture — floors, ceilings,
 * partitions, built-ins, the stair — is identical at every tier, because a
 * room with no walls is not a cheaper room, it is a broken one. Only
 * repeated and decorative elements scale, plus the number of fill lights,
 * which is the one interior feature with a real per-fragment cost. On the
 * low tier none are mounted at all and the emissive fixtures carry the
 * read on their own.
 */
const DETAIL: Record<
  DetailTier,
  { seatDensity: number; accessories: boolean; shelves: number; lights: number }
> = {
  low: { seatDensity: 0.5, accessories: false, shelves: 3, lights: 0 },
  medium: { seatDensity: 0.75, accessories: true, shelves: 4, lights: 3 },
  high: { seatDensity: 1, accessories: true, shelves: 5, lights: 7 },
};

/** A range inset equally from both ends. */
function inset(r: Range, by: number): Range {
  return [r[0] + by, r[1] - by];
}

/** A band of `depth` taken off one end of a range. */
function band(r: Range, from: 'start' | 'end', depth: number): Range {
  return from === 'start' ? [r[0], r[0] + depth] : [r[1] - depth, r[1]];
}

/**
 * Resolves the residence's interiors: floor and ceiling finishes, the
 * partitions that divide each structural volume into rooms, the connecting
 * stair, and the furniture in every room.
 *
 * Pure and deterministic, exactly like `createVillaLayout`,
 * `createSiteLayout`, and `createLandscapeLayout`. Every coordinate is
 * derived from the villa's own plan lines and levels — no dimension of the
 * building is restated here, and nothing is placed by eye in world space.
 * There is no randomness of any kind: the same villa always furnishes
 * identically.
 */
export function createInteriorLayout(
  config: InteriorConfig,
  plan: VillaPlan,
  levels: VillaLevels,
  detail: DetailTier = 'high',
): InteriorLayout {
  const tier = DETAIL[detail];
  const schedule = createInteriorPlan(plan, levels);
  const { rooms, stairwellZ } = schedule;
  const clear = config.wallClearance;

  const parts = emptyParts();
  const floorsStone: BoxSpec[] = [];
  const floorsTimber: BoxSpec[] = [];
  const ceilings: BoxSpec[] = [];
  const panelling: BoxSpec[] = [];

  const roomList = Object.values(rooms) as Room[];

  // ── Finishes ──────────────────────────────────────────────────────────
  // The stair hall's ceiling is the void the stair rises through, and the
  // foyer's is the laylight below; both are handled separately.
  const noCeiling = new Set(['stairHall', 'foyer']);

  roomList.forEach((room) => {
    const target = room.floor === 'timber' ? floorsTimber : floorsStone;
    const floorY: Range = [room.floorY - config.floorDepth, room.floorY];

    if (room.id === 'landing') {
      // The landing's slab is voided for the stair, so its finish is too.
      target.push(box(`${room.id}-floor-rear`, room.x, floorY, [room.z[0], stairwellZ[0]]));
      target.push(box(`${room.id}-floor-front`, room.x, floorY, [stairwellZ[1], room.z[1]]));
    } else {
      target.push(box(`${room.id}-floor`, room.x, floorY, room.z));
    }

    if (noCeiling.has(room.id)) return;
    ceilings.push(
      box(
        `${room.id}-ceiling`,
        room.x,
        [room.ceilingY - config.ceilingDepth, room.ceilingY],
        room.z,
      ),
    );
  });

  // ── The connecting stair ──────────────────────────────────────────────
  // A dog-leg in the stair hall, sized from the storey height rather than
  // drawn to fit: two equal flights either side of a half-landing, with the
  // slab above voided over exactly the length that needs headroom.
  const risers = config.stairRisersPerFlight;
  const going = config.stairGoing;
  const flight = config.stairFlightWidth;
  // Both ends of the stair meet finished floor, not structural slab.
  const stairBaseY = levels.groundY + FLOOR_BUILD_UP;
  const stairTopY = levels.upperFloorY + FLOOR_BUILD_UP;
  const midLandingY = (stairBaseY + stairTopY) / 2;

  const hall = rooms.stairHall;
  const flightAX: Range = [hall.x[0] + 0.05, hall.x[0] + 0.05 + flight];
  const flightBX: Range = [flightAX[1], flightAX[1] + flight];
  const flightATopZ = hall.z[1] - 0.3 - risers * going;
  const landingZ: Range = [flightATopZ - 0.9, flightATopZ];
  const flightBTopZ = landingZ[0] + risers * going;

  const stairs: BoxSpec[] = [
    ...stairRun(
      'stair-flight-a',
      'z',
      flightAX,
      flightATopZ,
      1,
      risers,
      going,
      midLandingY,
      stairBaseY,
      stairBaseY,
    ),
    box('stair-half-landing', [flightAX[0], flightBX[1]], [stairBaseY, midLandingY], landingZ),
    ...stairRun(
      'stair-flight-b',
      'z',
      flightBX,
      flightBTopZ,
      -1,
      risers,
      going,
      stairTopY,
      midLandingY,
      midLandingY,
    ),
  ];

  // Balustrades guard every edge the stair opens up: the far end of the
  // stairwell, the two returns either side of the arrival, and the
  // double-height foyer void the landing overlooks.
  const guards: { key: string; at: number; run: Range }[] = [
    { key: 'landing-rail-rear', at: stairwellZ[0], run: plan.entranceX },
    { key: 'landing-rail-west', at: stairwellZ[1], run: [plan.entranceX[0], flightBX[0]] },
    { key: 'landing-rail-east', at: stairwellZ[1], run: [flightBX[1], plan.entranceX[1]] },
    { key: 'landing-rail-void', at: plan.entranceVoidBackZ, run: plan.entranceX },
  ];
  guards.forEach(({ key, at, run }) => {
    createBalustrade(parts, key, 'z', at, run, stairTopY, config.balustradeHeight);
  });

  // ── The foyer laylight ────────────────────────────────────────────────
  // The two-storey entrance slot has no floor plate above it, so the entry
  // is roofed in glass at parapet level: the foyer becomes the daylit heart
  // of the plan instead of an unroofed slot.
  const laylightX = plan.entranceX;
  const laylightZ: Range = [plan.entranceVoidBackZ, plan.entranceBackZ];
  const laylightY: Range = [levels.upperFloorTopY + 0.08, levels.upperFloorTopY + 0.14];
  const laylight = { frame: [] as BoxSpec[], glass: [] as BoxSpec[] };

  laylight.glass.push(box('laylight-glass', laylightX, laylightY, laylightZ));
  laylight.frame.push(
    box(
      'laylight-kerb-w',
      band(laylightX, 'start', 0.12),
      [laylightY[0], laylightY[1] + 0.1],
      laylightZ,
    ),
    box(
      'laylight-kerb-e',
      band(laylightX, 'end', 0.12),
      [laylightY[0], laylightY[1] + 0.1],
      laylightZ,
    ),
    box(
      'laylight-kerb-n',
      laylightX,
      [laylightY[0], laylightY[1] + 0.1],
      band(laylightZ, 'start', 0.12),
    ),
    box(
      'laylight-kerb-s',
      laylightX,
      [laylightY[0], laylightY[1] + 0.1],
      band(laylightZ, 'end', 0.12),
    ),
  );
  const bars = 5;
  for (let i = 1; i < bars; i += 1) {
    const at = laylightZ[0] + (span(laylightZ) * i) / bars;
    laylight.frame.push(
      box(
        `laylight-bar-${i}`,
        laylightX,
        [laylightY[0] - 0.01, laylightY[1] + 0.02],
        [at - 0.035, at + 0.035],
      ),
    );
  }

  // ── Ground floor: living ──────────────────────────────────────────────
  const living = rooms.living;
  const livingRearZ = living.z[0];
  createRug(parts, 'living-rug', mid(living.x), mid(living.z) + 0.7, living.floorY, 5.2, 4.2);
  createSofa(
    parts,
    'living-sofa',
    mid(living.x),
    living.z[0] + 1.6,
    living.floorY,
    3.4,
    1.05,
    'south',
  );
  createCoffeeTable(
    parts,
    'living-table',
    mid(living.x),
    mid(living.z) + 0.9,
    living.floorY,
    1.7,
    0.9,
  );
  createArmchair(
    parts,
    'living-chair-a',
    living.x[0] + 1.5,
    living.z[1] - 1.1,
    living.floorY,
    'north',
  );
  createArmchair(
    parts,
    'living-chair-b',
    living.x[0] + 3.4,
    living.z[1] - 1.1,
    living.floorY,
    'north',
  );
  // The chimney breast projects from the back wall, so the panelling above
  // stops beside it instead of running flush across.
  const fireplaceX: Range = [living.x[1] - 3.4, living.x[1] - 0.6];
  createFireplace(
    parts,
    'living-fireplace',
    fireplaceX,
    [livingRearZ, livingRearZ + 0.34],
    living.floorY,
    living.ceilingY - living.floorY - 0.5,
  );
  createNiche(
    parts,
    'living-niche',
    [living.x[0] + 0.6, living.x[0] + 2.8],
    [livingRearZ, livingRearZ + 0.14],
    [living.floorY + 1.0, living.floorY + 2.4],
  );
  createCove(
    parts,
    'living-cove',
    inset(living.x, 0.5),
    [livingRearZ + 0.02, livingRearZ + 0.2],
    living.ceilingY - config.ceilingDepth,
  );
  if (tier.accessories) {
    createFloorLamp(parts, 'living-lamp', living.x[0] + 0.7, living.z[1] - 1.4, living.floorY);
    createSideTable(parts, 'living-side', living.x[1] - 0.9, living.z[0] + 1.9, living.floorY);
  }

  // ── Ground floor: dining ──────────────────────────────────────────────
  const dining = rooms.dining;
  const diningCx = mid(dining.x);
  createRug(parts, 'dining-rug', diningCx, mid(dining.z) + 0.4, dining.floorY, 3.6, 2.6);
  createDiningSet(
    parts,
    'dining-set',
    diningCx,
    mid(dining.z) + 0.4,
    dining.floorY,
    2.8,
    1.15,
    tier.seatDensity,
  );
  // Held east of the kitchen opening so it backs onto solid wall rather
  // than standing in the doorway between the two rooms.
  createConsole(
    parts,
    'dining-sideboard',
    dining.x[1] - 1.2,
    dining.z[0] + 0.24,
    dining.floorY,
    2.0,
    'south',
  );
  for (let i = 0; i < 3; i += 1) {
    createPendant(
      parts,
      `dining-pendant-${i}`,
      diningCx - 0.9 + i * 0.9,
      mid(dining.z) + 0.4,
      dining.ceilingY - config.ceilingDepth,
      config.pendantDrop,
      0.17,
    );
  }

  // ── Ground floor: foyer ───────────────────────────────────────────────
  const foyer = rooms.foyer;
  createConsole(
    parts,
    'foyer-console',
    mid(foyer.x),
    foyer.z[1] - 1.4,
    foyer.floorY,
    1.8,
    'east',
    0.42,
  );
  createRug(parts, 'foyer-rug', mid(foyer.x), mid(foyer.z), foyer.floorY, 2.2, 3.4);
  createPendant(parts, 'foyer-pendant', mid(foyer.x), mid(foyer.z), laylightY[0], 3.4, 0.24);

  // ── Ground floor: kitchen, pantry, utility ────────────────────────────
  const kitchen = rooms.kitchen;
  const kitchenBack = band(kitchen.z, 'start', 0.64);
  createBuiltIn(
    parts,
    'kitchen-tall',
    [kitchen.x[0] + 0.1, kitchen.x[0] + 1.5],
    band(kitchen.z, 'start', 0.7),
    [kitchen.floorY, kitchen.floorY + 2.4],
  );
  createCounterRun(
    parts,
    'kitchen-run',
    [kitchen.x[0] + 1.6, kitchen.x[1] - 0.3],
    kitchenBack,
    kitchen.floorY,
    {
      upper: true,
      upperFrom: kitchen.floorY + 1.55,
    },
  );
  const islandX: Range = [mid(kitchen.x) - 2.0, mid(kitchen.x) + 2.0];
  const islandZ: Range = [mid(kitchen.z) - 0.55, mid(kitchen.z) + 0.55];
  createIsland(parts, 'kitchen-island', islandX, islandZ, kitchen.floorY, tier.accessories ? 3 : 2);
  for (let i = 0; i < 2; i += 1) {
    createPendant(
      parts,
      `kitchen-pendant-${i}`,
      mid(islandX) - 0.8 + i * 1.6,
      mid(islandZ),
      kitchen.ceilingY - config.ceilingDepth,
      config.pendantDrop - 0.2,
      0.15,
    );
  }

  const pantry = rooms.pantry;
  createShelving(
    parts,
    'pantry-shelving',
    inset(pantry.x, 0.2),
    band(pantry.z, 'start', 0.4),
    [pantry.floorY + 0.3, pantry.floorY + 2.5],
    tier.shelves,
  );

  const utility = rooms.utility;
  createCounterRun(
    parts,
    'utility-run',
    inset(utility.x, 0.3),
    band(utility.z, 'start', 0.62),
    utility.floorY,
    { upper: true, upperFrom: utility.floorY + 1.55 },
  );
  createBuiltIn(parts, 'utility-store', inset(utility.x, 0.3), band(utility.z, 'end', 0.6), [
    utility.floorY,
    utility.floorY + 2.4,
  ]);

  // ── Ground floor: guest suite ─────────────────────────────────────────
  const guest = rooms.guestBedroom;
  const guestBedCz = mid(guest.z) - 0.6;
  createBed(parts, 'guest-bed', guest.x[0] + 1.15, guestBedCz, guest.floorY, 1.6, 2.05, 'east');
  createNightstand(
    parts,
    'guest-night-a',
    guest.x[0] + 0.42,
    guestBedCz - 1.02,
    guest.floorY,
    true,
  );
  createNightstand(
    parts,
    'guest-night-b',
    guest.x[0] + 0.42,
    guestBedCz + 1.02,
    guest.floorY,
    true,
  );
  createRug(parts, 'guest-rug', guest.x[0] + 1.9, guestBedCz, guest.floorY, 3.0, 2.6);
  createBuiltIn(parts, 'guest-wardrobe', inset(guest.x, 0.35), band(guest.z, 'end', 0.62), [
    guest.floorY,
    guest.floorY + 2.5,
  ]);

  const guestBath = rooms.guestBath;
  createVanity(
    parts,
    'guest-vanity',
    inset(guestBath.x, 0.45),
    band(guestBath.z, 'start', 0.55),
    guestBath.floorY,
    guestBath.ceilingY,
  );
  createShower(
    parts,
    'guest-shower',
    [guestBath.x[0] + 0.3, guestBath.x[0] + 1.6],
    [guestBath.z[1] - 1.9, guestBath.z[1] - 0.4],
    guestBath.floorY,
    2.2,
  );
  createWC(
    parts,
    'guest-wc',
    guestBath.x[1] - 0.32,
    mid(guestBath.z) - 0.4,
    guestBath.floorY,
    'west',
  );

  // ── Ground floor: study and media room ────────────────────────────────
  const study = rooms.study;
  createShelving(
    parts,
    'study-shelving',
    [study.x[0] + 0.3, study.x[0] + 3.6],
    band(study.z, 'start', 0.42),
    [study.floorY + 0.05, study.floorY + 3.2],
    tier.shelves,
  );
  createDesk(
    parts,
    'study-desk',
    mid(study.x) - 0.6,
    mid(study.z) + 0.6,
    study.floorY,
    'south',
    1.9,
  );
  createArmchair(parts, 'study-chair', study.x[1] - 1.0, study.z[1] - 1.4, study.floorY, 'west');
  createRug(parts, 'study-rug', mid(study.x), mid(study.z) + 0.9, study.floorY, 3.4, 2.8);
  if (tier.accessories) {
    createFloorLamp(parts, 'study-lamp', study.x[1] - 0.6, study.z[1] - 2.6, study.floorY);
  }

  const media = rooms.media;
  createMediaUnit(
    parts,
    'media-unit',
    inset(media.x, 0.4),
    band(media.z, 'start', 0.45),
    media.floorY,
  );
  createSofa(parts, 'media-sofa', mid(media.x), media.z[1] - 1.6, media.floorY, 2.4, 1.0, 'north');
  createRug(parts, 'media-rug', mid(media.x), mid(media.z) + 0.4, media.floorY, 2.8, 3.4);
  createCoffeeTable(parts, 'media-table', mid(media.x), mid(media.z) + 0.2, media.floorY, 1.0, 0.7);

  // ── Upper floor: master suite ─────────────────────────────────────────
  const master = rooms.masterBedroom;
  const masterBedCz = master.z[0] + clear + 1.05;
  createBed(parts, 'master-bed', mid(master.x), masterBedCz, master.floorY, 1.95, 2.1, 'south');
  createNightstand(
    parts,
    'master-night-a',
    mid(master.x) - 1.42,
    master.z[0] + 0.5,
    master.floorY,
    true,
  );
  createNightstand(
    parts,
    'master-night-b',
    mid(master.x) + 1.42,
    master.z[0] + 0.5,
    master.floorY,
    true,
  );
  createRug(parts, 'master-rug', mid(master.x), masterBedCz + 0.3, master.floorY, 4.4, 3.6);
  createArmchair(
    parts,
    'master-chair-a',
    mid(master.x) - 1.1,
    master.z[1] - 0.9,
    master.floorY,
    'north',
  );
  createArmchair(
    parts,
    'master-chair-b',
    mid(master.x) + 1.1,
    master.z[1] - 0.9,
    master.floorY,
    'north',
  );
  createSideTable(parts, 'master-side', mid(master.x), master.z[1] - 0.9, master.floorY);
  createBuiltIn(
    parts,
    'master-panel',
    inset(master.x, 1.1),
    band(master.z, 'start', 0.1),
    [master.floorY + 0.4, master.floorY + 2.8],
    1.3,
  );
  createCove(
    parts,
    'master-cove',
    inset(master.x, 0.4),
    band(master.z, 'start', 0.22),
    master.ceilingY - config.ceilingDepth,
  );

  const masterBath = rooms.masterBath;
  createBathtub(
    parts,
    'master-tub',
    [masterBath.x[0] + 0.5, masterBath.x[0] + 2.3],
    [masterBath.z[1] - 1.5, masterBath.z[1] - 0.55],
    masterBath.floorY,
  );
  createVanity(
    parts,
    'master-vanity',
    [masterBath.x[0] + 0.3, masterBath.x[0] + 1.9],
    band(masterBath.z, 'start', 0.55),
    masterBath.floorY,
    masterBath.ceilingY,
  );
  createShower(
    parts,
    'master-shower',
    [masterBath.x[1] - 1.5, masterBath.x[1] - 0.25],
    [masterBath.z[0] + 0.3, masterBath.z[0] + 1.7],
    masterBath.floorY,
    2.3,
  );
  createWC(
    parts,
    'master-wc',
    masterBath.x[1] - 0.32,
    mid(masterBath.z) + 0.4,
    masterBath.floorY,
    'west',
  );

  const dressing = rooms.dressing;
  createBuiltIn(parts, 'dressing-run-a', inset(dressing.x, 0.2), band(dressing.z, 'start', 0.62), [
    dressing.floorY,
    dressing.floorY + 3.0,
  ]);
  createBuiltIn(parts, 'dressing-run-b', inset(dressing.x, 0.2), band(dressing.z, 'end', 0.62), [
    dressing.floorY,
    dressing.floorY + 3.0,
  ]);
  createConsole(
    parts,
    'dressing-island',
    mid(dressing.x),
    mid(dressing.z),
    dressing.floorY,
    1.6,
    'south',
    0.6,
  );

  // ── Upper floor: landing and secondary bedrooms ───────────────────────
  const landing = rooms.landing;
  createConsole(
    parts,
    'landing-console',
    mid(landing.x),
    landing.z[0] + 0.35,
    landing.floorY,
    1.6,
    'south',
  );

  const bedrooms: { room: Room; key: string }[] = [
    { room: rooms.bedroom2, key: 'bed2' },
    { room: rooms.bedroom3, key: 'bed3' },
  ];
  bedrooms.forEach(({ room, key }) => {
    const cx = mid(room.x);
    const cz = room.z[0] + clear + 1.05;
    createBed(parts, `${key}-bed`, cx, cz, room.floorY, 1.7, 2.05, 'south');
    createNightstand(parts, `${key}-night-a`, cx - 1.25, room.z[0] + 0.45, room.floorY, true);
    createNightstand(parts, `${key}-night-b`, cx + 1.25, room.z[0] + 0.45, room.floorY, true);
    createRug(parts, `${key}-rug`, cx, cz + 0.35, room.floorY, 3.2, 2.9);
    createBuiltIn(parts, `${key}-wardrobe`, inset(room.x, 0.4), band(room.z, 'end', 0.6), [
      room.floorY,
      room.floorY + 2.6,
    ]);
    if (tier.accessories) {
      createDesk(parts, `${key}-desk`, room.x[0] + 1.2, room.z[1] - 1.6, room.floorY, 'east', 1.4);
    }
  });

  const bath2 = rooms.bath2;
  createVanity(
    parts,
    'bath2-vanity',
    inset(bath2.x, 0.5),
    band(bath2.z, 'start', 0.55),
    bath2.floorY,
    bath2.ceilingY,
  );
  createShower(
    parts,
    'bath2-shower',
    [bath2.x[0] + 0.3, bath2.x[0] + 1.5],
    [bath2.z[1] - 1.8, bath2.z[1] - 0.4],
    bath2.floorY,
    2.2,
  );
  createWC(parts, 'bath2-wc', bath2.x[1] - 0.32, mid(bath2.z) - 0.2, bath2.floorY, 'west');

  // ── Upper floor: hall, lounge, library ────────────────────────────────
  const upperHall = rooms.upperHall;
  createConsole(
    parts,
    'hall-console',
    upperHall.x[0] + 1.6,
    upperHall.z[0] + 0.3,
    upperHall.floorY,
    1.6,
    'south',
  );
  createCove(
    parts,
    'hall-cove',
    inset(upperHall.x, 0.6),
    band(upperHall.z, 'start', 0.2),
    upperHall.ceilingY - config.ceilingDepth,
  );
  createNiche(
    parts,
    'hall-niche',
    [mid(upperHall.x) + 1.0, mid(upperHall.x) + 3.0],
    band(upperHall.z, 'start', 0.14),
    [upperHall.floorY + 1.0, upperHall.floorY + 2.4],
  );

  const lounge = rooms.upperLounge;
  createSofa(
    parts,
    'lounge-sofa',
    mid(lounge.x),
    lounge.z[0] + 1.5,
    lounge.floorY,
    2.8,
    1.0,
    'south',
  );
  createCoffeeTable(
    parts,
    'lounge-table',
    mid(lounge.x),
    mid(lounge.z) + 0.6,
    lounge.floorY,
    1.4,
    0.8,
  );
  createRug(parts, 'lounge-rug', mid(lounge.x), mid(lounge.z) + 0.4, lounge.floorY, 4.2, 3.6);
  createArmchair(
    parts,
    'lounge-chair',
    lounge.x[1] - 1.0,
    lounge.z[1] - 1.3,
    lounge.floorY,
    'west',
  );

  const library = rooms.library;
  // The library's north edge is open to the hall rather than walled, so the
  // shelving is a double-sided divider at chest-and-a-half height: it gives
  // the room a back without closing the upper floor's open plan.
  createShelving(
    parts,
    'library-shelving',
    [library.x[0] + 0.5, library.x[0] + 4.6],
    band(library.z, 'start', 0.44),
    [library.floorY + 0.05, library.floorY + 2.1],
    tier.shelves,
  );
  createSofa(
    parts,
    'library-sofa',
    mid(library.x) + 0.6,
    library.z[1] - 3.4,
    library.floorY,
    2.8,
    1.05,
    'south',
  );
  createCoffeeTable(
    parts,
    'library-table',
    mid(library.x) + 0.6,
    library.z[1] - 1.9,
    library.floorY,
    1.5,
    0.85,
  );
  createArmchair(
    parts,
    'library-chair-a',
    mid(library.x) - 0.8,
    library.z[1] - 0.9,
    library.floorY,
    'north',
  );
  createArmchair(
    parts,
    'library-chair-b',
    mid(library.x) + 2.0,
    library.z[1] - 0.9,
    library.floorY,
    'north',
  );
  createRug(
    parts,
    'library-rug',
    mid(library.x) + 0.6,
    library.z[1] - 2.4,
    library.floorY,
    4.6,
    3.8,
  );
  createDesk(
    parts,
    'library-desk',
    library.x[1] - 1.1,
    library.z[0] + 1.6,
    library.floorY,
    'west',
    1.8,
  );
  if (tier.accessories) {
    createFloorLamp(parts, 'library-lamp', library.x[0] + 0.7, library.z[1] - 2.2, library.floorY);
  }

  // ── Feature panelling ─────────────────────────────────────────────────
  // Warm plaster linings on the principal rooms' back walls, held off the
  // structure so a shadow gap separates finish from frame.
  panelling.push(
    box(
      'panel-living',
      [living.x[0] + 0.35, fireplaceX[0] - 0.2],
      [living.floorY + 0.1, living.ceilingY - 0.35],
      [livingRearZ + 0.02, livingRearZ + 0.06],
    ),
    box(
      'panel-foyer',
      [foyer.x[1] - 0.06, foyer.x[1] - 0.02],
      [foyer.floorY + 0.1, levels.groundFloorTopY - 0.3],
      inset(foyer.z, 0.5),
    ),
  );

  // ── Interior fill lighting ────────────────────────────────────────────
  const lightPlan: InteriorLight[] = [
    {
      key: 'light-living',
      position: [mid(living.x), living.ceilingY - 0.85, mid(living.z)],
      intensity: 46,
      distance: 16,
      color: '#ffe6c4',
    },
    {
      key: 'light-kitchen',
      position: [mid(islandX), kitchen.ceilingY - 0.85, mid(islandZ)],
      intensity: 38,
      distance: 15,
      color: '#ffeed6',
    },
    {
      key: 'light-foyer',
      position: [mid(foyer.x), levels.groundFloorTopY - 0.4, mid(foyer.z)],
      intensity: 40,
      distance: 16,
      color: '#ffe8cb',
    },
    {
      key: 'light-library',
      position: [mid(library.x), library.ceilingY - 0.85, mid(library.z) - 1.5],
      intensity: 42,
      distance: 16,
      color: '#ffe6c4',
    },
    {
      key: 'light-lounge',
      position: [mid(lounge.x) + 1.5, lounge.ceilingY - 0.85, mid(lounge.z)],
      intensity: 40,
      distance: 16,
      color: '#ffe6c4',
    },
    {
      key: 'light-master',
      position: [mid(master.x), master.ceilingY - 0.85, mid(master.z)],
      intensity: 34,
      distance: 13,
      color: '#ffe0bb',
    },
    {
      key: 'light-stair',
      position: [mid(hall.x), levels.groundFloorTopY + 0.6, mid(stairwellZ)],
      intensity: 26,
      distance: 13,
      color: '#ffe8cb',
    },
  ];

  return {
    rooms: roomList,
    floorsStone,
    floorsTimber,
    ceilings,
    partitions: schedule.partitions,
    panelling,
    stairs,
    laylight,
    furniture: parts,
    lights: lightPlan.slice(0, tier.lights),
  };
}
