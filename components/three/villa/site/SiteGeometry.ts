import type { BoxSpec, DetailTier, Range, VillaPlan } from '../VillaTypes';
import { box, span, stairRun } from '../SpecBuilders';
import type { SiteConfig, SiteLayout } from './SiteTypes';

/**
 * Default proportions of the exterior site, in metres. Every position below
 * is derived either from one of these values or from the villa's own plan
 * lines (`VillaPlan`) — nothing is placed by eyeballed coordinate.
 */
export const SITE_CONFIG: SiteConfig = {
  pool: {
    width: 11,
    length: 6.5,
    offsetX: 3.5,
    gapFromDeckEdge: 1.8,
    farMargin: 1.8,
    waterDepth: 1.4,
    basinWallThickness: 0.22,
    copingWidth: 0.5,
    copingThickness: 0.08,
    freeboard: 0.05,
    stepCount: 3,
    stepWidth: 3,
    infinityChannelWidth: 0.55,
    infinityChannelDepth: 0.3,
  },
  deck: {
    levelDrop: 0.5,
    stepCount: 3,
    margin: 2,
    slabColumns: 2,
    slabRows: 3,
    slabGap: 0.05,
  },
  approach: {
    slabLength: 1.6,
    slabWidth: 2.2,
    slabGap: 0.35,
    slabCount: 4,
    startGap: 1,
  },
  planter: {
    width: 2.4,
    depth: 0.9,
    height: 0.6,
    wallThickness: 0.12,
  },
  lounge: {
    width: 6,
    depth: 5,
    dropDepth: 0.4,
    wallThickness: 0.25,
    stepCount: 2,
  },
  retainingThickness: 0.3,
};

/** Repeated site detail thins out on weaker GPUs, mirroring the villa's own tiers. */
const SITE_DETAIL: Record<DetailTier, { planterCount: 1 | 2 | 3; fineGrid: boolean }> = {
  low: { planterCount: 1, fineGrid: false },
  medium: { planterCount: 2, fineGrid: false },
  high: { planterCount: 3, fineGrid: true },
};

/** Tiles a rectangular region into a grid of large slabs with a thin joint gap. */
function tileSlabs(
  keyPrefix: string,
  x: Range,
  z: Range,
  columns: number,
  rows: number,
  gap: number,
  y: Range,
): BoxSpec[] {
  if (span(x) <= 0 || span(z) <= 0) return [];

  const colWidth = span(x) / columns;
  const rowDepth = span(z) / rows;
  const specs: BoxSpec[] = [];

  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const x0 = x[0] + c * colWidth + gap / 2;
      const x1 = x[0] + (c + 1) * colWidth - gap / 2;
      const z0 = z[0] + r * rowDepth + gap / 2;
      const z1 = z[0] + (r + 1) * rowDepth - gap / 2;
      if (x1 <= x0 || z1 <= z0) continue;
      specs.push(box(`${keyPrefix}-${c}-${r}`, [x0, x1], y, [z0, z1]));
    }
  }

  return specs;
}

/**
 * Resolves the site configuration against the villa's plan into the whole
 * exterior hardscape. Pure and deterministic, exactly like
 * `createVillaLayout` — callers memoise the result.
 */
export function createSiteLayout(
  config: SiteConfig = SITE_CONFIG,
  plan: VillaPlan,
  detail: DetailTier = 'high',
): SiteLayout {
  const tier = SITE_DETAIL[detail];
  const grid = tier.fineGrid ? config.deck : { ...config.deck, slabColumns: 1, slabRows: 1 };

  const { pool, deck, approach, planter, lounge } = config;

  // ── Levels ────────────────────────────────────────────────────────────
  const deckY = plan.groundY - deck.levelDrop;
  const copingTopY = deckY;
  const waterTopY = deckY - pool.freeboard;
  const basinFloorY = deckY - pool.waterDepth;
  const loungeFloorY = deckY - lounge.dropDepth;

  // ── Plan lines ────────────────────────────────────────────────────────
  const poolX: Range = [pool.offsetX - pool.width / 2, pool.offsetX + pool.width / 2];
  const deckX: Range = [poolX[0] - deck.margin, poolX[1] + deck.margin];

  // Steps continue the villa's own terrace down onto the deck.
  const terraceSteps = stairRun(
    'terrace-to-deck',
    'z',
    deckX,
    plan.plinthFrontZ,
    1,
    deck.stepCount,
    0.5,
    plan.groundY,
    deckY,
    0,
  );
  const deckNearZ = plan.plinthFrontZ + deck.stepCount * 0.5;

  const poolNearZ = deckNearZ + pool.gapFromDeckEdge;
  const poolZ: Range = [poolNearZ, poolNearZ + pool.length];
  const deckFarZ = poolZ[1] + pool.farMargin;
  const deckZ: Range = [deckNearZ, deckFarZ];

  const loungeX: Range = [deckX[1], deckX[1] + lounge.width];
  const loungeZ: Range = [deckNearZ, deckNearZ + lounge.depth];

  const t = pool.basinWallThickness;

  // ── Pool interior: floor, walls, submerged steps, infinity channel ─────
  const interior: BoxSpec[] = [
    box('pool-floor', poolX, [basinFloorY - 0.1, basinFloorY], poolZ),
    box('pool-wall-near', poolX, [basinFloorY, copingTopY], [poolZ[0], poolZ[0] + t]),
    box('pool-wall-west', [poolX[0], poolX[0] + t], [basinFloorY, copingTopY], poolZ),
    box('pool-wall-east', [poolX[1] - t, poolX[1]], [basinFloorY, copingTopY], poolZ),
    // The far wall is a weir — shorter than the others, so water reads as
    // running to the edge rather than being held by a visible parapet.
    box('pool-wall-far', poolX, [basinFloorY, waterTopY], [poolZ[1] - t, poolZ[1]]),
  ];

  interior.push(
    ...stairRun(
      'pool-step',
      'z',
      [pool.offsetX - pool.stepWidth / 2, pool.offsetX + pool.stepWidth / 2],
      poolZ[0] + t,
      1,
      pool.stepCount,
      0.5,
      copingTopY,
      basinFloorY + pool.waterDepth * 0.3,
      basinFloorY,
    ),
  );

  const channelZ: Range = [poolZ[1], poolZ[1] + pool.infinityChannelWidth];
  interior.push(
    box(
      'infinity-channel-floor',
      poolX,
      [deckY - pool.infinityChannelDepth - 0.1, deckY - pool.infinityChannelDepth],
      channelZ,
    ),
    box(
      'infinity-channel-lip',
      poolX,
      [deckY - pool.infinityChannelDepth - 0.1, waterTopY - 0.05],
      [channelZ[1] - 0.1, channelZ[1]],
    ),
  );

  // ── Coping: a light stone band on the three visible sides ──────────────
  const coping: BoxSpec[] = [
    box(
      'coping-near',
      [poolX[0] - pool.copingWidth, poolX[1] + pool.copingWidth],
      [copingTopY - pool.copingThickness, copingTopY],
      [poolZ[0] - pool.copingWidth, poolZ[0]],
    ),
    box(
      'coping-west',
      [poolX[0] - pool.copingWidth, poolX[0]],
      [copingTopY - pool.copingThickness, copingTopY],
      poolZ,
    ),
    box(
      'coping-east',
      [poolX[1], poolX[1] + pool.copingWidth],
      [copingTopY - pool.copingThickness, copingTopY],
      poolZ,
    ),
  ];

  // ── Water: a single thin surface, held back from the infinity edge ─────
  const water: BoxSpec[] = [
    box(
      'pool-water',
      [poolX[0] + t, poolX[1] - t],
      [waterTopY - 0.12, waterTopY],
      [poolZ[0] + t, poolZ[1] - t * 0.3],
    ),
  ];

  // ── Deck paving: a frame of large slabs around the pool, never under it ─
  const slabY: Range = [deckY - 0.06, deckY];
  const deckSlabs: BoxSpec[] = [
    ...tileSlabs('deck-west', [deckX[0], poolX[0]], deckZ, 1, grid.slabRows, grid.slabGap, slabY),
    ...tileSlabs('deck-east', [poolX[1], deckX[1]], deckZ, 1, grid.slabRows, grid.slabGap, slabY),
    ...tileSlabs(
      'deck-near',
      poolX,
      [deckZ[0], poolZ[0]],
      grid.slabColumns + 1,
      1,
      grid.slabGap,
      slabY,
    ),
    ...tileSlabs(
      'deck-far',
      poolX,
      [channelZ[1], deckZ[1]],
      grid.slabColumns + 1,
      1,
      grid.slabGap,
      slabY,
    ),
  ];

  // ── Sunken lounge: a broad stepped edge and three low retaining walls ──
  // The run spans the whole shared boundary with the deck (loungeZ), so the
  // entire west side of the pit is a stepped edge rather than a lone wall
  // beside an open drop.
  const loungeStepGoing = lounge.width / 3;
  const loungeSteps = stairRun(
    'lounge-step',
    'x',
    loungeZ,
    loungeX[0],
    1,
    lounge.stepCount,
    loungeStepGoing,
    deckY,
    loungeFloorY,
    loungeFloorY,
  );
  const stepsRunX1 = loungeX[0] + loungeStepGoing * lounge.stepCount;

  const loungeFloor = tileSlabs(
    'lounge-floor',
    [stepsRunX1, loungeX[1]],
    loungeZ,
    tier.fineGrid ? 2 : 1,
    1,
    grid.slabGap,
    [loungeFloorY - 0.06, loungeFloorY],
  );

  const lw = lounge.wallThickness;
  const retaining: BoxSpec[] = [
    box(
      'lounge-wall-near',
      [stepsRunX1, loungeX[1]],
      [loungeFloorY, deckY],
      [loungeZ[0], loungeZ[0] + lw],
    ),
    box(
      'lounge-wall-far',
      [stepsRunX1, loungeX[1]],
      [loungeFloorY, deckY],
      [loungeZ[1] - lw, loungeZ[1]],
    ),
    box('lounge-wall-east', [loungeX[1] - lw, loungeX[1]], [loungeFloorY, deckY], loungeZ),
    // Skirts ground the deck to grade instead of letting it float over the
    // terrain — the outer edges not already closed by the terrace steps.
    box(
      'deck-skirt-west',
      [deckX[0] - config.retainingThickness, deckX[0]],
      [0, deckY - 0.06],
      deckZ,
    ),
    box(
      'deck-skirt-far',
      deckX,
      [0, deckY - 0.06],
      [deckFarZ, deckFarZ + config.retainingThickness],
    ),
    box(
      'deck-skirt-east',
      [deckX[1], deckX[1] + config.retainingThickness],
      [0, deckY - 0.06],
      [loungeZ[1], deckFarZ],
    ),
  ];

  // ── Approach path: large stepping slabs from the entrance stairs out ────
  const approachX: Range = [
    plan.entranceOffsetX - approach.slabWidth / 2,
    plan.entranceOffsetX + approach.slabWidth / 2,
  ];
  const approachStartZ = plan.entranceStairsOuterZ + approach.startGap;
  const approachSlabs: BoxSpec[] = Array.from({ length: approach.slabCount }, (_, index) => {
    const z0 = approachStartZ + index * (approach.slabLength + approach.slabGap);
    return box(`approach-${index}`, approachX, [0, 0.06], [z0, z0 + approach.slabLength]);
  });

  // ── Planters: a small, deliberate set at the deck's arrival corners ────
  const allPlanters: BoxSpec[] = [
    box(
      'planter-deck-west',
      [deckX[0] + 0.4, deckX[0] + 0.4 + planter.width],
      [deckY, deckY + planter.height],
      [deckZ[0] + 0.4, deckZ[0] + 0.4 + planter.depth],
    ),
    box(
      'planter-deck-east',
      [deckX[1] - 0.4 - planter.width, deckX[1] - 0.4],
      [deckY, deckY + planter.height],
      [deckZ[0] + 0.4, deckZ[0] + 0.4 + planter.depth],
    ),
    box(
      'planter-lounge-divide',
      [deckX[1] - 1.6 - planter.width, deckX[1] - 1.6],
      [deckY, deckY + planter.height],
      [deckZ[0] + 2, deckZ[0] + 2 + planter.depth],
    ),
  ];
  const planters = allPlanters.slice(0, tier.planterCount);

  return {
    pool: { interior, water, coping },
    paving: {
      deckSlabs,
      terraceSteps,
      loungeFloor,
      loungeSteps,
      approach: approachSlabs,
    },
    retaining,
    planters,
    bounds: { deckX, deckZ, loungeX, loungeZ },
  };
}
