import type { Vector3Tuple } from 'three';
import type { OpeningsGeometry } from './openings/OpeningTypes';

/** An inclusive pair of bounds on one axis. */
export type Range = readonly [number, number];

/** Detail level for repeated facade elements, driven by the quality tier. */
export type DetailTier = 'low' | 'medium' | 'high';

/**
 * Every dimension of the residence, in metres. Phase 3's configurator will
 * hand a partial override of this object to `createVillaLayout` — nothing
 * downstream reads a hard-coded number.
 */
export type VillaConfig = {
  /** Building envelope on X. */
  width: number;
  /** Building envelope on Z. Front elevation faces +Z. */
  depth: number;

  foundationHeight: number;
  /** How far the plinth extends beyond the building envelope. */
  foundationMargin: number;

  groundFloorHeight: number;
  upperFloorHeight: number;
  slabThickness: number;
  wallThickness: number;

  roofThickness: number;
  roofOverhang: number;
  roofParapetHeight: number;

  /** Open terrace depth taken out of the front of the envelope. */
  terraceDepth: number;
  /** Solid service bar across the rear of the ground floor. */
  rearBarDepth: number;
  westWingWidth: number;
  eastWingWidth: number;
  /** How far the living-room glazing sits behind the wing faces. */
  glazingInset: number;

  entranceWidth: number;
  entranceRecess: number;
  /** X centre of the entrance slot; negative sits it west of centre. */
  entranceOffsetX: number;
  /** Depth of the two-storey slot cut above the entrance. */
  entranceVoidDepth: number;

  canopyWidth: number;
  canopyDepth: number;
  canopyThickness: number;
  columnRadius: number;
  columnCount: number;

  /** How far the upper volume stops short of the ground-floor front. */
  upperFrontSetback: number;
  /** Roof-terrace depth carved out of the upper west volume. */
  upperTerraceDepth: number;
  upperParapetHeight: number;

  /** Projection of the upper volume past the ground-floor front. */
  cantileverDepth: number;
  cantileverWidth: number;

  stairWidth: number;
  stairTreads: number;
  stairGoing: number;

  // ── Facade detailing ────────────────────────────────────────────────
  /** Thickness of the punched facade layer, and so the window recess depth. */
  facadeSkinDepth: number;
  /** Shadow line left beneath each skin panel. */
  facadeRevealGap: number;
  frameWidth: number;
  frameDepth: number;
  glassThickness: number;
  /** Target spacing between vertical mullions, before the detail tier. */
  mullionSpacing: number;

  finCount: number;
  finWidth: number;
  finDepth: number;

  railingHeight: number;
  railingPostSpacing: number;

  soffitInset: number;
  soffitDepth: number;
};

/** An axis-aligned volume, resolved to a unit-cube transform. */
export type BoxSpec = {
  key: string;
  position: Vector3Tuple;
  scale: Vector3Tuple;
};

/** A vertical structural support, resolved to a unit-cylinder transform. */
export type ColumnSpec = {
  key: string;
  position: Vector3Tuple;
  scale: Vector3Tuple;
};

/**
 * Key plan lines derived from the villa envelope. Exposed so systems built
 * around the villa — the site, later a landscape — can position themselves
 * from the villa's actual geometry instead of guessing coordinates.
 */
export type VillaPlan = {
  halfWidth: number;
  halfDepth: number;
  /** Ground-floor / living-glass front line. */
  frontZ: number;
  /** Outer edge of the plinth — where the paved terrace gives way to site. */
  plinthFrontZ: number;
  /** Outer edge of the terrace deck itself (just inside the plinth edge). */
  terraceFrontZ: number;
  plinthHalfWidth: number;
  groundY: number;
  entranceOffsetX: number;
  /** X extent of the existing front-door approach stairs. */
  entranceStairsX: Range;
  /** Z at which the existing approach stairs meet grade. */
  entranceStairsOuterZ: number;
  /** X extent of the living-room sliding door. */
  livingAxisX: Range;
  /** X extent of the upper-floor cantilever above. */
  cantileverAxisX: Range;
};

/**
 * The fully resolved building. Groups mirror the scene-graph hierarchy so a
 * later phase can address any part of the villa by name.
 */
export type VillaLayout = {
  plan: VillaPlan;
  foundation: { plinth: BoxSpec[]; reveal: BoxSpec[] };
  groundFloor: { mass: BoxSpec[]; recess: BoxSpec[]; entrance: BoxSpec[] };
  upperFloor: { mass: BoxSpec[]; cantilever: BoxSpec[]; slab: BoxSpec[]; terrace: BoxSpec[] };
  roof: { slabs: BoxSpec[]; parapets: BoxSpec[] };
  terrace: { deck: BoxSpec[]; trim: BoxSpec[] };
  /** Frames, glazing, doors, and the punched facade skin. */
  openings: OpeningsGeometry;
  /** Fins, soffits, and reveals that give the elevations depth. */
  facade: { fins: BoxSpec[]; soffits: BoxSpec[]; reveals: BoxSpec[] };
  /** Glass balustrades to the upper terrace. */
  railings: { glass: BoxSpec[]; rails: BoxSpec[]; posts: BoxSpec[] };
  columns: ColumnSpec[];
  stairs: BoxSpec[];
  /** Derived levels other systems (camera, future tours) may need. */
  levels: {
    groundY: number;
    groundFloorTopY: number;
    upperFloorY: number;
    upperFloorTopY: number;
    roofTopY: number;
  };
};
