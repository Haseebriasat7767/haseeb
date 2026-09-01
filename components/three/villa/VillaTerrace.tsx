'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * The main terrace deck spanning the front of the plinth, edged with a dark
 * trim. Left deliberately empty — furniture and water come in later phases.
 */
export function VillaTerrace({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Terrace">
      <Massing specs={layout.terrace.deck} material={materials.concrete} castShadow={false} />
      <Massing specs={layout.terrace.trim} material={materials.darkMetal} castShadow={false} />
    </group>
  );
}
