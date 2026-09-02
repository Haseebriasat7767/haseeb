import type { Vector3Tuple } from 'three';
import type { BoxSpec, DetailTier, Range } from '../VillaTypes';

/**
 * An irregular low-poly volume — a deformed icosahedron. Used for canopy
 * clusters, shrub blobs, and rocks; `deform` and `flatten` are what keep
 * the three from looking identical.
 */
export type BlobSpec = {
  key: string;
  position: Vector3Tuple;
  radius: number;
  /** Applied after deformation — e.g. squashed flat for a rock. */
  scale: Vector3Tuple;
  seed: number;
  /** Relative vertex displacement, 0–1. */
  deform: number;
  /**
   * Icosahedron subdivision. 0 stays cheap but reads as faceted low-poly;
   * 1 and 2 are reserved for canopies, where the silhouette is the whole
   * point and a 20-face blob is unmistakably a prop.
   */
  detail: 0 | 1 | 2;
};

/**
 * A tapered cylinder segment between two points — a trunk or one major
 * branch. Endpoints rather than position/rotation, so the renderer can
 * orient it with real vector math instead of hand-derived Euler angles.
 */
export type BranchSpec = {
  key: string;
  from: Vector3Tuple;
  to: Vector3Tuple;
  topRadius: number;
  bottomRadius: number;
};

/** A single flat-tapered grass blade. */
export type BladeSpec = {
  key: string;
  position: Vector3Tuple;
  rotationY: number;
  tilt: number;
  height: number;
  width: number;
};

export type FeatureTreeConfig = {
  count: number;
  trunkHeight: number;
  trunkRadius: number;
  branchCount: number;
  canopyClusters: number;
  canopyRadius: number;
  canopySpread: number;
};

export type ShrubConfig = {
  poolsideCount: number;
  entranceCount: number;
  loungeCount: number;
  edgeCount: number;
  radius: number;
  blobsPerShrub: number;
};

export type GrassConfig = {
  clusterCount: number;
  bladesPerCluster: number;
  bladeHeight: number;
  bladeWidth: number;
  clusterRadius: number;
};

export type HedgeConfig = {
  height: number;
  width: number;
  /** Clearance from the approach path's paved edge. */
  offset: number;
};

export type RockConfig = {
  count: number;
  minRadius: number;
  maxRadius: number;
};

export type PlanterPlantingConfig = {
  soilInset: number;
  soilDepth: number;
};

/**
 * Every landscape density/style knob, in one place — the same pattern as
 * `VILLA_CONFIG` and `SITE_CONFIG`. A future configurator hands a partial
 * override of this object to `createLandscapeLayout`.
 */
export type LandscapeConfig = {
  /** Reserved for a future configurator; not yet used to branch logic. */
  style: 'mediterranean';
  featureTree: FeatureTreeConfig;
  shrub: ShrubConfig;
  grass: GrassConfig;
  hedge: HedgeConfig;
  rock: RockConfig;
  planterPlanting: PlanterPlantingConfig;
  /** Clearance kept between poolside planting and the pool's own coping. */
  poolsideOffset: number;
  /** Clearance kept between entrance beds and the approach path's edge. */
  entranceBedOffset: number;
  /** Clearance kept between villa edge planting and the plinth. */
  villaEdgeOffset: number;
  /** Inset kept between lounge planting and the pit it sits above. */
  loungeEdgeInset: number;
};

export type LandscapeLayout = {
  trees: { trunks: BranchSpec[]; canopyMid: BlobSpec[]; canopyDark: BlobSpec[] };
  shrubsMid: BlobSpec[];
  shrubsDark: BlobSpec[];
  grass: BladeSpec[];
  hedges: BoxSpec[];
  rocks: BlobSpec[];
  planterSoil: BoxSpec[];
};

/** Inputs the landscape needs from the villa and site — never eyeballed. */
export type LandscapeContext = {
  halfWidth: number;
  halfDepth: number;
  plinthHalfWidth: number;
  groundY: number;
  entranceStairsX: Range;
  entranceStairsOuterZ: number;
  deckX: Range;
  deckZ: Range;
  deckY: number;
  poolX: Range;
  poolZ: Range;
  loungeX: Range;
  loungeZ: Range;
  loungeFloorX: Range;
  loungeFloorY: number;
  approachX: Range;
  approachZ: Range;
  planters: readonly BoxSpec[];
};

export type { DetailTier };
