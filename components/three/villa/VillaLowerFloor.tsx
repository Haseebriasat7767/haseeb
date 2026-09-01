'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * The ground-floor shell: a solid service bar across the rear, two stone
 * wings bookending a recessed glazed living volume, and the entrance zone —
 * two full-height blades framing a recess, covered by a thin canopy.
 */
export function VillaLowerFloor({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="GroundFloor">
      <group name="MainMass">
        <Massing specs={layout.groundFloor.mass} material={materials.concrete} />
      </group>

      <group name="Recesses">
        <Massing specs={layout.groundFloor.recess} material={materials.stone} />
      </group>

      <group name="Entrance">
        <Massing specs={layout.groundFloor.entrance} material={materials.concrete} />
      </group>
    </group>
  );
}
