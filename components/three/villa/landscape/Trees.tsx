'use client';

import { useMemo } from 'react';
import type { BlobSpec } from './LandscapeTypes';
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
/**
 * How much of its authored radius the inner mass keeps.
 *
 * The cards are sized at three to five times the cluster radius and offset
 * outward, and they were still not winning the silhouette: a deformed
 * icosahedron at the *full* radius pokes through a cloud of quads at every
 * angle where a card happens not to be, and each of those pokes is a flat
 * facet with a hard polygonal edge. Rendered frames showed exactly that —
 * angular chunks reading as low-poly geometry with leaves stuck on.
 *
 * Pulling the mass in to just over half its radius puts it entirely inside
 * the card cloud. It still does both jobs it was kept for — casting the
 * crown's shadow, and stopping the tree being see-through — while no longer
 * being the thing the eye traces the outline of.
 */
const MASS_SCALE = 0.58;

function shrink(specs: readonly BlobSpec[]): BlobSpec[] {
  return specs.map((spec) => ({ ...spec, radius: spec.radius * MASS_SCALE }));
}

export function Trees({
  layout,
  detail = 'high',
}: {
  layout: LandscapeLayout;
  detail?: DetailTier;
}) {
  const materials = getMaterials();

  const mid = useMemo(() => shrink(layout.trees.canopyMid), [layout.trees.canopyMid]);
  const dark = useMemo(() => shrink(layout.trees.canopyDark), [layout.trees.canopyDark]);

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
      <MergedBlobs name="tree-canopy-mid" specs={mid} material={materials.foliageMid} />
      <MergedBlobs name="tree-canopy-dark" specs={dark} material={materials.foliageDark} />
      {/* Alpha-tested shadows cost a second pass over every card, so only
          the top tier buys them; below that the inner mass still casts. */}
      <FoliageCards name="tree-foliage" cards={cards} castShadow={detail === 'high'} />
    </group>
  );
}
