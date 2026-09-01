'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * The plinth the residence sits on. A dark inset base sets up a shadow gap
 * so the stone platform reads as floating just above the terrain.
 */
export function VillaFoundation({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Foundation">
      <Massing specs={layout.foundation.plinth} material={materials.stone} />
      <Massing specs={layout.foundation.reveal} material={materials.darkMetal} castShadow={false} />
    </group>
  );
}
