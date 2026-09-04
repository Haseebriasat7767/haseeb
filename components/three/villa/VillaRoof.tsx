'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes, Massing } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * A thin flat slab that oversails the walls on every elevation, cutting the
 * deep horizontal shadow line the composition depends on. A low upstand
 * parapet keeps the roof usable for later phases without adding bulk, and a
 * drip groove runs under every projecting edge — see `VillaGeometry` for
 * why that groove is worth more at hero distance than any surface detail.
 */
export function VillaRoof({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Roof">
      <Massing specs={layout.roof.slabs} material={materials.concrete} />
      <Massing specs={layout.roof.parapets} material={materials.concrete} />
      {/* The drip grooves under every oversailing edge. Dark, because what
          is being drawn is the shadow inside a twenty-millimetre groove and
          not the groove's own surface — nothing at this size is lit. */}
      <MergedBoxes
        name="roof-drips"
        specs={layout.roof.drips}
        material={materials.darkMetal}
        castShadow={false}
      />
    </group>
  );
}
