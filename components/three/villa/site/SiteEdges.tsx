'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { SiteLayout } from './SiteTypes';

/**
 * Retaining geometry that grounds the deck and lounge to grade: skirt walls
 * along the outer paved edges, and the three low walls closing the sunken
 * lounge. Without these the deck would read as a slab floating over the
 * terrain wherever the terrace steps don't already close the gap.
 */
export function SiteEdges({ layout }: { layout: SiteLayout }) {
  const materials = getMaterials();

  return (
    <group name="SiteEdges">
      <MergedBoxes name="site-retaining" specs={layout.retaining} material={materials.stone} />
    </group>
  );
}
