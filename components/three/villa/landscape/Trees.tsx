'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBlobs, MergedBranches } from './LandscapePrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * The feature trees: trunk and branches merged into one bark mesh, canopy
 * merged into two foliage meshes (mid/dark) for depth without a texture.
 * Three draw calls total, regardless of how many trees or branches exist.
 */
export function Trees({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="Trees">
      <MergedBranches name="tree-trunks" specs={layout.trees.trunks} material={materials.bark} />
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
    </group>
  );
}
