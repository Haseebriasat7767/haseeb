'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * The detailing that keeps large planes from reading as bare slabs: vertical
 * fins shading the east elevation, dark soffits under every overhang, and
 * the caps and shadow gaps at the parapet and terrace lines.
 */
export function VillaFacade({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Facade">
      <MergedBoxes name="facade-fins" specs={layout.facade.fins} material={materials.concrete} />
      <MergedBoxes
        name="facade-soffits"
        specs={layout.facade.soffits}
        material={materials.darkMetal}
        castShadow={false}
      />
      <MergedBoxes
        name="facade-reveals"
        specs={layout.facade.reveals}
        material={materials.darkMetal}
      />
    </group>
  );
}
