'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * Clean low hedges flanking the approach path — plain boxes, reusing the
 * villa's own box primitive, so they cost nothing extra to add.
 */
export function Hedges({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="Hedges">
      <MergedBoxes name="hedges" specs={layout.hedges} material={materials.foliageMid} />
    </group>
  );
}
