import { BoxGeometry, CylinderGeometry } from 'three';
import type {
  BoxSpec,
  ColumnSpec,
  DetailTier,
  Range,
  VillaConfig,
  VillaLayout,
} from './VillaTypes';
import { box, column, span } from './SpecBuilders';
import { buildOpenings } from './openings/OpeningBuilder';
import type { FacadeWall, WallOpening } from './openings/OpeningTypes';

/**
 * Default proportions of the residence, in metres. Every measurement the
 * building uses is derived from this object — changing `width` or
 * `cantileverDepth` re-composes the architecture coherently.
 */
export const VILLA_CONFIG: VillaConfig = {
  width: 30,
  depth: 22,

  foundationHeight: 0.9,
  foundationMargin: 3,

  groundFloorHeight: 3.9,
  upperFloorHeight: 3.5,
  slabThickness: 0.35,
  wallThickness: 0.3,

  roofThickness: 0.4,
  roofOverhang: 1.2,
  roofParapetHeight: 0.45,

  terraceDepth: 6,
  rearBarDepth: 7,
  westWingWidth: 7,
  eastWingWidth: 4,
  glazingInset: 1.1,

  entranceWidth: 3.2,
  entranceRecess: 1.6,
  entranceOffsetX: -6,
  entranceVoidDepth: 7,

  canopyWidth: 8,
  canopyDepth: 2.8,
  canopyThickness: 0.32,
  columnRadius: 0.17,
  columnCount: 2,

  upperFrontSetback: 1,
  upperTerraceDepth: 5,
  upperParapetHeight: 1,

  cantileverDepth: 4,
  cantileverWidth: 11,

  stairWidth: 6,
  stairTreads: 5,
  stairGoing: 0.5,

  facadeSkinDepth: 0.24,
  facadeRevealGap: 0.09,
  frameWidth: 0.07,
  frameDepth: 0.1,
  glassThickness: 0.03,
  mullionSpacing: 1.6,

  finCount: 7,
  finWidth: 0.18,
  finDepth: 0.38,

  railingHeight: 1.05,
  railingPostSpacing: 2.4,

  soffitInset: 0.2,
  soffitDepth: 0.07,
};

/** Repeated facade elements thin out on weaker GPUs. */
const DETAIL: Record<DetailTier, { mullionScale: number; fins: number }> = {
  low: { mullionScale: 1.75, fins: 0 },
  medium: { mullionScale: 1.25, fins: 0.6 },
  high: { mullionScale: 1, fins: 1 },
};

/**
 * Distributes `count` openings of `width` evenly across a wall, inset from
 * both ends. Window positions therefore follow the villa's dimensions
 * rather than being placed by hand.
 */
function distribute(
  keyPrefix: string,
  across: Range,
  y: Range,
  count: number,
  width: number,
  margin: number,
  options: Partial<WallOpening> = {},
): WallOpening[] {
  const usable = span(across) - margin * 2;
  const step = usable / count;
  return Array.from({ length: count }, (_, index) => {
    const centre = across[0] + margin + step * (index + 0.5);
    return {
      key: `${keyPrefix}-${index}`,
      kind: 'window',
      across: [centre - width / 2, centre + width / 2] as Range,
      y,
      solidBehind: true,
      ...options,
    };
  });
}

/**
 * Resolves a configuration into the complete building. Pure and deterministic:
 * the same config always produces the same layout, so callers can memoise it.
 */
export function createVillaLayout(
  config: VillaConfig = VILLA_CONFIG,
  detail: DetailTier = 'high',
): VillaLayout {
  const tier = DETAIL[detail];
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  // ── Levels ────────────────────────────────────────────────────────────
  const groundY = config.foundationHeight;
  const groundFloorTopY = groundY + config.groundFloorHeight;
  const upperFloorY = groundFloorTopY + config.slabThickness;
  const upperFloorTopY = upperFloorY + config.upperFloorHeight;
  const roofTopY = upperFloorTopY + config.roofThickness;

  // ── Plan lines ────────────────────────────────────────────────────────
  const rearZ = -halfD;
  const gfFrontZ = halfD - config.terraceDepth;
  const westWingEastX = -halfW + config.westWingWidth;
  const eastWingWestX = halfW - config.eastWingWidth;

  const entX1 = config.entranceOffsetX - config.entranceWidth / 2;
  const entX2 = config.entranceOffsetX + config.entranceWidth / 2;
  const entranceBackZ = gfFrontZ - config.entranceRecess;
  const entranceVoidBackZ = gfFrontZ - config.entranceVoidDepth;

  const livingGlassZ = gfFrontZ - config.glazingInset;
  const livingGlassX1 = entX2 + config.wallThickness;

  const upperFrontZ = gfFrontZ - config.upperFrontSetback;
  const upperWestFrontZ = gfFrontZ - config.upperTerraceDepth;
  const cantileverX1 = halfW - config.cantileverWidth;
  const cantileverFrontZ = gfFrontZ + config.cantileverDepth;

  const plinthX: Range = [-halfW - config.foundationMargin, halfW + config.foundationMargin];
  const plinthZ: Range = [-halfD - config.foundationMargin, halfD + config.foundationMargin];
  const plinthFrontZ = plinthZ[1];

  const canopyX1 = config.entranceOffsetX - config.canopyWidth / 2;
  const canopyX2 = config.entranceOffsetX + config.canopyWidth / 2;
  const canopyFrontZ = gfFrontZ + config.canopyDepth;

  const ov = config.roofOverhang;
  const t = config.wallThickness;
  // Slab bands sit slightly proud of the volumes above to read as a shadow line.
  const reveal = 0.15;
  // Keeps stacked elements off each other's faces, avoiding depth flicker.
  const inset = 0.15;

  // ── Foundation ────────────────────────────────────────────────────────
  const foundation = {
    plinth: [box('plinth', plinthX, [0.25, groundY], plinthZ)],
    // Inset dark base so the plinth reads as floating above the terrain.
    reveal: [
      box(
        'plinth-reveal',
        [plinthX[0] + 0.4, plinthX[1] - 0.4],
        [0, 0.25],
        [plinthZ[0] + 0.4, plinthZ[1] - 0.4],
      ),
    ],
  };

  // ── Ground floor ──────────────────────────────────────────────────────
  const gfY: Range = [groundY, groundFloorTopY];

  const groundFloor = {
    mass: [
      box('gf-rear-bar', [-halfW, halfW], gfY, [rearZ, rearZ + config.rearBarDepth]),
      box('gf-west-wing', [-halfW, westWingEastX], gfY, [rearZ + config.rearBarDepth, gfFrontZ]),
      box('gf-east-wing', [eastWingWestX, halfW], gfY, [rearZ + config.rearBarDepth, gfFrontZ]),
    ],
    // Solid spandrel behind the recessed living glazing, plus its head beam.
    recess: [
      box(
        'gf-living-head',
        [livingGlassX1, eastWingWestX],
        [gfY[1] - 0.35, gfY[1]],
        [livingGlassZ - 0.2, livingGlassZ + 0.2],
      ),
      box(
        'gf-living-sill',
        [livingGlassX1, eastWingWestX],
        [groundY, groundY + 0.12],
        [livingGlassZ - 0.2, gfFrontZ],
      ),
    ],
    // Two full-height blades frame the entrance; the canopy covers the arrival.
    entrance: [
      box(
        'entrance-fin-west',
        [entX1, entX1 + t],
        [groundY, upperFloorTopY],
        [entranceBackZ, gfFrontZ],
      ),
      box(
        'entrance-fin-east',
        [entX2 - t, entX2],
        [groundY, upperFloorTopY],
        [entranceBackZ, gfFrontZ],
      ),
      box(
        'entrance-threshold',
        [entX1, entX2],
        [groundY, groundY + 0.1],
        [entranceBackZ, gfFrontZ],
      ),
      box(
        'entrance-canopy',
        [canopyX1, canopyX2],
        [groundFloorTopY, groundFloorTopY + config.canopyThickness],
        [entranceBackZ, canopyFrontZ],
      ),
    ],
  };

  // ── Upper floor ───────────────────────────────────────────────────────
  const upY: Range = [upperFloorY, upperFloorTopY];
  const slabY: Range = [groundFloorTopY, upperFloorY];

  const upperFloor = {
    mass: [
      box('up-west', [-halfW, entX1], upY, [rearZ, upperWestFrontZ]),
      box('up-link', [entX1, entX2], upY, [rearZ, entranceVoidBackZ]),
      box('up-east', [entX2, halfW], upY, [rearZ, upperFrontZ]),
    ],
    cantilever: [box('up-cantilever', [cantileverX1, halfW], upY, [upperFrontZ, cantileverFrontZ])],
    slab: [
      box('slab-west', [-halfW - reveal, entX1], slabY, [rearZ - reveal, upperWestFrontZ + reveal]),
      box('slab-link', [entX1, entX2], slabY, [rearZ - reveal, entranceVoidBackZ]),
      box('slab-east', [entX2, halfW + reveal], slabY, [rearZ - reveal, upperFrontZ + reveal]),
      box('slab-cantilever', [cantileverX1, halfW + reveal], slabY, [
        upperFrontZ,
        cantileverFrontZ + reveal,
      ]),
    ],
    // Roof terrace carved out of the west volume, held by a low parapet.
    terrace: [box('up-terrace-deck', [-halfW, entX1], slabY, [upperWestFrontZ, gfFrontZ])],
  };

  // ── Roof ──────────────────────────────────────────────────────────────
  const roofY: Range = [upperFloorTopY, roofTopY];
  const parapetY: Range = [roofTopY, roofTopY + config.roofParapetHeight];

  const roof = {
    slabs: [
      box('roof-west', [-halfW - ov, entX1], roofY, [rearZ - ov, upperWestFrontZ + ov]),
      box('roof-link', [entX1, entX2], roofY, [rearZ - ov, entranceVoidBackZ]),
      box('roof-east', [entX2, halfW + ov], roofY, [rearZ - ov, upperFrontZ + ov]),
      box('roof-cantilever', [cantileverX1, halfW + ov], roofY, [
        upperFrontZ + ov,
        cantileverFrontZ + ov,
      ]),
    ],
    parapets: [
      box('roof-parapet-rear', [-halfW - ov + inset, halfW + ov - inset], parapetY, [
        rearZ - ov + inset,
        rearZ - ov + inset + 0.2,
      ]),
      box('roof-parapet-east', [halfW + ov - inset - 0.2, halfW + ov - inset], parapetY, [
        rearZ - ov + inset,
        cantileverFrontZ + ov - inset,
      ]),
    ],
  };

  // ── Terrace ───────────────────────────────────────────────────────────
  const terrace = {
    deck: [
      box(
        'terrace-deck',
        [-halfW, halfW],
        [groundY, groundY + 0.12],
        [gfFrontZ, plinthFrontZ - 0.2],
      ),
    ],
    trim: [
      box(
        'terrace-edge',
        [-halfW, halfW],
        [groundY - 0.06, groundY + 0.12],
        [plinthFrontZ - 0.2, plinthFrontZ],
      ),
    ],
  };

  // ── Facade schedule ───────────────────────────────────────────────────
  // Each wall names its structural face and the openings punched into it;
  // the builder turns that into skin, frames, mullions, glass, and doors.
  const gfWallY: Range = [groundY, groundFloorTopY];
  const upWallY: Range = [upperFloorY, upperFloorTopY];
  const livingY: Range = [groundY + 0.12, groundFloorTopY - 0.35];
  const upperGlassY: Range = [upperFloorY + 0.2, upperFloorTopY - 0.25];

  const walls: FacadeWall[] = [
    // Living volume opening onto the terrace — the main sliding door.
    {
      key: 'living-front',
      axis: 'z',
      facing: 1,
      face: livingGlassZ,
      across: [livingGlassX1, eastWingWestX],
      y: livingY,
      skin: false,
      openings: [
        {
          key: 'living-slider',
          kind: 'sliding',
          across: [livingGlassX1, eastWingWestX],
          y: livingY,
          solidBehind: false,
        },
      ],
    },
    // The entrance sits at the back of the three-metre recess.
    {
      key: 'entrance',
      axis: 'z',
      facing: 1,
      face: entranceBackZ,
      across: [entX1 + t, entX2 - t],
      y: [groundY + 0.1, groundFloorTopY],
      skin: false,
      openings: [
        {
          key: 'entrance-door',
          kind: 'entrance',
          across: [entX1 + t, entX2 - t],
          y: [groundY + 0.1, groundFloorTopY],
          solidBehind: false,
        },
      ],
    },
    // East ground floor: privacy-oriented, smaller and higher-silled.
    {
      key: 'gf-east',
      axis: 'x',
      facing: 1,
      face: halfW,
      across: [rearZ + config.rearBarDepth, gfFrontZ],
      y: gfWallY,
      skin: true,
      stone: true,
      openings: distribute(
        'gf-east-window',
        [rearZ + config.rearBarDepth, gfFrontZ],
        [groundY + 0.9, groundFloorTopY - 0.7],
        3,
        1.1,
        0.9,
        { mullions: 0 },
      ),
    },
    // West ground floor: one broad opening to the afternoon side.
    {
      key: 'gf-west',
      axis: 'x',
      facing: -1,
      face: -halfW,
      across: [rearZ + config.rearBarDepth, gfFrontZ],
      y: gfWallY,
      skin: true,
      stone: true,
      openings: [
        {
          key: 'gf-west-window',
          kind: 'window',
          across: [rearZ + config.rearBarDepth + 1.4, gfFrontZ - 1.4],
          y: [groundY + 0.14, groundFloorTopY - 0.6],
          solidBehind: true,
        },
      ],
    },
    // Rear ground floor: a service elevation, evenly punched.
    {
      key: 'gf-rear',
      axis: 'z',
      facing: -1,
      face: rearZ,
      across: [-halfW, halfW],
      y: gfWallY,
      skin: true,
      openings: distribute(
        'gf-rear-window',
        [-halfW, halfW],
        [groundY + 0.9, groundFloorTopY - 0.7],
        4,
        1.8,
        1.6,
      ),
    },
    // Upper front, between the entrance void and the cantilever.
    {
      key: 'up-front',
      axis: 'z',
      facing: 1,
      face: upperFrontZ,
      across: [entX2, cantileverX1],
      y: upWallY,
      skin: true,
      openings: [
        {
          key: 'up-front-window',
          kind: 'window',
          across: [entX2 + 0.5, cantileverX1 - 0.5],
          y: upperGlassY,
          solidBehind: true,
        },
      ],
    },
    // The cantilever front is the hero elevation: full-height glazing.
    {
      key: 'cantilever-front',
      axis: 'z',
      facing: 1,
      face: cantileverFrontZ,
      across: [cantileverX1, halfW],
      y: upWallY,
      skin: true,
      openings: [
        {
          key: 'cantilever-window',
          kind: 'window',
          across: [cantileverX1 + 0.45, halfW - 0.45],
          y: upperGlassY,
          solidBehind: true,
        },
      ],
    },
    {
      key: 'cantilever-east',
      axis: 'x',
      facing: 1,
      face: halfW,
      across: [upperFrontZ, cantileverFrontZ],
      y: upWallY,
      skin: true,
      openings: [
        {
          key: 'cantilever-east-window',
          kind: 'window',
          across: [upperFrontZ + 0.45, cantileverFrontZ - 0.45],
          y: upperGlassY,
          solidBehind: true,
        },
      ],
    },
    // Upper east band, shaded by the fins added in the facade group.
    {
      key: 'up-east',
      axis: 'x',
      facing: 1,
      face: halfW,
      across: [rearZ, upperFrontZ],
      y: upWallY,
      skin: true,
      openings: distribute(
        'up-east-window',
        [rearZ, upperFrontZ],
        [upperFloorY + 0.65, upperFloorTopY - 0.65],
        3,
        2.6,
        1.2,
      ),
    },
    // Upper west opens onto the roof terrace through a second slider.
    {
      key: 'up-west-terrace',
      axis: 'z',
      facing: 1,
      face: upperWestFrontZ,
      across: [-halfW, entX1],
      y: upWallY,
      skin: true,
      openings: [
        {
          key: 'up-terrace-slider',
          kind: 'sliding',
          across: [-halfW + 0.8, entX1 - 0.8],
          y: [upperFloorY + 0.2, upperFloorTopY - 0.45],
          solidBehind: true,
        },
      ],
    },
    {
      key: 'up-rear',
      axis: 'z',
      facing: -1,
      face: rearZ,
      across: [-halfW, halfW],
      y: upWallY,
      skin: true,
      openings: distribute(
        'up-rear-window',
        [-halfW, halfW],
        [upperFloorY + 0.65, upperFloorTopY - 0.75],
        4,
        2.2,
        1.6,
      ),
    },
  ];

  const openings = buildOpenings(walls, {
    skinDepth: config.facadeSkinDepth,
    revealGap: config.facadeRevealGap,
    frameWidth: config.frameWidth,
    frameDepth: config.frameDepth,
    glassThickness: config.glassThickness,
    mullionSpacing: config.mullionSpacing * tier.mullionScale,
  });

  // ── Facade detailing ──────────────────────────────────────────────────
  const skin = config.facadeSkinDepth;
  const si = config.soffitInset;
  const sd = config.soffitDepth;

  // Vertical fins shade the upper east band and give that elevation rhythm.
  const finCount = Math.round(config.finCount * tier.fins);
  const finRun: Range = [rearZ + 1, upperFrontZ - 1];
  const fins: BoxSpec[] = Array.from({ length: finCount }, (_, index) => {
    const step = span(finRun) / finCount;
    const at = finRun[0] + step * (index + 0.5);
    return box(
      `fin-east-${index}`,
      [halfW + skin, halfW + skin + config.finDepth],
      [upperFloorY, upperFloorTopY],
      [at - config.finWidth / 2, at + config.finWidth / 2],
    );
  });

  // Soffits separate the horizontal planes and darken every underside.
  const soffits: BoxSpec[] = [
    box(
      'soffit-canopy',
      [canopyX1 + si, canopyX2 - si],
      [groundFloorTopY - sd, groundFloorTopY],
      [entranceBackZ + si, canopyFrontZ - si],
    ),
    box(
      'soffit-cantilever',
      [cantileverX1 + si, halfW + reveal - si],
      [groundFloorTopY - sd, groundFloorTopY],
      [upperFrontZ + si, cantileverFrontZ + reveal - si],
    ),
    box(
      'soffit-roof-east',
      [halfW + skin, halfW + ov - si],
      [upperFloorTopY - sd, upperFloorTopY],
      [rearZ - ov + si, upperFrontZ],
    ),
    box(
      'soffit-roof-cantilever',
      [cantileverX1 + si, halfW + ov - si],
      [upperFloorTopY - sd, upperFloorTopY],
      [cantileverFrontZ, cantileverFrontZ + ov - si],
    ),
    box(
      'soffit-roof-rear',
      [-halfW - ov + si, halfW + ov - si],
      [upperFloorTopY - sd, upperFloorTopY],
      [rearZ - ov + si, rearZ - skin],
    ),
  ];

  // Caps and shadow gaps that keep large planes from reading as slabs.
  const reveals: BoxSpec[] = [
    box(
      'parapet-cap-rear',
      [-halfW - ov + inset - 0.04, halfW + ov - inset + 0.04],
      [roofTopY + config.roofParapetHeight, roofTopY + config.roofParapetHeight + 0.07],
      [rearZ - ov + inset - 0.04, rearZ - ov + inset + 0.24],
    ),
    box(
      'parapet-cap-east',
      [halfW + ov - inset - 0.24, halfW + ov - inset + 0.04],
      [roofTopY + config.roofParapetHeight, roofTopY + config.roofParapetHeight + 0.07],
      [rearZ - ov + inset - 0.04, cantileverFrontZ + ov - inset + 0.04],
    ),
    box(
      'reveal-terrace-gap',
      [-halfW, halfW],
      [groundY + 0.12, groundY + 0.2],
      [gfFrontZ - 0.06, gfFrontZ],
    ),
  ];

  // ── Railings ──────────────────────────────────────────────────────────
  // Glass balustrades replace solid parapets on the roof terrace.
  const railBase = upperFloorY;
  const railTop = railBase + config.railingHeight;
  const glassTop = railTop - 0.07;
  const railRuns: { key: string; axis: 'x' | 'z'; at: number; run: Range }[] = [
    { key: 'terrace-front', axis: 'z', at: gfFrontZ - 0.09, run: [-halfW, entX1] },
    { key: 'terrace-west', axis: 'x', at: -halfW + 0.09, run: [upperWestFrontZ, gfFrontZ] },
    { key: 'terrace-void', axis: 'x', at: entX1 - 0.09, run: [upperWestFrontZ, gfFrontZ] },
  ];

  const railings: VillaLayout['railings'] = { glass: [], rails: [], posts: [] };

  railRuns.forEach(({ key, axis, at, run }) => {
    const along = (a: Range, thickness: number): [Range, Range] =>
      axis === 'z'
        ? [a, [at - thickness / 2, at + thickness / 2]]
        : [[at - thickness / 2, at + thickness / 2], a];

    const [gx, gz] = along(run, 0.024);
    railings.glass.push(box(`rail-glass-${key}`, gx, [railBase + 0.06, glassTop], gz));

    const [rx, rz] = along(run, 0.07);
    railings.rails.push(box(`rail-top-${key}`, rx, [glassTop, railTop], rz));
    railings.rails.push(box(`rail-base-${key}`, rx, [railBase, railBase + 0.09], rz));

    const posts = Math.max(2, Math.round(span(run) / config.railingPostSpacing) + 1);
    for (let i = 0; i < posts; i += 1) {
      const p = run[0] + (span(run) * i) / (posts - 1);
      const edge = i === 0 ? 0.03 : i === posts - 1 ? -0.03 : 0;
      const [px, pz] = along([p + edge - 0.03, p + edge + 0.03], 0.06);
      railings.posts.push(box(`rail-post-${key}-${i}`, px, [railBase, railTop], pz));
    }
  });

  // ── Columns ───────────────────────────────────────────────────────────
  const columnZ = canopyFrontZ - 0.5;
  const columns: ColumnSpec[] = Array.from({ length: config.columnCount }, (_, index) => {
    const ratio = config.columnCount === 1 ? 0.5 : index / (config.columnCount - 1);
    const x = canopyX1 + (canopyX2 - canopyX1) * ratio;
    return column(`column-${index}`, x, columnZ, [groundY, groundFloorTopY], config.columnRadius);
  });

  // ── Stairs ────────────────────────────────────────────────────────────
  const stairX1 = config.entranceOffsetX - config.stairWidth / 2;
  const stairX2 = config.entranceOffsetX + config.stairWidth / 2;
  const rise = groundY / config.stairTreads;
  const stairs: BoxSpec[] = Array.from({ length: config.stairTreads }, (_, index) => {
    const z1 = plinthFrontZ + index * config.stairGoing;
    return box(
      `stair-${index}`,
      [stairX1, stairX2],
      [0, groundY - index * rise],
      [z1, z1 + config.stairGoing],
    );
  });

  return {
    plan: {
      halfWidth: halfW,
      halfDepth: halfD,
      frontZ: gfFrontZ,
      plinthFrontZ,
      terraceFrontZ: plinthFrontZ - 0.2,
      plinthHalfWidth: halfW + config.foundationMargin,
      groundY,
      entranceOffsetX: config.entranceOffsetX,
      entranceStairsX: [stairX1, stairX2],
      entranceStairsOuterZ: plinthFrontZ + config.stairTreads * config.stairGoing,
      livingAxisX: [livingGlassX1, eastWingWestX],
      cantileverAxisX: [cantileverX1, halfW],
    },
    foundation,
    groundFloor,
    upperFloor,
    roof,
    terrace,
    openings,
    facade: { fins, soffits, reveals },
    railings,
    columns,
    stairs,
    levels: { groundY, groundFloorTopY, upperFloorY, upperFloorTopY, roofTopY },
  };
}

type VillaGeometries = {
  box: BoxGeometry;
  column: CylinderGeometry;
};

let geometryCache: VillaGeometries | null = null;

/**
 * Two unit primitives shared by every mesh in the villa — each spec is
 * applied as a transform, so the building costs two geometry allocations
 * rather than one per volume.
 */
export function getVillaGeometries(): VillaGeometries {
  geometryCache ??= {
    box: new BoxGeometry(1, 1, 1),
    column: new CylinderGeometry(1, 1, 1, 12),
  };
  return geometryCache;
}

/** Releases the shared primitives when the experience unmounts. */
export function disposeVillaGeometries(): void {
  if (!geometryCache) return;
  for (const geometry of Object.values(geometryCache)) geometry.dispose();
  geometryCache = null;
}
