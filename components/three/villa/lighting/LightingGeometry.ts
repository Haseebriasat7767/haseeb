import type { BoxSpec, DetailTier, Range, VillaLevels, VillaPlan } from '../VillaTypes';
import { box, mid, span } from '../SpecBuilders';
import type { SiteLayout } from '../site/SiteTypes';
import type {
  ArchitecturalLightingConfig,
  ArchitecturalLightingLayout,
  FixtureLight,
} from './LightingTypes';

/** Default fixture dimensions, in metres. */
export const ARCHITECTURAL_LIGHTING_CONFIG: ArchitecturalLightingConfig = {
  slotRecess: 0.09,
  grazerHeight: 0.04,
  slotWidth: 0.16,
  poolNicheDrop: 0.34,
  markerRadius: 0.11,
  wallOffset: 0.08,
};

/**
 * How much of the scheme each tier mounts. Only repeated fixtures thin out:
 * the entrance, the cantilever wash, and the facade grazers are the scheme,
 * and a residence missing them is not a cheaper residence.
 */
const LIGHTING_DETAIL: Record<
  DetailTier,
  { approachMarkers: number; deckUplights: number; poolNiches: boolean }
> = {
  low: { approachMarkers: 2, deckUplights: 0, poolNiches: false },
  medium: { approachMarkers: 3, deckUplights: 2, poolNiches: true },
  high: { approachMarkers: 4, deckUplights: 3, poolNiches: true },
};

/** A range inset equally from both ends. */
function inset(r: Range, by: number): Range {
  return [r[0] + by, r[1] - by];
}

/**
 * Resolves the exterior architectural lighting scheme: where every fixture
 * sits, and the handful of dynamic lights worth spending shader time on.
 *
 * Pure and deterministic, and — like the site and the landscape before it —
 * derived entirely from the villa's own plan lines and the site's resolved
 * bounds. Every fixture below is placed because a piece of architecture
 * needs lighting, not because a coordinate looked empty: the entrance is
 * lit because you arrive there, the cantilever soffit because it hangs over
 * the terrace, the wings because they are the elevation you photograph.
 */
export function createArchitecturalLighting(
  config: ArchitecturalLightingConfig,
  plan: VillaPlan,
  levels: VillaLevels,
  site: SiteLayout,
  detail: DetailTier = 'high',
): ArchitecturalLightingLayout {
  const tier = LIGHTING_DETAIL[detail];
  const { slotRecess: recess, slotWidth: sw, grazerHeight: gh, wallOffset: off } = config;
  const bounds = site.bounds;

  const glow: BoxSpec[] = [];
  const housings: BoxSpec[] = [];

  /**
   * A slot recessed up into a soffit: a dark housing set into the ceiling
   * plane with the lit face inside it, so what you see from below is a line
   * of light in shadow rather than a glowing strip stuck to a surface.
   */
  const soffitSlot = (key: string, x: Range, z: Range, soffitY: number): void => {
    housings.push(box(`${key}-housing`, x, [soffitY - recess - 0.02, soffitY], z));
    glow.push(
      box(
        `${key}-glow`,
        inset(x, 0.05),
        [soffitY - recess, soffitY - recess + 0.03],
        inset(z, 0.02),
      ),
    );
  };

  /** A linear in-ground grazer lying against a wall it washes upward. */
  const grazer = (key: string, x: Range, z: Range, baseY: number): void => {
    housings.push(box(`${key}-housing`, x, [baseY - 0.03, baseY + gh], z));
    glow.push(box(`${key}-glow`, inset(x, 0.08), [baseY + gh * 0.4, baseY + gh], inset(z, 0.03)));
  };

  /** A small flush marker set into paving — approach edges and planting. */
  const marker = (key: string, cx: number, cz: number, baseY: number): void => {
    const r = config.markerRadius;
    housings.push(
      box(`${key}-housing`, [cx - r, cx + r], [baseY - 0.04, baseY + 0.05], [cz - r, cz + r]),
    );
    glow.push(
      box(
        `${key}-glow`,
        [cx - r * 0.6, cx + r * 0.6],
        [baseY + 0.02, baseY + 0.05],
        [cz - r * 0.6, cz + r * 0.6],
      ),
    );
  };

  // ── Arrival: a slot in the canopy soffit washing the entrance door ─────
  soffitSlot(
    'fixture-entrance',
    [plan.entranceOffsetX - 1.3, plan.entranceOffsetX + 1.3],
    [plan.entranceBackZ + 0.45, plan.entranceBackZ + 0.45 + sw],
    levels.groundFloorTopY - 0.07,
  );

  // ── The cantilever soffit, washing down onto the terrace and pool ──────
  soffitSlot(
    'fixture-cantilever',
    inset(plan.cantileverAxisX, 0.6),
    [plan.cantileverZ[1] - 0.5, plan.cantileverZ[1] - 0.5 + sw],
    levels.groundFloorTopY - 0.07,
  );

  // ── Facade grazers along the two stone wings' front faces ─────────────
  // Placed on the terrace deck rather than the wall, so they rake up the
  // stone and pick out its texture instead of flattening it.
  const grazerZ: Range = [plan.frontZ + off, plan.frontZ + off + sw];
  const deckTopY = plan.groundY + 0.12;
  grazer(
    'fixture-graze-west',
    [-plan.halfWidth + 0.6, plan.westWingEastX - 0.6],
    grazerZ,
    deckTopY,
  );
  grazer('fixture-graze-east', [plan.eastWingWestX + 0.6, plan.halfWidth - 0.6], grazerZ, deckTopY);

  // ── Pool: niches recessed under the coping on three sides ─────────────
  // The fourth is the infinity weir, which water runs over.
  if (tier.poolNiches) {
    const nicheY: Range = [
      bounds.deckY - config.poolNicheDrop,
      bounds.deckY - config.poolNicheDrop + 0.11,
    ];
    const nicheX = inset(bounds.poolX, 0.8);
    housings.push(
      box('fixture-pool-near-housing', nicheX, nicheY, [bounds.poolZ[0], bounds.poolZ[0] + 0.11]),
    );
    glow.push(
      box('fixture-pool-near-glow', inset(nicheX, 0.06), inset(nicheY, 0.02), [
        bounds.poolZ[0] + 0.05,
        bounds.poolZ[0] + 0.1,
      ]),
    );

    const nicheZ = inset(bounds.poolZ, 0.7);
    (
      [
        ['west', bounds.poolX[0], 1],
        ['east', bounds.poolX[1], -1],
      ] as const
    ).forEach(([side, at, dir]) => {
      const wall: Range = dir === 1 ? [at, at + 0.11] : [at - 0.11, at];
      const face: Range = dir === 1 ? [at + 0.05, at + 0.1] : [at - 0.1, at - 0.05];
      housings.push(box(`fixture-pool-${side}-housing`, wall, nicheY, nicheZ));
      glow.push(box(`fixture-pool-${side}-glow`, face, inset(nicheY, 0.02), inset(nicheZ, 0.06)));
    });
  }

  // ── Sunken lounge: a cove in the far retaining wall ───────────────────
  const coveY: Range = [bounds.loungeFloorY + 0.34, bounds.loungeFloorY + 0.44];
  housings.push(
    box('fixture-lounge-housing', inset(bounds.loungeFloorX, 0.4), coveY, [
      bounds.loungeZ[1] - 0.3,
      bounds.loungeZ[1] - 0.18,
    ]),
  );
  glow.push(
    box('fixture-lounge-glow', inset(bounds.loungeFloorX, 0.5), inset(coveY, 0.02), [
      bounds.loungeZ[1] - 0.3,
      bounds.loungeZ[1] - 0.25,
    ]),
  );

  // ── Approach: markers flanking the stepping slabs ─────────────────────
  const markerZStep = span(bounds.approachZ) / Math.max(1, tier.approachMarkers);
  for (let i = 0; i < tier.approachMarkers; i += 1) {
    const at = bounds.approachZ[0] + markerZStep * (i + 0.5);
    marker(`fixture-approach-w-${i}`, bounds.approachX[0] - 0.45, at, 0.02);
    marker(`fixture-approach-e-${i}`, bounds.approachX[1] + 0.45, at, 0.02);
  }

  // ── Poolside planting: a few discreet uplights, not a lit garden ──────
  const upZ = inset(bounds.deckZ, 1.2);
  const upStep = span(upZ) / Math.max(1, tier.deckUplights);
  for (let i = 0; i < tier.deckUplights; i += 1) {
    marker(
      `fixture-deck-uplight-${i}`,
      bounds.deckX[0] + 0.55,
      upZ[0] + upStep * (i + 0.5),
      bounds.deckY,
    );
  }

  // ── Dynamic lights, ranked by how much the composition needs them ─────
  const lights: FixtureLight[] = [
    {
      key: 'light-entrance',
      kind: 'spot',
      position: [plan.entranceOffsetX, levels.groundFloorTopY - 0.2, plan.entranceBackZ + 1.0],
      target: [plan.entranceOffsetX, plan.groundY, plan.entranceBackZ + 0.1],
      intensity: 1,
      distance: 15,
      color: '#ffdcae',
      angle: 0.78,
      penumbra: 0.9,
    },
    {
      key: 'light-pool',
      kind: 'point',
      // Submerged, so the basin and coping catch it and the water surface
      // above reads as lit from within rather than from a lamp on a pole.
      position: [mid(bounds.poolX), bounds.deckY - 0.85, mid(bounds.poolZ)],
      intensity: 0.75,
      distance: 13,
      color: '#cfe6df',
    },
    {
      key: 'light-lounge',
      kind: 'point',
      position: [mid(bounds.loungeFloorX), bounds.loungeFloorY + 0.9, mid(bounds.loungeZ)],
      intensity: 0.55,
      distance: 10,
      color: '#ffdcae',
    },
  ];

  return { glow, housings, lights };
}
