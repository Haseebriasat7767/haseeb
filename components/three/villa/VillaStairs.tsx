'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * External approach stair from the terrain up to the plinth, aligned on the
 * entrance. Treads are generated from the configured rise and going.
 */
export function VillaStairs({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Stairs">
      <Massing specs={layout.stairs} material={materials.stone} />
    </group>
  );
}
