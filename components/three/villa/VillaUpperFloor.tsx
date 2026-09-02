'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing, MergedBoxes } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * The upper storey — deliberately not a box stacked on the ground floor. A
 * long east volume cantilevers past the building line over the terrace, a
 * two-storey slot is cut above the entrance, and the west volume gives up
 * its front to a parapeted roof terrace.
 */
export function VillaUpperFloor({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="UpperFloor">
      {/* Floor plate stands slightly proud of the walls to draw a shadow line. */}
      <Massing specs={layout.upperFloor.slab} material={materials.darkMetal} />

      <group name="MainMass">
        {/* Punched enclosure walls merge to one mesh, as on the floor below. */}
        <MergedBoxes
          name="up-enclosure"
          specs={layout.upperFloor.mass}
          material={materials.concrete}
        />
      </group>

      <group name="Cantilever">
        <MergedBoxes
          name="up-cantilever-enclosure"
          specs={layout.upperFloor.cantilever}
          material={materials.concrete}
        />
      </group>

      <group name="Terrace">
        <Massing specs={layout.upperFloor.terrace} material={materials.stone} />
      </group>
    </group>
  );
}
