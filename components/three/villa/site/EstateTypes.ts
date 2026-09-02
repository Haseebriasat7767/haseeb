import type { BoxSpec, ColumnSpec, DetailTier, Range } from '../VillaTypes';

/** A rectangle of ground, in plan. Used to keep the lawn off hard paving. */
export type PavingRect = { x: Range; z: Range };

/**
 * Proportions of the arrival sequence, in metres.
 *
 * Every value here is a real residential dimension rather than a number
 * that looked right on screen. A private drive is six metres so two cars
 * pass; a turning court is sixteen by eight because a car needs roughly
 * twelve metres to come about without shunting; paving is laid in
 * 1.2 metre modules because that is the largest slab a two-person crew
 * sets by hand, and it is exactly that module — read against a door, a
 * step, a lounger — that tells a viewer how big the building is.
 */
export type ArrivalConfig = {
  /** Clear width of the drive. */
  driveWidth: number;
  /** Where the drive begins, in Z, and where it meets the court. */
  driveZ: Range;
  /** Plan extent of the turning court. */
  courtX: Range;
  courtZ: Range;
  /** Side of one square paving module. */
  module: number;
  /** Open joint between modules. */
  joint: number;
  /** How far the paving sits above grade — a kerb, not a floating plane. */
  kerbHeight: number;
};

export type OutdoorConfig = {
  /** Terrace level the lounge and dining sit on. */
  terraceY: number;
  /** Deck level the loungers sit on. */
  deckY: number;
  /** Centre of the lounge grouping, on the terrace. */
  loungeCenter: [number, number];
  /** Centre of the dining grouping, on the terrace. */
  diningCenter: [number, number];
  /** X of the poolside lounger run, and the Z of each lounger. */
  loungerX: number;
  loungerZ: readonly number[];
};

/**
 * Everything the estate adds, grouped by material so each becomes a single
 * merged mesh — the same discipline the villa and its interior follow.
 */
export type EstateLayout = {
  /** Large-format paving of the drive and the court. */
  paving: BoxSpec[];
  /** The upstand that stops the paving reading as a decal on the grass. */
  kerbs: BoxSpec[];
  /** Timber: table tops, lounger frames, sofa carcasses. */
  timber: BoxSpec[];
  /** Outdoor upholstery — seats, backs, lounger pads. */
  cushions: BoxSpec[];
  /** Darker accent upholstery: scatter cushions, folded towels. */
  accents: BoxSpec[];
  /** Stone table tops and the lantern bodies. */
  stone: BoxSpec[];
  /** Powder-coated metal frames and legs. */
  metal: BoxSpec[];
  /** Slim turned legs and posts. */
  posts: ColumnSpec[];
  /** Emissive faces of the arrival and terrace lanterns. */
  glow: BoxSpec[];
  /**
   * Ground the lawn must not grow through. Returned rather than restated
   * at the call site so the exclusion can never drift from the paving.
   */
  pavedGround: PavingRect[];
};

export type { DetailTier };
