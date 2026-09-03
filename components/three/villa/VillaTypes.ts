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

/**
 * A void punched through a wall — a window, a door, or a room-to-room
 * opening. `across` runs along the wall's own length, exactly as
 * `WallOpening.across` does on the facade schedule.
 */
export type WallGap = {
  across: Range;
  y: Range;
};

/**
 * Which of an enclosure's four faces to build. `false` omits a side
 * entirely — used where one volume opens straight into the next; an array
 * gives the voids to punch through it; omitting a key builds it solid.
 */
export type ShellSides = {
  /** −X face. */
  west?: readonly WallGap[] | false;
  /** +X face. */
  east?: readonly WallGap[] | false;
  /** −Z face. */
  north?: readonly WallGap[] | false;
  /** +Z face. */
  south?: readonly WallGap[] | false;
};

/** An axis-aligned volume, resolved to a unit-cube transform. */
export type BoxSpec = {
  key: string;
  position: Vector3Tuple;
  scale: Vector3Tuple;
  /**
   * Rotation about the vertical axis, in radians, applied about the
   * volume's own centre.
   *
   * Optional, and absent almost everywhere on purpose: a building is
   * orthogonal, and the villa, the site and the interior fabric are all
   * written as bounds on world axes because that is what they are. It
   * exists for the things in a room that are *not* — an armchair turned
   * toward the view, a stool pushed out from under a table. Nothing in a
   * furnished room sits at exactly ninety degrees to everything else, and
   * a whole house where everything does is one of the quieter reasons an
   * interior reads as generated rather than photographed.
   */
  rotationY?: number;
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

  // ── Interior plan lines ─────────────────────────────────────────────
  // Exposed so the interior layout derives every room boundary from the
  // building that actually exists, rather than restating its dimensions.

  /** Structural wall thickness, and so the depth of every enclosure face. */
  wallThickness: number;
  /** Front face of the rear service bar — the back of the living volume. */
  rearBarFrontZ: number;
  /** East face of the west wing. */
  westWingEastX: number;
  /** West face of the east wing. */
  eastWingWestX: number;
  /** X extent of the entrance slot, between the two full-height blades. */
  entranceX: Range;
  /** Z of the entrance door itself, at the back of the arrival recess. */
  entranceBackZ: number;
  /** Z at which the two-storey entrance slot stops. */
  entranceVoidBackZ: number;
  /** Z of the living-room sliding glazing. */
  livingGlassZ: number;
  /** Front face of the upper east volume. */
  upperFrontZ: number;
  /** Front face of the upper west volume, at the roof terrace. */
  upperWestFrontZ: number;
  /** Z extent of the cantilevered upper volume. */
  cantileverZ: Range;
};

/** Derived floor levels other systems — camera, interiors — build against. */
export type VillaLevels = {
  groundY: number;
  groundFloorTopY: number;
  upperFloorY: number;
  upperFloorTopY: number;
  roofTopY: number;
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
  levels: VillaLevels;
};
