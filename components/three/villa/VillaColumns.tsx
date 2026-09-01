'use client';

import { getMaterials } from '@/lib/three/materials';
import { Supports } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * A short colonnade of slender dark-metal supports under the entrance
 * canopy. Kept to the arrival sequence only — the upper volume cantilevers
 * unsupported by design.
 */
export function VillaColumns({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Columns">
      <Supports specs={layout.columns} material={materials.darkMetal} />
    </group>
  );
}
