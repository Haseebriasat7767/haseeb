'use client';

import { useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import type { DetailTier } from '../VillaTypes';
import { FoliageCards } from './FoliageCards';
import { createFoliageCards } from './FoliageGeometry';
import { MergedBlobs } from './LandscapePrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * Every shrub on site — poolside, entrance, lounge, villa-edge, and
 * planter-grown.
 *
 * Treated the same way as the trees but far more lightly. A shrub is a
 * small dense mass seen from close range, so the blob underneath still
 * does most of the work; one or two cards over it are enough to break the
 * faceted outline that gave the planting its plastic look, and any more
 * would turn low planting into the loudest thing on the terrace.
 *
 * The two sparse atlas cells are used deliberately — the dense ones are
 * for tree crowns, and at shrub scale they would read as a solid green
 * lozenge.
 */
export function Shrubs({
  layout,
  detail = 'high',
}: {
  layout: LandscapeLayout;
  detail?: DetailTier;
}) {
  const materials = getMaterials();

  const cards = useMemo(
    () =>
      createFoliageCards([...layout.shrubsMid, ...layout.shrubsDark], detail, {
        shrub: true,
        sizeScale: 1.5,
        cells: [2, 3],
      }),
    [layout.shrubsMid, layout.shrubsDark, detail],
  );

  return (
    <group name="Shrubs">
      <MergedBlobs name="shrubs-mid" specs={layout.shrubsMid} material={materials.foliageMid} />
      <MergedBlobs name="shrubs-dark" specs={layout.shrubsDark} material={materials.foliageDark} />
      <FoliageCards name="shrub-foliage" cards={cards} castShadow={false} />
    </group>
  );
}
