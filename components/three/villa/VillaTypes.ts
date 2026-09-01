import type { Vector3Tuple } from 'three';

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
};

/** An axis-aligned volume, resolved to a unit-cube transform. */
export type BoxSpec = {
  key: string;
  position: Vector3Tuple;
  scale: Vector3Tuple;
};

/** A flat glazing surface, resolved to a unit-plane transform. */
export type PanelSpec = {
  key: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

/** A vertical structural support, resolved to a unit-cylinder transform. */
export type ColumnSpec = {
  key: string;
  position: Vector3Tuple;
  scale: Vector3Tuple;
};

/**
 * The fully resolved building. Groups mirror the scene-graph hierarchy so a
 * later phase can address any part of the villa by name.
 */
export type VillaLayout = {
  foundation: { plinth: BoxSpec[]; reveal: BoxSpec[] };
  groundFloor: { mass: BoxSpec[]; recess: BoxSpec[]; entrance: BoxSpec[] };
  upperFloor: { mass: BoxSpec[]; cantilever: BoxSpec[]; slab: BoxSpec[]; terrace: BoxSpec[] };
  roof: { slabs: BoxSpec[]; parapets: BoxSpec[] };
  terrace: { deck: BoxSpec[]; trim: BoxSpec[] };
  glazing: {
    /** Glass spanning a genuine void between volumes — reads through. */
    openings: PanelSpec[];
    /** Glass applied to the face of a solid volume — reads as a window. */
    surfaces: PanelSpec[];
  };
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
