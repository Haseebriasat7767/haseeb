'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing, MergedBoxes } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * The ground-floor shell: a service bar across the rear, two stone wings
 * bookending a recessed glazed living volume, and the entrance zone — two
 * full-height blades framing a recess, covered by a thin canopy.
 *
 * Each volume is an enclosure of punched walls rather than a solid block,
 * so it is merged into one mesh: the wall segments around a window or a
 * doorway are one wall, not parts anything downstream needs to address.
 */
export function VillaLowerFloor({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="GroundFloor">
      <group name="MainMass">
        <MergedBoxes
          name="gf-enclosure"
          specs={layout.groundFloor.mass}
          material={materials.concrete}
        />
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
