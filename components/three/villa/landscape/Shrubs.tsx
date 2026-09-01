'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBlobs } from './LandscapePrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * Every shrub on site — poolside, entrance, lounge, villa-edge, and
 * planter-grown — merged into two foliage meshes. Each shrub is itself a
 * small cluster of overlapping deformed blobs, never a single sphere.
 */
export function Shrubs({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="Shrubs">
      <MergedBlobs name="shrubs-mid" specs={layout.shrubsMid} material={materials.foliageMid} />
      <MergedBlobs name="shrubs-dark" specs={layout.shrubsDark} material={materials.foliageDark} />
    </group>
  );
}
