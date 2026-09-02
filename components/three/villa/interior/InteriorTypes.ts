import type { Vector3Tuple } from 'three';
import type { BoxSpec, DetailTier } from '../VillaTypes';
import type { Parts } from './Furniture';
import type { Room } from './InteriorPlan';

/**
 * A practical interior light, positioned by the architecture that implies
 * it. Deliberately minimal: no shadow map and no helper — just enough
 * bounce for rooms behind glass to read as inhabited.
 *
 * `intensity` is a relative weight, ranking this room against the others.
 * The absolute brightness, and whether the light is mounted at all, are
 * decided by the time-of-day state in `lib/three/lighting.ts`.
 */
export type InteriorLight = {
  key: string;
  position: Vector3Tuple;
  intensity: number;
  /** Falloff radius in metres, so one room's light never washes the next. */
  distance: number;
  color: string;
};

/**
 * Every interior dimension and density knob, in one place — the same
 * pattern as `VILLA_CONFIG`, `SITE_CONFIG`, and `LANDSCAPE_CONFIG`. A later
 * configurator hands a partial override of this to `createInteriorLayout`.
 */
export type InteriorConfig = {
  /**
   * Thickness of the finished floor build-up, drawn down from a room's
   * floor level onto the structural slab beneath it.
   */
  floorDepth: number;
  /** Thickness of the plaster ceiling under each soffit. */
  ceilingDepth: number;
  /** Height of glass balustrades at interior voids. */
  balustradeHeight: number;
  /** Number of risers in each of the stair's two flights. */
  stairRisersPerFlight: number;
  /** Tread depth of the stair. */
  stairGoing: number;
  /** Clear width of each stair flight. */
  stairFlightWidth: number;
  /** Distance a pendant shade hangs below the ceiling it is fixed to. */
  pendantDrop: number;
  /** Clearance kept between furniture and the wall behind it. */
  wallClearance: number;
};

/**
 * The fully resolved interior. Groups mirror the scene-graph hierarchy and,
 * like the villa's own layout, are sorted by material so each becomes a
 * single merged mesh.
 */
export type InteriorLayout = {
  rooms: readonly Room[];
  /** Honed stone floor finish, by room. */
  floorsStone: BoxSpec[];
  /** Timber floor finish, by room. */
  floorsTimber: BoxSpec[];
  ceilings: BoxSpec[];
  partitions: BoxSpec[];
  /** Feature-wall panelling and reveals in the principal rooms. */
  panelling: BoxSpec[];
  /** Treads, landings, and stringers of the internal stair. */
  stairs: BoxSpec[];
  /** The foyer's roof-level laylight, which is what daylights the entry. */
  laylight: { frame: BoxSpec[]; glass: BoxSpec[] };
  furniture: Parts;
  /** Every practical the plan implies, ranked; the hour decides how many run. */
  lights: InteriorLight[];
};

export type { DetailTier };
