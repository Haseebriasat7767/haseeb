'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * A thin flat slab that oversails the walls on every elevation, cutting the
 * deep horizontal shadow line the composition depends on. A low upstand
 * parapet keeps the roof usable for later phases without adding bulk.
 */
export function VillaRoof({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Roof">
      <Massing specs={layout.roof.slabs} material={materials.concrete} />
      <Massing specs={layout.roof.parapets} material={materials.concrete} />
    </group>
  );
}
