import type { Vector3Tuple } from 'three';
import type { BlobSpec, DetailTier } from './LandscapeTypes';
import { mulberry32 } from './LandscapeGeometry';

/**
 * One alpha-cut foliage card: a quad, oriented and scaled in world space.
 *
 * Cards carry Euler angles rather than a quaternion because they are
 * authored as "spin it about Y, then tip it over" — which is how a branch
 * of leaves actually hangs, and which reads far more directly than four
 * numbers.
 */
export type FoliageCard = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  /** Width and height in metres. Never equal: a square card reads as a card. */
  size: [number, number];
  /** Which atlas cell this card samples. */
  cell: number;
  /** Per-card tint, multiplied over the atlas. */
  tint: [number, number, number];
};

/** Cards per foliage cluster, and how much of the crown they cover. */
const CARD_DETAIL: Record<DetailTier, { perCluster: number; shrubCards: number }> = {
  low: { perCluster: 2, shrubCards: 1 },
  // Enough cards that no viewing angle finds a gap between them. Four left
  // holes the inner mass showed through, and a crown with a hole in it
  // reads as broken geometry rather than as a tree.
  // Card counts rose with the reach cut: pulling cards inward tightens the
  // crown but leaves the outer edge thinner, and a gap in a silhouette is
  // the thing that reads as broken.
  medium: { perCluster: 6, shrubCards: 4 },
  high: { perCluster: 9, shrubCards: 5 },
};

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

/**
 * Turns the existing canopy volumes into foliage cards.
 *
 * Deriving the cards from the blobs rather than from a new placement pass
 * is deliberate: the landscape's composition — which specimen stands
 * where, how the crowns are massed, which clusters sit at which branch tip
 * — is Phase 6 work that reads correctly and had no reason to change. Only
 * the surface those volumes are drawn with is wrong. So the blobs keep
 * deciding where foliage is, and become the inner mass that casts the
 * shadow and stops the crown being see-through, while the cards take over
 * the silhouette.
 *
 * Every value is drawn from a seeded generator keyed to the blob's own
 * seed, so a given tree is the same tree on every render and for every
 * visitor.
 */
export function createFoliageCards(
  blobs: readonly BlobSpec[],
  detail: DetailTier,
  options: { sizeScale?: number; cells?: readonly number[]; shrub?: boolean } = {},
): FoliageCard[] {
  const tier = CARD_DETAIL[detail];
  const perCluster = options.shrub ? tier.shrubCards : tier.perCluster;
  const sizeScale = options.sizeScale ?? 1;
  const cells = options.cells ?? [0, 1, 2, 3];
  const cards: FoliageCard[] = [];

  for (const blob of blobs) {
    const rng = mulberry32(blob.seed ^ 0x464f4c49);
    // The blob's own squash carries into its cards, so a crown flattened
    // by the wind stays flattened.
    const radius = blob.radius * Math.max(blob.scale[0], blob.scale[2]);

    for (let i = 0; i < perCluster; i += 1) {
      // Yaw is spread around the circle but deliberately not evenly: cards
      // at exact right angles are what make a canopy read as intersecting
      // planes the moment the camera moves off axis.
      const yaw = (i / perCluster) * Math.PI * 2 + between(rng, -0.55, 0.55);
      const pitch = between(rng, -0.42, 0.42);
      const roll = between(rng, -0.35, 0.35);

      // Offset toward the outside of the cluster, so cards build the
      // silhouette rather than stacking through its middle — but not so far
      // that a card clears the mass entirely. At 0.8 the outermost cards on
      // an outer cluster had nothing behind them, and from any angle where
      // the quad faced the camera it read as a leafy rectangle floating in
      // the sky beside the tree. Half that keeps every card overlapping
      // something.
      const reach = radius * between(rng, 0.12, 0.42);
      const position: Vector3Tuple = [
        blob.position[0] + Math.cos(yaw) * reach,
        blob.position[1] + between(rng, -0.45, 0.55) * radius,
        blob.position[2] + Math.sin(yaw) * reach,
      ];

      // Comfortably larger than the mass they cover. The first pass sized
      // cards at roughly the blob's own diameter and left them near its
      // centre, so the faceted volume still drew the outline and the cards
      // only decorated its surface — the exact problem this replaces.
      const width = radius * between(rng, 2.9, 4.0) * sizeScale;
      const height = width * between(rng, 0.8, 1.16);

      // Mirroring through a negative width doubles the apparent number of
      // atlas variants for nothing.
      const mirrored = rng() > 0.5 ? -1 : 1;

      // A narrower range than before. At 0.74–1.12 neighbouring cards
      // differed by half again in brightness, so the crown read as light
      // patches and near-black patches rather than as foliage with light
      // falling across it. Real leaf mass varies, but nothing like that
      // much within one crown.
      const shade = between(rng, 0.86, 1.08);
      cards.push({
        position,
        rotation: [pitch, yaw, roll],
        size: [width * mirrored, height],
        cell: cells[Math.floor(rng() * cells.length)] ?? 0,
        tint: [shade * 0.95, shade, shade * 0.82],
      });
    }
  }

  return cards;
}
