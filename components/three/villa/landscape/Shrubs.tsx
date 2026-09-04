'use client';

import { useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import type { DetailTier } from '../VillaTypes';
import { FoliageCards } from './FoliageCards';
import { createFoliageCards } from './FoliageGeometry';
import { MergedBlobs } from './LandscapePrimitives';
import type { BlobSpec, LandscapeLayout } from './LandscapeTypes';

/**
 * Every shrub on site — poolside, entrance, lounge, villa-edge, and
 * planter-grown.
 *
 * Treated exactly the same way as the trees, and for the same reason. The
 * first pass kept the blob at full size on the argument that a shrub is a
 * small dense mass the cards only need to soften — and the poolside frames
 * showed what that actually produces: faceted green lumps with leaves stuck
 * on them, sitting in the foreground of a money shot next to the loungers.
 * A shrub's outline has to come from the atlas like a tree's does, so the
 * mass is pulled well inside the cards here too.
 *
 * The two sparse atlas cells are used deliberately — the dense ones are
 * for tree crowns, and at shrub scale they would read as a solid green
 * lozenge.
 */
/** How much of its authored radius a shrub's inner mass keeps. */
const MASS_SCALE = 0.55;

function shrink(specs: readonly BlobSpec[]): BlobSpec[] {
  return specs.map((spec) => ({ ...spec, radius: spec.radius * MASS_SCALE }));
}

export function Shrubs({
  layout,
  detail = 'high',
}: {
  layout: LandscapeLayout;
  detail?: DetailTier;
}) {
  const materials = getMaterials();

  const mid = useMemo(() => shrink(layout.shrubsMid), [layout.shrubsMid]);
  const dark = useMemo(() => shrink(layout.shrubsDark), [layout.shrubsDark]);

  const cards = useMemo(
    () =>
      createFoliageCards([...layout.shrubsMid, ...layout.shrubsDark], detail, {
        shrub: true,
        sizeScale: 1.15,
        cells: [2, 3],
      }),
    [layout.shrubsMid, layout.shrubsDark, detail],
  );

  return (
    <group name="Shrubs">
      <MergedBlobs name="shrubs-mid" specs={mid} material={materials.foliageMid} />
      <MergedBlobs name="shrubs-dark" specs={dark} material={materials.foliageDark} />
      <FoliageCards name="shrub-foliage" cards={cards} castShadow={false} />
    </group>
  );
}
