'use client';

import { useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import type { DetailTier } from '../VillaTypes';
import { FoliageCards } from './FoliageCards';
import { createFoliageCards } from './FoliageGeometry';
import { MergedBlobs, MergedBranches } from './LandscapePrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * The feature trees.
 *
 * Two layers, and the division between them is the point of Phase 7E. The
 * deformed blobs that used to *be* the canopy are now only its inner mass:
 * they are what casts the shadow, what stops the crown being see-through,
 * and what gives the foliage somewhere to sit. They no longer draw the
 * silhouette, because a subdivided sphere cannot — no amount of vertices
 * turns a closed convex surface into something with the ragged, gappy edge
 * a real crown has.
 *
 * The silhouette comes from alpha-cut foliage cards instanced around each
 * cluster. One draw call, and the outline is decided by a texture with
 * leaves and holes in it rather than by geometry.
 */
export function Trees({
  layout,
  detail = 'high',
}: {
  layout: LandscapeLayout;
  detail?: DetailTier;
}) {
  const materials = getMaterials();

  const cards = useMemo(
    () =>
      createFoliageCards([...layout.trees.canopyMid, ...layout.trees.canopyDark], detail, {
        cells: [0, 1, 2, 3],
      }),
    [layout.trees.canopyMid, layout.trees.canopyDark, detail],
  );

  return (
    <group name="Trees">
      <MergedBranches name="tree-trunks" specs={layout.trees.trunks} material={materials.bark} />
      {/* The inner mass. Still shadow-casting, but no longer the thing the
          eye reads as the shape of the tree. */}
      <MergedBlobs
        name="tree-canopy-mid"
        specs={layout.trees.canopyMid}
        material={materials.foliageMid}
      />
      <MergedBlobs
        name="tree-canopy-dark"
        specs={layout.trees.canopyDark}
        material={materials.foliageDark}
      />
      {/* Alpha-tested shadows cost a second pass over every card, so only
          the top tier buys them; below that the inner mass still casts. */}
      <FoliageCards name="tree-foliage" cards={cards} castShadow={detail === 'high'} />
    </group>
  );
}
