import { BoxGeometry, CylinderGeometry, PlaneGeometry } from 'three';
import type { BoxSpec, ColumnSpec, PanelSpec, VillaConfig, VillaLayout } from './VillaTypes';

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
  entranceRecess: 3,
  entranceOffsetX: -6,
  entranceVoidDepth: 7,

  canopyWidth: 8,
  canopyDepth: 4,
  canopyThickness: 0.4,
  columnRadius: 0.24,
  columnCount: 3,

  upperFrontSetback: 1,
  upperTerraceDepth: 5,
  upperParapetHeight: 1,

  cantileverDepth: 4,
  cantileverWidth: 11,

  stairWidth: 6,
  stairTreads: 5,
  stairGoing: 0.5,
};

type Range = readonly [number, number];

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

/** Authors a volume by its bounds, which reads far closer to a section drawing. */
function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return {
    key,
    position: [mid(x), mid(y), mid(z)],
    scale: [span(x), span(y), span(z)],
  };
}

/** A glazing plane on the XY axis (facing ±Z) or YZ axis (facing ±X). */
function panel(key: string, axis: 'z' | 'x', at: number, across: Range, y: Range): PanelSpec {
  return axis === 'z'
    ? {
        key,
        position: [mid(across), mid(y), at],
        rotation: [0, 0, 0],
        scale: [span(across), span(y), 1],
      }
    : {
        key,
        position: [at, mid(y), mid(across)],
        rotation: [0, Math.PI / 2, 0],
        scale: [span(across), span(y), 1],
      };
}

function column(key: string, x: number, z: number, y: Range, radius: number): ColumnSpec {
  return { key, position: [x, mid(y), z], scale: [radius, span(y), radius] };
}

/**
 * Resolves a configuration into the complete building. Pure and deterministic:
 * the same config always produces the same layout, so callers can memoise it.
 */
export function createVillaLayout(config: VillaConfig = VILLA_CONFIG): VillaLayout {
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
    terrace: [
      box('up-terrace-deck', [-halfW, entX1], slabY, [upperWestFrontZ, gfFrontZ]),
      box(
        'up-terrace-parapet-west',
        [-halfW, -halfW + t],
        [upperFloorY, upperFloorY + config.upperParapetHeight],
        [upperWestFrontZ, gfFrontZ],
      ),
      box(
        'up-terrace-parapet-front',
        [-halfW, entX1],
        [upperFloorY, upperFloorY + config.upperParapetHeight],
        [gfFrontZ - t, gfFrontZ],
      ),
    ],
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

  // ── Glazing ───────────────────────────────────────────────────────────
  const glassInsetY: Range = [groundY + 0.12, groundFloorTopY - 0.35];
  const upperGlassY: Range = [upperFloorY + 0.15, upperFloorTopY - 0.15];

  const glazing = {
    openings: [
      panel('glass-living-front', 'z', livingGlassZ, [livingGlassX1, eastWingWestX], glassInsetY),
      panel(
        'glass-entrance-back',
        'z',
        entranceBackZ,
        [entX1 + t, entX2 - t],
        [groundY + 0.1, groundFloorTopY],
      ),
    ],
    surfaces: [
      panel(
        'glass-west-slot',
        'x',
        -halfW - 0.01,
        [rearZ + config.rearBarDepth + 1, gfFrontZ - 1],
        [groundY + 0.5, groundFloorTopY - 0.5],
      ),
      panel(
        'glass-east-slot',
        'x',
        halfW + 0.01,
        [rearZ + config.rearBarDepth + 1, gfFrontZ - 1],
        [groundY + 0.5, groundFloorTopY - 0.5],
      ),
      panel(
        'glass-upper-front',
        'z',
        upperFrontZ + 0.01,
        [entX2 + reveal, cantileverX1],
        upperGlassY,
      ),
      panel(
        'glass-cantilever-front',
        'z',
        cantileverFrontZ + 0.01,
        [cantileverX1 + reveal, halfW - reveal],
        upperGlassY,
      ),
      panel(
        'glass-cantilever-east',
        'x',
        halfW + 0.01,
        [upperFrontZ, cantileverFrontZ],
        upperGlassY,
      ),
      panel(
        'glass-upper-east-band',
        'x',
        halfW + 0.01,
        [rearZ + 1.5, upperFrontZ - 1.5],
        [upperFloorY + 0.9, upperFloorTopY - 0.5],
      ),
      panel(
        'glass-upper-west',
        'z',
        upperWestFrontZ + 0.01,
        [-halfW + 0.6, entX1 - 0.6],
        [upperFloorY + 0.9, upperFloorTopY - 0.5],
      ),
    ],
  };

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
    foundation,
    groundFloor,
    upperFloor,
    roof,
    terrace,
    glazing,
    columns,
    stairs,
    levels: { groundY, groundFloorTopY, upperFloorY, upperFloorTopY, roofTopY },
  };
}

type VillaGeometries = {
  box: BoxGeometry;
  panel: PlaneGeometry;
  column: CylinderGeometry;
};

let geometryCache: VillaGeometries | null = null;

/**
 * Three unit primitives shared by every mesh in the villa — each spec is
 * applied as a transform, so the building costs three geometry allocations
 * rather than one per volume.
 */
export function getVillaGeometries(): VillaGeometries {
  geometryCache ??= {
    box: new BoxGeometry(1, 1, 1),
    panel: new PlaneGeometry(1, 1),
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
