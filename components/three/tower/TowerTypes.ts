import type { Vector3Tuple } from 'three';
import type { BoxSpec, ColumnSpec, Range } from '../villa/VillaTypes';

/**
 * Every dimension of the mixed-use tower, in metres.
 *
 * Same contract the villa's config keeps: nothing downstream holds a
 * hard-coded number, so the whole building can be re-proportioned from one
 * object. The storey counts are the brief — five of retail, fifteen of
 * apartments — and everything else is derived from them.
 */
export type TowerConfig = {
  /** Retail podium envelope on X. */
  podiumWidth: number;
  /** Retail podium envelope on Z. The ocean elevation faces +X. */
  podiumDepth: number;
  podiumLevels: number;
  podiumLevelHeight: number;
  /** Depth of the projecting slab band that rings each retail floor. */
  podiumBandDepth: number;
  podiumBandHeight: number;
  /** How far the glazed shopfront line sits behind the band face. */
  shopfrontInset: number;
  /** Plan of the retail atrium void, as bounds on X and Z. */
  atriumX: Range;
  atriumZ: Range;
  /** Height of the glass balustrade at each atrium edge. */
  atriumBalustradeHeight: number;

  /** Residential tower envelope on X. */
  towerWidth: number;
  /** Residential tower envelope on Z. */
  towerDepth: number;
  towerLevels: number;
  towerLevelHeight: number;
  /** Tower centre on X, relative to the podium centre. */
  towerOffsetX: number;
  /** Projection of each residential floor plate past the glass line. */
  slabProjection: number;
  slabThickness: number;

  /** Depth of the balconies on the ocean elevation. */
  balconyDepth: number;
  balustradeHeight: number;
  /** Bays of glazing between vertical fins, across the tower's width. */
  bayCount: number;
  finWidth: number;
  finDepth: number;

  /** Solid service blade at the landward end of the tower. */
  coreWidth: number;
  /** Which residential level the walkthrough enters, and so the one dressed. */
  furnishedLevel: number;
  /** Plan radius at the tower's corners. Zero gives a square building. */
  cornerRadius: number;
  /** Levels at which the tower steps in, and by how much on each side. */
  setbacks: readonly { level: number; inset: number }[];
  /** Height of the parapet and lit band above the top floor. */
  crownHeight: number;

  /** Colonnade at the retail entrance. */
  columnRadius: number;
  columnCount: number;

  /** Amenity deck on the podium roof. */
  deckParapetHeight: number;
  poolLength: number;
  poolWidth: number;
  poolDepth: number;
};

/**
 * A palm, resolved to the few numbers its geometry needs. Kept as data
 * rather than as a component so the whole planting scheme is one array that
 * can be merged into a handful of draw calls.
 */
export type PalmSpec = {
  key: string;
  /** Base of the trunk. */
  position: Vector3Tuple;
  trunkHeight: number;
  trunkRadius: number;
  /** How far the trunk leans, in radians, and which way. */
  lean: number;
  leanAngle: number;
  frondCount: number;
  frondLength: number;
  /** Deterministic per-tree seed, so a palm is the same palm every mount. */
  seed: number;
};

/**
 * Key plan lines derived from the tower envelope, exposed so the shoreline
 * and the camera work from the building that exists rather than restating
 * its dimensions.
 */
export type TowerPlan = {
  podiumX: Range;
  podiumZ: Range;
  podiumTopY: number;
  towerX: Range;
  towerZ: Range;
  towerBaseY: number;
  towerTopY: number;
  crownTopY: number;
  /** Ocean-facing face of the podium — where the deck stops and the beach begins. */
  seaFrontX: number;
  /** The amenity deck's landward edge, at the face of the tower. */
  deckBackX: number;
  levelHeight: number;
  /** The residential level the walkthrough enters, and so the fitted one. */
  furnishedLevel: number;
  /** Finished floor and ceiling of that level, which the fit-out builds to. */
  furnishedFloorY: number;
  furnishedCeilingY: number;
  /** Bounds of the glazed floor plate, inside the service core. */
  glazedX: Range;
  /** World Y of the floor slab for a given residential level, 0-indexed. */
  levelY: (level: number) => number;
};

/** The fully resolved building, grouped by material rather than by storey. */
export type TowerLayout = {
  plan: TowerPlan;
  podium: {
    /** The perimeter shell — the wall behind the shopfronts. */
    mass: BoxSpec[];
    /** Retail floor plates, each one a ring around the atrium void. */
    floors: BoxSpec[];
    bands: BoxSpec[];
    glazing: BoxSpec[];
    mullions: BoxSpec[];
    soffits: BoxSpec[];
    signage: BoxSpec[];
    /** Glass balustrades at every atrium edge. */
    balustrades: BoxSpec[];
    /** Capping rails on those balustrades. */
    rails: BoxSpec[];
    /** The roof light over the atrium, set into the amenity deck. */
    skylight: BoxSpec[];
    /** Lit ceiling coves washing each retail floor. */
    coves: BoxSpec[];
  };
  columns: ColumnSpec[];
  tower: {
    core: BoxSpec[];
    /** The expressed slab edge, wrapping all four elevations. */
    slabs: BoxSpec[];
    /** The floor plates themselves — what an apartment stands on. */
    plates: BoxSpec[];
    /** Plaster soffits under each plate. A ceiling is not polished stone. */
    ceilings: BoxSpec[];
    glazing: BoxSpec[];
    fins: BoxSpec[];
    spandrels: BoxSpec[];
  };
  balconies: { slabs: BoxSpec[]; glass: BoxSpec[]; rails: BoxSpec[] };
  crown: { parapets: BoxSpec[]; glow: BoxSpec[] };
  deck: {
    paving: BoxSpec[];
    parapet: BoxSpec[];
    glass: BoxSpec[];
    planters: BoxSpec[];
    poolShell: BoxSpec[];
    water: BoxSpec[];
    furniture: BoxSpec[];
  };
  palms: PalmSpec[];
};

/** The beach, the boardwalk and the sea, as flat plates and planting. */
export type ShorelineLayout = {
  boardwalk: BoxSpec[];
  steps: BoxSpec[];
  /** Sand, shallows and open water, as [width, depth, centreX] plates. */
  beachX: Range;
  shallowsX: Range;
  oceanX: Range;
  spanZ: number;
  palms: PalmSpec[];
  loungers: BoxSpec[];
  parasols: BoxSpec[];
};
