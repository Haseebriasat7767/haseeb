import type { BoxSpec, Range } from '../VillaTypes';

export type PoolConfig = {
  /** X extent (metres). */
  width: number;
  /** Z extent, away from the house (metres). */
  length: number;
  /** Centre X, in villa coordinates. */
  offsetX: number;
  /** Gap between the deck's near (house-side) edge and the pool. */
  gapFromDeckEdge: number;
  /** Deck depth kept beyond the pool's far (infinity) wall. */
  farMargin: number;
  /** Basin depth below the coping line. */
  waterDepth: number;
  basinWallThickness: number;
  copingWidth: number;
  copingThickness: number;
  /** How far below coping the water surface sits, off the infinity edge. */
  freeboard: number;
  stepCount: number;
  /** X width of the submerged entry-step run. */
  stepWidth: number;
  infinityChannelWidth: number;
  infinityChannelDepth: number;
};

export type DeckConfig = {
  /** How far below the villa terrace the deck sits. */
  levelDrop: number;
  /** Steps bridging the villa terrace down to the deck. */
  stepCount: number;
  /** Deck paving kept beyond the pool footprint, west and east. */
  margin: number;
  /** Slab grid resolution at the current detail tier. */
  slabColumns: number;
  slabRows: number;
  slabGap: number;
};

export type ApproachConfig = {
  slabLength: number;
  slabWidth: number;
  slabGap: number;
  slabCount: number;
  /** Gap from the existing entrance stairs' outer edge to the first slab. */
  startGap: number;
};

export type PlanterConfig = {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
};

export type LoungeConfig = {
  /** Also the depth of the stepped run down into it — see `SiteGeometry`. */
  width: number;
  depth: number;
  dropDepth: number;
  wallThickness: number;
  stepCount: number;
};

export type SiteConfig = {
  pool: PoolConfig;
  deck: DeckConfig;
  approach: ApproachConfig;
  planter: PlanterConfig;
  lounge: LoungeConfig;
  /** Thickness of the retaining bands that ground paved platforms to grade. */
  retainingThickness: number;
};

export type SiteLayout = {
  pool: {
    /** Basin floor, walls, submerged steps, and the infinity channel. */
    interior: BoxSpec[];
    water: BoxSpec[];
    coping: BoxSpec[];
  };
  paving: {
    deckSlabs: BoxSpec[];
    terraceSteps: BoxSpec[];
    loungeFloor: BoxSpec[];
    loungeSteps: BoxSpec[];
    approach: BoxSpec[];
  };
  retaining: BoxSpec[];
  planters: BoxSpec[];
  /** Deck bounds, exposed for planter/edge placement and future landscaping. */
  bounds: { deckX: Range; deckZ: Range; loungeX: Range; loungeZ: Range };
};
