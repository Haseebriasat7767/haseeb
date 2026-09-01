'use client';

import { getMaterials } from '@/lib/three/materials';
import { Panels } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * Floor-to-ceiling glazing. Openings span a genuine void between volumes and
 * are transparent; surface panes sit on the face of a solid volume and are
 * opaque, so they read as windows rather than tinted film. Frames, mullions,
 * and sliding panels arrive in Phase 2B.
 */
export function VillaGlazing({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Glazing">
      <Panels specs={layout.glazing.openings} material={materials.glazing} />
      <Panels specs={layout.glazing.surfaces} material={materials.glazingSurface} />
    </group>
  );
}
