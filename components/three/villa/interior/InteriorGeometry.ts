import type { BoxSpec, DetailTier, Range, VillaLevels, VillaPlan } from '../VillaTypes';
import { box, mid, span, stairRun } from '../SpecBuilders';
import {
  createArmchair,
  createBalustrade,
  createBathtub,
  createBuiltIn,
  createCoffeeTable,
  createConsole,
  createCounterRun,
  createCeilingRuns,
  createCove,
  createDesk,
  createFireplace,
  createFloorLamp,
  createIsland,
  createMediaUnit,
  createNiche,
  createWallWasher,
  createNightstand,
  createPendant,
  createRug,
  createShelving,
  createShower,
  createSofa,
  createVanity,
  createWC,
  emptyParts,
} from './Furniture';
import { createArtwork, createBooks, createPlant, createTray, createVessel } from './InteriorDecor';
import type { Form } from '../furniture/FormTypes';
import {
  createBowl,
  createFloorVessel,
  createHungConsole,
  createOttoman,
  createPedestalTable,
  createSofa as buildSofa,
  createTableLamp,
  createCrescentSofa,
  createOrganicCoffeeTable,
  createBoucleChair,
  createArcLamp,
  createFlutedSideboard,
  createVesselCluster,
} from '../furniture/Pieces';
import {
  createBoardedWall,
  createDressedWindow,
  createPileRug,
  createScreen,
  createStandingLamp,
  createStyling,
} from '../furniture/Staging';
import { createInteriorPlan, FLOOR_BUILD_UP, type Room } from './InteriorPlan';
import type {
  InteriorConfig,
  InteriorLayout,
  InteriorLight,
  InteriorModelPlacement,
} from './InteriorTypes';

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
 * repeated and decorative elements scale here; how many practical lights
 * are actually mounted belongs to the lighting system, not to the
 * furniture, and is decided in `lib/three/lighting.ts`.
 */
const DETAIL: Record<
  DetailTier,
  {
    seatDensity: number;
    accessories: boolean;
    shelves: number;
    /**
     * Curtains, artwork, planting and the objects on surfaces. Dropped on
     * the low tier, which keeps every piece that defines what a room *is* —
     * bed, sofa, table, rug — and loses only what an interior designer
     * would have added afterwards.
     */
    decor: boolean;
    /** Styling for rooms no named camera ever enters. */
    secondaryDecor: boolean;
  }
> = {
  low: { seatDensity: 0.5, accessories: false, shelves: 3, decor: false, secondaryDecor: false },
  medium: { seatDensity: 0.75, accessories: true, shelves: 4, decor: true, secondaryDecor: false },
  high: { seatDensity: 1, accessories: true, shelves: 5, decor: true, secondaryDecor: true },
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
/**
 * Height of the skirting run, and how far it stands proud of the wall.
 *
 * Deliberately small on both counts. A tall skirting belongs to a
 * traditional interior; this one is a shallow modern band, present enough
 * to catch a highlight along its top and never enough to be noticed as a
 * moulding.
 */
const SKIRTING_HEIGHT = 0.085;
const SKIRTING_PROUD = 0.016;

/** Depth and inset of the recessed slot the ceiling hangs inside. */
const CEILING_SHADOW_GAP = 0.035;

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
  // Soft, turned and folded geometry, kept alongside the box specs rather
  // than replacing them: the building fabric is still prisms, correctly, and
  // only the things that are not buildings move onto this list.
  const forms: Form[] = [];
  // Real furniture, placed by the room builders below. Poly Haven
  // models face +Z authored — the opposite of the repo's Blender
  // pieces, which face -Z — so their rotations follow Pieces.ts's
  // YAW table (south 0, north pi, east pi/2, west -pi/2), verified
  // against the staged glTFs (backrest/headboard vertex clusters).
  // NOT ApartmentGeometry's FACE table.
  const models: InteriorModelPlacement[] = [];
  const model = (
    name: InteriorModelPlacement['name'],
    position: [number, number, number],
    rotationY: number,
    scale?: InteriorModelPlacement['scale'],
  ) => {
    models.push({ name, position, rotationY, scale });
  };
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

    // ── Skirting ────────────────────────────────────────────────────────
    // A run of skirting around the foot of every wall, in the wall's own
    // plaster. It reads not as a different colour but as a line — the
    // chamfer along its top arris catches light where the wall above does
    // not — and that line is one of the details whose *absence* is most
    // legible: a wall meeting a floor at a mathematically sharp corner is
    // something no built room has ever done, and the eye knows it without
    // being able to name it.
    const skirtTop = room.floorY + SKIRTING_HEIGHT;
    const skirtY: Range = [room.floorY, skirtTop];
    panelling.push(
      box(`${room.id}-skirt-w`, [room.x[0], room.x[0] + SKIRTING_PROUD], skirtY, room.z),
      box(`${room.id}-skirt-e`, [room.x[1] - SKIRTING_PROUD, room.x[1]], skirtY, room.z),
      box(`${room.id}-skirt-n`, [room.x[0] + SKIRTING_PROUD, room.x[1] - SKIRTING_PROUD], skirtY, [
        room.z[0],
        room.z[0] + SKIRTING_PROUD,
      ]),
      box(`${room.id}-skirt-s`, [room.x[0] + SKIRTING_PROUD, room.x[1] - SKIRTING_PROUD], skirtY, [
        room.z[1] - SKIRTING_PROUD,
        room.z[1],
      ]),
    );

    if (noCeiling.has(room.id)) return;

    // ── Ceiling, on a shadow gap ────────────────────────────────────────
    // The ceiling stops short of the walls and hangs slightly below the
    // soffit, leaving a continuous recessed slot around the room.
    //
    // This is the defining detail of the architecture the residence is
    // written in, and it is worth being precise about why it matters so
    // much for so little geometry. A ceiling butted into a wall produces a
    // single hard line and nothing else. A ceiling on a shadow gap produces
    // a band of genuine darkness that follows the room's perimeter, reads
    // the depth of the slot, and turns a corner — so the room acquires a
    // sense of its own construction. Every photograph of a house of this
    // kind has that band in it.
    ceilings.push(
      box(
        `${room.id}-ceiling`,
        [room.x[0] + CEILING_SHADOW_GAP, room.x[1] - CEILING_SHADOW_GAP],
        [
          room.ceilingY - config.ceilingDepth - CEILING_SHADOW_GAP,
          room.ceilingY - CEILING_SHADOW_GAP,
        ],
        [room.z[0] + CEILING_SHADOW_GAP, room.z[1] - CEILING_SHADOW_GAP],
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
  createPileRug(
    forms,
    'living-rug',
    [mid(living.x), mid(living.z) + 0.7],
    living.floorY,
    5.2,
    4.2,
    91,
  );

  // ── The living room's hero furniture ───────────────────────────────────
  // Everything here comes from `furniture/Pieces.ts` rather than from the
  // box builders the other rooms still use. That split is deliberate and
  // matches where the cameras actually are: this room and the master suite
  // carry two of the five money shots, and they are the two where a
  // rectangular prism with its corners knocked off stops being an
  // acceptable description of a sofa.
  const livingCx = mid(living.x);
  // Faces south, seat toward the room. Style lock (V1VID concept):
  // the plush sofa-ph-03 is out, and the cleaner sofa-ph-02 (1.81 m)
  // read as a loveseat in the 3.0 m slot — so the slot now takes
  // the Blender-built white sectional (2.90 m, channel-tufted,
  // sage cushions as separate meshes), authored for this room from
  // the approved living-room concept image. The chaise is on the
  // east end: the crescent sofa closes the west side, the east
  // flank is clear.
  model('sofa-sectional-white', [livingCx, living.floorY, living.z[0] + 1.75], 0);
  // Long axis X (the real table is 1.20 m long on Z); 0.39 m high
  // against the procedural 0.38 m, so the tray and books on it stay put.
  model('table-ph-coffee', [livingCx, living.floorY, mid(living.z) + 0.9], Math.PI / 2);
  // The pair of chairs facing the seating group, each toed in toward it.
  // Square-on they read as waiting-room furniture; a few degrees of turn is
  // what an arrangement someone actually sits in looks like.
  // Both face north, toward the sofa; chair-b keeps its 0.16 rad
  // toe-in toward the seating group.
  model('chair-ph-arm', [living.x[0] + 1.6, living.floorY, living.z[1] - 1.2], Math.PI);
  model('chair-ph-arm', [living.x[0] + 3.5, living.floorY, living.z[1] - 1.2], Math.PI + 0.16);
  model('table-ph-side', [living.x[0] + 2.55, living.floorY, living.z[1] - 1.5], 0);

  // ── Filling the room out ──────────────────────────────────────────────
  //
  // A sofa, a table and two chairs is a seating group, not a room. This is
  // sixty-seven square metres and the frames showed most of it as empty
  // floor either side of one arrangement — which is what makes a space read
  // as a model of a room rather than as one that is lived in. What follows
  // is what an interior designer would put in the gaps: something with mass
  // against the rear wall, a piece without a back to sit between the sofa
  // and the chairs, a chair turned to the fire, and one tall object on the
  // floor that is neither a lamp nor a plant.
  const livingWest = living.x[0];
  const livingEast = living.x[1];

  // A hung console under the niche, which was floating over bare wall.
  createHungConsole(
    forms,
    'living-console',
    {
      at: [livingWest + 1.7, livingRearZ + 0.34],
      floorY: living.floorY,
      facing: 'south',
      seed: 21,
    },
    { width: 2.1, depth: 0.44 },
  );

  // Styled, because a two-metre stone top with nothing on it reads as a
  // shelf awaiting delivery. Three objects of different heights: the
  // composition every interior photograph uses, since four starts to read
  // as clutter.
  if (tier.decor) {
    const consoleTop = living.floorY + 0.42 + 0.34 + 0.036;
    const consoleCx = livingWest + 1.7;
    const consoleCz = livingRearZ + 0.34;
    createFloorVessel(forms, 'living-console-vase', [consoleCx - 0.58, consoleCz], consoleTop, {
      height: 0.38,
      radius: 0.11,
    });
    createBowl(forms, 'living-console-bowl', [consoleCx + 0.12, consoleCz], consoleTop, {
      radius: 0.17,
      height: 0.1,
    });
    createBooks(parts, 'living-console-books', consoleCx + 0.75, consoleCz, consoleTop, 4, 57);
  }

  // The ottoman: mass between the sofa and the chairs, and no third back.
  createOttoman(
    forms,
    'living-ottoman',
    {
      at: [livingCx + 1.95, mid(living.z) + 0.75],
      floorY: living.floorY,
      facing: 'west',
      seed: 22,
    },
    { width: 1.15, depth: 0.72 },
  );

  // One more chair, turned to the fire rather than to the group — which is
  // what stops an arrangement reading as a showroom set.
  model('chair-ph-arm', [livingEast - 1.35, living.floorY, living.z[0] + 2.3], -Math.PI / 2);
  createPedestalTable(
    forms,
    'living-side-b',
    [livingEast - 1.5, living.z[0] + 3.5],
    living.floorY,
    { height: 0.46, radius: 0.2, seed: 24 },
  );

  // A second, shorter sofa closing the west side of the group.
  //
  // The arrangement was a sofa with two chairs opposite and nothing on
  // either flank, which leaves the conversation open at both ends and — in
  // the framing the camera actually stands in — leaves several square
  // metres of bare rug in the middle of the shot. A third seat turned in
  // from the west closes the U, and it is the piece that makes the group
  // read as somewhere people sit rather than as a showroom set.
  //
  // 2026 update: crescent sofa — the defining silhouette of quiet luxury.
  // Replaces the boxy west sofa with a curved form that closes the U more
  // organically and reads as bespoke. The straight sofa stays on the low
  // tier; the crescent is the hero on medium/high.
  if (detail === 'low') {
    buildSofa(
      forms,
      'living-sofa-west',
      {
        at: [livingWest + 2.1, mid(living.z) + 0.25],
        floorY: living.floorY,
        facing: 'east',
        seed: 25,
      },
      { width: 2.0, depth: 0.98 },
    );
  } else {
    createCrescentSofa(
      forms,
      'living-crescent',
      {
        at: [livingWest + 1.8, mid(living.z) + 0.35],
        floorY: living.floorY,
        facing: 'east',
        seed: 25,
      },
      { radius: 1.9, arc: Math.PI * 1.15, dark: false },
    );
  }

  // A stool at the open corner, which is where one actually ends up.
  createOttoman(
    forms,
    'living-stool',
    {
      // Between the long sofa and the table, which is the one patch of rug
      // inside the group that nothing else occupies. The first position put
      // it straight through the second chair; an overlap audit across all
      // 155 furniture forms found it, and it was the only real one in the
      // house.
      at: [livingWest + 2.9, mid(living.z) - 0.55],
      floorY: living.floorY,
      facing: 'north',
      seed: 26,
    },
    { width: 0.62, depth: 0.62, dark: true },
  );

  // Height on the floor that is neither a lamp nor a plant.
  createFloorVessel(forms, 'living-vessel', [livingWest + 0.85, livingRearZ + 1.5], living.floorY, {
    height: 0.82,
    radius: 0.24,
  });

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
  // ── Living room styling ───────────────────────────────────────────────
  // ── 2026 modern additions — sculptural, biophilic, layered ──────────
  if (tier.decor) {
    // Organic pebble coffee table — kidney shape, 2026 sculptural stone
    createOrganicCoffeeTable(
      forms,
      'living-organic-table',
      {
        at: [livingCx + 0.9, mid(living.z) + 0.15],
        floorY: living.floorY,
        facing: 'south',
        seed: 27,
      },
      { width: 1.1, depth: 0.68, height: 0.36 },
    );

    // Arc floor lamp — statement lighting, marble base + bronze arc
    createArcLamp(forms, 'living-arc', [livingEast - 0.9, mid(living.z) + 0.2], living.floorY, {
      height: 1.92,
      reach: 1.35,
    });

    // Fluted sideboard — textured oak, invisible joinery trend
    createFlutedSideboard(
      forms,
      'living-fluted',
      {
        at: [livingEast - 0.28, livingRearZ + 0.38],
        floorY: living.floorY,
        facing: 'west',
        seed: 28,
      },
      { width: 1.6, depth: 0.46 },
    );

    // Vessel cluster on the fluted sideboard — curated objects at varying heights
    const flutedTop = living.floorY + 0.78 + 0.044;
    createVesselCluster(
      forms,
      'living-fluted-cluster',
      [livingEast - 0.28, livingRearZ + 0.5],
      flutedTop,
      28,
    );

    // Additional biophilic — tall fiddle leaf fig in the corner
    // The real plant is 1.35 m against the procedural 1.85 m; the
    // foliage cards for this corner go with it.
    // Blender-built potted olive (real 3D leaves) in place of
    // the second decimated plant-ph-01 — two different plants,
    // not one repeated.
    model('plant-olive', [livingWest + 0.7, living.floorY, living.z[1] - 0.9], 0);

    // Second artwork — layered art, curated gallery wall
    createArtwork(
      parts,
      'living-art-b',
      [livingEast - 2.2, livingEast - 0.5],
      [living.floorY + 1.2, living.floorY + 2.3],
      [livingRearZ + 0.14, livingRearZ + 0.2],
      'z',
      42,
    );
  }

  // Everything below is Phase 7F: the room was correctly planned and
  // completely unstaged, which is why it read as generated. Curtains first,
  // because they are the largest soft mass and the one that gives the
  // double-height glazing a sense of scale.
  if (tier.decor) {
    createDressedWindow(forms, 'living-curtain', {
      across: inset(living.x, 0.25),
      at: living.z[1] - 0.26,
      y: [living.floorY, living.ceilingY - 0.06],
      seed: 41,
    });

    createArtwork(
      parts,
      'living-art',
      [living.x[0] + 0.9, living.x[0] + 3.1],
      [living.floorY + 1.15, living.floorY + 2.55],
      [livingRearZ + 0.14, livingRearZ + 0.2],
      'z',
      41,
    );

    model('plant-ph-01', [living.x[1] - 0.9, living.floorY, living.z[1] - 1.6], Math.PI / 2);

    // Blender-built glazed door leaf, ajar 35 deg OUTWARD onto
    // the terrace (hinge at the east end of the glass wall).
    // Outward so it never crosses the dressed sheer at
    // living.z[1]-0.26; +0.12 is the terrace step (terraceY
    // 1.02 over groundY 0.9). Origin is the hinge post.
    model('door-balcony-open', [living.x[1] - 1.05, living.floorY + 0.12, living.z[1] + 0.06], 0);

    // The coffee table, styled. A tray, a low stack of books beside it, and
    // one vessel — the composition every interior photograph uses, because
    // three objects of different heights read as arrangement and four read
    // as clutter.
    const tableTop = living.floorY + 0.42;
    const tableCx = mid(living.x);
    const tableCz = mid(living.z) + 0.9;
    createTray(parts, 'living-tray', tableCx - 0.24, tableCz + 0.04, tableTop);
    createBooks(parts, 'living-books', tableCx + 0.34, tableCz - 0.06, tableTop, 3, 23);
    createVessel(parts, 'living-vase', tableCx - 0.2, tableCz + 0.02, tableTop + 0.022, 0.24, 0.07);
  }

  createCove(
    parts,
    'living-cove',
    inset(living.x, 0.5),
    [livingRearZ + 0.02, livingRearZ + 0.2],
    living.ceilingY - config.ceilingDepth,
  );
  if (tier.accessories) {
    createStandingLamp(
      forms,
      'living-lamp',
      [living.x[0] + 0.75, living.z[1] - 2.4],
      living.floorY,
    );
  }

  // ── Ground floor: dining ──────────────────────────────────────────────
  const dining = rooms.dining;
  const diningCx = mid(dining.x);
  createRug(parts, 'dining-rug', diningCx, mid(dining.z) + 0.4, dining.floorY, 3.6, 2.6);
  // The real table and chairs, at every tier: the procedural round
  // travertine top and the trestle set both go. The Poly Haven table
  // is 2.26 m long (the trestle set was 2.80 m) and 0.877 m high,
  // Y-squashed to 0.75 m — the centrepiece and bowls below still sit
  // on it at floorY + 0.75. Six pale painted-wood chairs, three a
  // side, turned toward the table (seat 0.44 m; the dark
  // dining_chair_02 fights the V1VID palette).
  const diningCz = mid(dining.z) + 0.4;
  model('table-ph-dining', [diningCx, dining.floorY, diningCz], 0, [1, 0.855, 1]);
  for (let i = 0; i < 6; i += 1) {
    const side = i < 3 ? -1 : 1;
    model(
      'chair-ph-painted',
      [diningCx + ((i % 3) - 1) * 0.78, dining.floorY, diningCz + side * 0.86],
      side < 0 ? 0 : Math.PI,
    );
  }
  if (tier.decor) {
    // A centrepiece and a low run of objects on the sideboard: enough that
    // the table reads as laid for the photograph, not for a meal.
    createVessel(
      parts,
      'dining-centre',
      diningCx,
      mid(dining.z) + 0.4,
      dining.floorY + 0.75,
      0.36,
      0.09,
    );
    // A bowl either side of the centrepiece, so the table has a run of
    // objects down it rather than one thing in the middle.
    createBowl(
      forms,
      'dining-bowl-w',
      [diningCx - 0.78, mid(dining.z) + 0.4],
      dining.floorY + 0.75,
      {
        radius: 0.16,
        height: 0.09,
      },
    );
    createBowl(
      forms,
      'dining-bowl-e',
      [diningCx + 0.78, mid(dining.z) + 0.4],
      dining.floorY + 0.75,
      {
        radius: 0.13,
        height: 0.075,
      },
    );
    // Blender-built pleated sheer panel (3.0 m) in place of the
    // procedural curtain slab, same wall.
    model('curtain-sheer', [mid(dining.x), dining.floorY, dining.z[1] - 0.24], 0);
  }
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
  // Blender-built board + citrus bowl on the run counter
  // (top floorY+0.92, back band z[0]..z[0]+0.64).
  model('kitchen-board-set', [kitchen.x[1] - 0.9, kitchen.floorY + 0.92, kitchen.z[0] + 0.32], 0);
  const islandX: Range = [mid(kitchen.x) - 2.0, mid(kitchen.x) + 2.0];
  const islandZ: Range = [mid(kitchen.z) - 0.55, mid(kitchen.z) + 0.55];
  createIsland(parts, 'kitchen-island', islandX, islandZ, kitchen.floorY, tier.accessories ? 3 : 2);
  // Blender-built gooseneck tap on the island sink (the run has
  // no sink; the island's recess is at islandX[0]+0.5..1.4).
  // Base on the island top (floorY+0.94), spout over the sink.
  model('tap-kitchen', [islandX[0] + 0.95, kitchen.floorY + 0.94, mid(islandZ) - 0.32], 0);
  if (tier.decor) {
    // A luxury kitchen in a brochure is nearly bare. Three objects at three
    // heights, grouped at one end of the island so the run of stone reads.
    const islandTop = kitchen.floorY + 0.92;
    const stagedX = islandX[0] + 0.75;
    createTray(parts, 'kitchen-board', stagedX, mid(islandZ), islandTop, 0.5, 0.32);
    createVessel(
      parts,
      'kitchen-bowl',
      stagedX + 0.05,
      mid(islandZ),
      islandTop + 0.022,
      0.14,
      0.13,
    );
    createVessel(
      parts,
      'kitchen-vase',
      islandX[1] - 0.6,
      mid(islandZ),
      islandTop,
      0.32,
      0.075,
      'stone',
    );
  }
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
  // Blender-built platform bed, scaled to the old 1.60 x 2.05 slot.
  // Faces east (head at the west end): rotation pi/2 per the YAW table.
  model(
    'bed-platform-oak',
    [guest.x[0] + 1.15, guest.floorY, guestBedCz],
    Math.PI / 2,
    [0.889, 1, 0.976],
  );
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
  model('sofa-ph-02', [mid(media.x), media.floorY, media.z[1] - 1.6], Math.PI);
  createRug(parts, 'media-rug', mid(media.x), mid(media.z) + 0.4, media.floorY, 2.8, 3.4);
  createCoffeeTable(parts, 'media-table', mid(media.x), mid(media.z) + 0.2, media.floorY, 1.0, 0.7);

  // ── Upper floor: master suite ─────────────────────────────────────────
  // The highest-priority room in the residence. Every piece here is soft or
  // turned geometry; nothing in this room is a prism except the building
  // around it.
  const master = rooms.masterBedroom;
  const masterCx = mid(master.x);
  const masterBedCz = master.z[0] + clear + 1.35;

  // Blender-built platform bed (1.80 x 2.10 m, oak + white linen +
  // sage throw, own headboard and pillows) — replaces the procedural
  // headboard + bed. The timber lining behind it stays: it is wall
  // panelling, not part of the bed. Scaled to the old 1.98 x 2.14 slot.
  model('bed-platform-oak', [masterCx, master.floorY, masterBedCz], 0, [1.1, 1, 1.019]);

  for (const side of [-1, 1] as const) {
    const nx = masterCx + side * 1.62;
    const nz = master.z[0] + clear + 0.62;
    model('nightstand-ph-classic', [nx, master.floorY, nz], 0);
    createTableLamp(forms, `master-lamp-${side}`, [nx, nz], master.floorY + 0.7, {
      height: 0.5,
      shadeRadius: 0.15,
    });
  }

  createPileRug(forms, 'master-rug', [masterCx, masterBedCz + 0.5], master.floorY, 4.6, 3.8, 92);

  // A pair of chairs in the window bay with a pedestal table between them.
  // 2026: boucle armchairs — tactile, enveloping, on a hidden plinth —
  // on medium/high; the lounge chairs remain on the low tier.
  const masterChairZ = master.z[1] - 1.05;
  model('chair-ph-arm', [masterCx - 1.15, master.floorY, masterChairZ], Math.PI);
  model('chair-ph-arm', [masterCx + 1.15, master.floorY, masterChairZ], Math.PI);
  createPedestalTable(forms, 'master-side', [masterCx, masterChairZ - 0.1], master.floorY, {
    height: 0.48,
    radius: 0.21,
    seed: 65,
  });
  // 2026 addition: organic side table and a vessel cluster in the bay
  if (tier.decor) {
    createOrganicCoffeeTable(
      forms,
      'master-organic',
      { at: [masterCx - 1.8, masterChairZ + 0.6], floorY: master.floorY, facing: 'east', seed: 67 },
      { width: 0.72, depth: 0.52, height: 0.42 },
    );
    createVesselCluster(
      forms,
      'master-cluster',
      [masterCx + 1.8, master.z[0] + clear + 0.62],
      master.floorY + 0.7,
      67,
    );
  }

  if (tier.decor) {
    createDressedWindow(forms, 'master-curtain', {
      across: inset(master.x, 0.3),
      at: master.z[1] - 0.24,
      y: [master.floorY, master.ceilingY - 0.06],
      seed: 66,
    });

    // The screen on the wall opposite the bed, held off the plaster on a
    // bracket so a shadow runs behind it.
    createScreen(forms, 'master-screen', {
      across: [master.z[0] + 1.6, master.z[0] + 3.2],
      y: [master.floorY + 1.05, master.floorY + 1.98],
      at: master.x[0] + 0.08,
      axis: 'x',
      towards: 1,
    });

    model('plant-ph-01', [master.x[0] + 0.85, master.floorY, master.z[1] - 1.4], 0);
    model('plant-olive', [master.x[1] - 0.85, master.floorY, master.z[1] - 1.4], 0);

    // One object on each nightstand, and deliberately not the same object.
    createStyling(
      forms,
      'master-styling',
      [masterCx + 1.62, master.z[0] + clear + 0.62],
      master.floorY + 0.7,
      71,
    );
  }

  // The timber lining behind the bed, built as real boards on a shadow gap.
  createBoardedWall(forms, 'master-panel', {
    across: inset(master.x, 0.32),
    at: master.z[0] + 0.06,
    y: [master.floorY, master.ceilingY - config.ceilingDepth - 0.035],
    axis: 'x',
    depth: 0.06,
    boardHeight: 0.34,
  });

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
  // Blender-built bath tap on the vanity (vanity top
  // floorY+0.90; the old stick column in createVanity is
  // removed in Furniture.ts — it would poke through the tap).
  // Spout faces +Z, over the basin.
  model('tap-bath', [masterBath.x[0] + 1.1, masterBath.floorY + 0.9, masterBath.z[0] + 0.12], 0);
  // Same tap on the tub's east rim (top floorY+0.56), spout
  // turned west (-pi/2) over the tub.
  model(
    'tap-bath',
    [masterBath.x[0] + 2.26, masterBath.floorY + 0.56, masterBath.z[1] - 1.02],
    -Math.PI / 2,
  );

  if (tier.decor) {
    const vanityTop = masterBath.floorY + 0.9;
    // Blender-built folded towels (real folds + a rolled towel)
    // in place of the procedural stack, same spot.
    model('towels-folded', [masterBath.x[0] + 0.55, vanityTop, mid(masterBath.z) - 0.9], 0);
    // Blender-built bottle tray + soap in place of the single
    // procedural vessel, same spot on the vanity.
    model('bath-bottles', [masterBath.x[0] + 1.5, vanityTop, mid(masterBath.z) - 1.0], 0);
    createPlant(
      parts,
      'master-bath-plant',
      masterBath.x[0] + 0.5,
      masterBath.z[1] - 0.6,
      masterBath.floorY,
      0.7,
      37,
    );
  }

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
    // The Blender-built platform bed, scaled to the old 1.70 x 2.05
    // slot — the same bed the master gets, so the three bedrooms
    // share one real bed instead of three procedural ones.
    model('bed-platform-oak', [cx, room.floorY, cz], 0, [0.944, 1, 0.976]);
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
    if (tier.secondaryDecor) {
      // Blender-built pleated sheer panel in place of the
      // procedural curtain slab, same wall.
      model('curtain-sheer', [cx, room.floorY, room.z[1] - 0.24], 0);
      createVessel(
        parts,
        `${key}-night-vase`,
        cx - 1.25,
        room.z[0] + 0.45,
        room.floorY + 0.56,
        0.16,
        0.05,
      );
    }
  });

  const bath2 = rooms.bath2;
  if (tier.secondaryDecor) {
    model('towels-folded', [bath2.x[0] + 0.75, bath2.floorY + 0.9, bath2.z[0] + 0.4], 0);
  }
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
  // Blender-built bath tap on the bath-2 vanity (top
  // floorY+0.90), spout over the basin.
  model('tap-bath', [mid(bath2.x), bath2.floorY + 0.9, bath2.z[0] + 0.12], 0);

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
  const loungeCx = mid(lounge.x);

  // The upper lounge is furnished from the soft-geometry catalogue, like
  // the living room and the master.
  //
  // It was the last principal room still built from the box builders, and
  // that had stopped being defensible: it is glazed the full width to the
  // sea, it is the best-lit interior in the house at any hour, and it is
  // the room a visitor reaches immediately after the stair. A boxed sofa
  // and a boxed armchair in the one frame most likely to be looked at
  // hardest is the wrong place to be saving polygons.
  createPileRug(forms, 'lounge-rug', [loungeCx, mid(lounge.z) + 0.4], lounge.floorY, 4.4, 3.7, 77);

  // 2026: the upper lounge gets a crescent sofa for the ocean view —
  // low-profile, facing the glazing, quiet luxury.
  if (tier.decor && detail !== 'low') {
    createCrescentSofa(
      forms,
      'lounge-crescent',
      { at: [loungeCx, lounge.z[0] + 1.5], floorY: lounge.floorY, facing: 'south', seed: 71 },
      { radius: 2.0, arc: Math.PI * 1.0, dark: false },
    );
  } else {
    buildSofa(
      forms,
      'lounge-sofa',
      { at: [loungeCx, lounge.z[0] + 1.6], floorY: lounge.floorY, facing: 'south', seed: 71 },
      { width: 2.7, depth: 1.02 },
    );
  }
  createOrganicCoffeeTable(
    forms,
    'lounge-organic',
    { at: [loungeCx, mid(lounge.z) + 0.6], floorY: lounge.floorY, facing: 'south', seed: 72 },
    { width: 1.25, depth: 0.72, height: 0.36 },
  );
  model('chair-ph-arm', [loungeCx + 2.5, lounge.floorY, mid(lounge.z) + 0.9], -Math.PI / 2);
  model('chair-ph-arm', [loungeCx - 2.5, lounge.floorY, mid(lounge.z) + 0.9], Math.PI / 2);
  createOttoman(
    forms,
    'lounge-ottoman',
    { at: [loungeCx, mid(lounge.z) + 2.2], floorY: lounge.floorY, facing: 'north', seed: 75 },
    { width: 1.05, depth: 0.68 },
  );
  createPedestalTable(forms, 'lounge-side', [loungeCx + 1.55, lounge.z[0] + 1.4], lounge.floorY, {
    height: 0.48,
    radius: 0.21,
    seed: 76,
  });
  if (tier.decor) {
    createArcLamp(forms, 'lounge-arc', [loungeCx - 2.2, lounge.z[1] - 1.2], lounge.floorY, {
      height: 1.85,
      reach: 1.1,
    });
    createFlutedSideboard(
      forms,
      'lounge-fluted',
      {
        at: [lounge.x[1] - 0.5, lounge.z[0] + 0.6],
        floorY: lounge.floorY,
        facing: 'west',
        seed: 77,
      },
      { width: 1.5, depth: 0.44 },
    );
  }

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
  // 2026: on medium/high the library is furnished from the soft catalogue —
  // crescent sofa, organic table, boucle chairs. Box builders on low.
  if (tier.decor && detail !== 'low') {
    createCrescentSofa(
      forms,
      'library-crescent',
      {
        at: [mid(library.x) + 0.6, library.z[1] - 3.4],
        floorY: library.floorY,
        facing: 'south',
        seed: 141,
      },
      { radius: 1.8, arc: Math.PI * 0.95, dark: false },
    );
    createOrganicCoffeeTable(
      forms,
      'library-organic',
      {
        at: [mid(library.x) + 0.6, library.z[1] - 1.9],
        floorY: library.floorY,
        facing: 'south',
        seed: 142,
      },
      { width: 1.35, depth: 0.78, height: 0.37 },
    );
    createBoucleChair(
      forms,
      'library-chair-a',
      {
        at: [mid(library.x) - 0.8, library.z[1] - 0.9],
        floorY: library.floorY,
        facing: 'north',
        seed: 143,
      },
      { dark: true },
    );
    createBoucleChair(
      forms,
      'library-chair-b',
      {
        at: [mid(library.x) + 2.0, library.z[1] - 0.9],
        floorY: library.floorY,
        facing: 'north',
        seed: 144,
      },
      { dark: true },
    );
  } else {
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
  }
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

  // ── Architectural light lines ─────────────────────────────────────────
  //
  // Two things, applied to every room a visitor is actually taken into.
  //
  // Runs recessed into the ceiling, travelling down the room's long axis.
  // Lighting at this level is not a grid of downlight cans; it is a few
  // continuous channels cut into the slab, and the lines they draw are most
  // of what gives a plain ceiling any geometry at all — without them the
  // frames showed a flat pale rectangle overhead in every interior.
  //
  // And a warm washer set into the rear wall at head height, throwing light
  // down the plaster below it. These walls are large, plain and pale, which
  // is exactly the surface a grazing wash is for: it is what stops a
  // five-metre run of plaster reading as a blank.
  //
  // Both are matte emissive geometry, not lights. They cost nothing per
  // frame, they follow the hour through `fixtureEmissive` like every other
  // lit surface, and on the low tier — where no practical runs at all —
  // they are the only thing keeping a room from going black.
  const lit = [
    rooms.living,
    rooms.dining,
    rooms.kitchen,
    rooms.study,
    rooms.media,
    rooms.guestBedroom,
    rooms.masterBedroom,
    rooms.library,
    rooms.upperLounge,
    rooms.bedroom2,
    rooms.bedroom3,
    rooms.foyer,
  ];

  for (const room of lit) {
    const width = room.x[1] - room.x[0];
    const depth = room.z[1] - room.z[0];
    // Runs travel down the longer dimension and are spaced across the
    // shorter one, which is how a channel is actually set out.
    const runs = Math.max(2, Math.min(4, Math.round(Math.min(width, depth) / 2.4)));
    const ceiling = room.ceilingY - config.ceilingDepth;

    createCeilingRuns(
      parts,
      `${room.id}-runs`,
      depth >= width ? 'z' : 'x',
      room.x,
      room.z,
      ceiling,
      runs,
    );

    createWallWasher(
      parts,
      `${room.id}-washer`,
      'x',
      inset(room.x, 0.45),
      [room.z[0], room.z[0] + 0.02],
      room.floorY + 2.15,
    );
  }

  // ── Interior fill lighting ────────────────────────────────────────────
  // Practical lighting, ranked by how much a room needs to read as
  // inhabited. Intensities are relative weights only: the time-of-day state
  // supplies the absolute candela, and the quality tier and the hour
  // between them decide how far down this list the renderer gets. Lighting
  // policy is not a geometry decision, so none of it is made here.
  const lights: InteriorLight[] = [
    // The three rooms a buyer actually stands in get a downlight with a
    // shadow. Everything below them is fill.
    {
      key: 'light-living',
      kind: 'spot',
      position: [mid(living.x), living.ceilingY - 0.2, mid(living.z)],
      target: [mid(living.x), living.floorY, mid(living.z) + 0.6],
      // Wide enough to fill the room and still reach the glazing — the
      // exterior framings are lit by what spills out of these windows, and
      // a tight cone aimed at the rug took the house's night glow with it.
      // The floor contrast comes from the shadow and the cone's falloff,
      // not from starving the light of range.
      angle: 1.16,
      penumbra: 0.9,
      intensity: 1,
      distance: 16,
      color: '#ffe6c4',
      shadow: true,
    },
    {
      key: 'light-master',
      kind: 'spot',
      position: [mid(master.x), master.ceilingY - 0.2, mid(master.z)],
      target: [mid(master.x), master.floorY, mid(master.z)],
      angle: 1.1,
      penumbra: 0.9,
      intensity: 0.85,
      distance: 14,
      color: '#ffe0bb',
      shadow: true,
    },
    {
      key: 'light-kitchen',
      kind: 'spot',
      position: [mid(islandX), kitchen.ceilingY - 0.2, mid(islandZ)],
      target: [mid(islandX), kitchen.floorY, mid(islandZ)],
      angle: 1.08,
      penumbra: 0.88,
      intensity: 0.9,
      distance: 15,
      color: '#ffeed6',
    },
    {
      key: 'light-library',
      kind: 'spot',
      position: [mid(library.x), library.ceilingY - 0.2, mid(library.z) - 1.2],
      target: [mid(library.x), library.floorY, mid(library.z) - 1.2],
      angle: 1.1,
      penumbra: 0.9,
      intensity: 0.9,
      distance: 15,
      color: '#ffe6c4',
    },
    {
      key: 'light-foyer',
      position: [mid(foyer.x), levels.groundFloorTopY - 0.6, mid(foyer.z)],
      intensity: 0.85,
      distance: 14,
      color: '#ffe8cb',
    },
    {
      key: 'light-lounge',
      position: [mid(lounge.x) + 1.5, lounge.ceilingY - 0.9, mid(lounge.z)],
      intensity: 0.8,
      distance: 14,
      color: '#ffe6c4',
    },
    {
      key: 'light-stair',
      position: [mid(hall.x), levels.groundFloorTopY + 0.6, mid(stairwellZ)],
      intensity: 0.55,
      distance: 12,
      color: '#ffe8cb',
    },

    // ── Fill ───────────────────────────────────────────────────────────
    // Wide, weak, shadowless, and hung lower than the keys so they wash the
    // walls and the ceiling rather than the floor. These are what a viewer
    // outside the house actually sees: the whole night read of the building
    // is light spilling through its glazing, and a downlight aimed at a rug
    // does not produce it. Ranked last, so a device that can only afford
    // four practicals still spends them on the keys.
    {
      key: 'fill-living',
      position: [mid(living.x), living.ceilingY - 1.2, mid(living.z)],
      intensity: 0.2,
      distance: 20,
      color: '#ffdfba',
    },
    {
      key: 'fill-master',
      position: [mid(master.x), master.ceilingY - 1.2, mid(master.z)],
      intensity: 0.18,
      distance: 18,
      color: '#ffdcb4',
    },
    {
      key: 'fill-library',
      position: [mid(library.x), library.ceilingY - 1.2, mid(library.z)],
      intensity: 0.18,
      distance: 18,
      color: '#ffdfba',
    },
    {
      key: 'fill-kitchen',
      position: [mid(islandX), kitchen.ceilingY - 1.2, mid(islandZ)],
      intensity: 0.17,
      distance: 18,
      color: '#ffe6c8',
    },
  ];

  return {
    rooms: roomList,
    forms,
    models,
    floorsStone,
    floorsTimber,
    ceilings,
    partitions: schedule.partitions,
    panelling,
    stairs,
    laylight,
    furniture: parts,
    lights,
  };
}
