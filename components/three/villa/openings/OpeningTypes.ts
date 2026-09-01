import type { BoxSpec, ColumnSpec, Range } from '../VillaTypes';

/** Which world axis a wall face is perpendicular to. */
export type FaceAxis = 'x' | 'z';

export type OpeningKind = 'window' | 'sliding' | 'entrance';

/**
 * A hole in a wall. `across` runs along the wall — X for a wall facing ±Z,
 * Z for a wall facing ±X — so one description covers every orientation.
 */
export type WallOpening = {
  key: string;
  kind: OpeningKind;
  across: Range;
  y: Range;
  /** Solid mass behind the opening, so the pane must read opaque. */
  solidBehind: boolean;
  /** Absolute height of a horizontal transom, when the opening has one. */
  transomY?: number;
  /** Overrides the wall's derived vertical division count. */
  mullions?: number;
};

/**
 * A facade plane carrying openings. The punched skin is a thin layer applied
 * over the structural mass with the openings left out of it — that is what
 * turns a flat face into a real recess with real shadows, without CSG.
 */
export type FacadeWall = {
  key: string;
  axis: FaceAxis;
  /** Outward normal along `axis`. */
  facing: 1 | -1;
  /** Coordinate of the structural face the skin is applied to. */
  face: number;
  across: Range;
  y: Range;
  /** Skin is omitted where the opening already spans a genuine void. */
  skin: boolean;
  /** Stone rather than concrete skin, matching the mass behind it. */
  stone?: boolean;
  openings: WallOpening[];
};

export type OpeningParams = {
  /** Thickness of the punched facade layer — also the recess depth. */
  skinDepth: number;
  frameWidth: number;
  frameDepth: number;
  glassThickness: number;
  /** Target spacing between vertical mullions. */
  mullionSpacing: number;
  /** Height of the shadow gap under each skin panel. */
  revealGap: number;
};

/** Frames, glass, and thresholds for one family of openings. */
export type OpeningAssembly = {
  frames: BoxSpec[];
  glassClear: BoxSpec[];
  glassOpaque: BoxSpec[];
  thresholds: BoxSpec[];
};

export type OpeningsGeometry = {
  /** Punched facade layer, in the concrete tone. */
  skin: BoxSpec[];
  /** Punched facade layer, in the stone tone. */
  skinStone: BoxSpec[];
  /** Recessed shadow line beneath each skin panel. */
  skinReveals: BoxSpec[];
  windows: OpeningAssembly;
  sliding: OpeningAssembly;
  entrance: OpeningAssembly & { leaf: BoxSpec[]; handle: ColumnSpec[] };
};
