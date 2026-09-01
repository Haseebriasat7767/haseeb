'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from './VillaPrimitives';
import type { VillaLayout } from './VillaTypes';

/**
 * Frameless glass balustrades to the roof terrace — a slim dark top rail and
 * minimal posts, so the terrace keeps its view instead of being closed in by
 * a solid parapet.
 */
export function VillaRailings({ layout }: { layout: VillaLayout }) {
  const materials = getMaterials();

  return (
    <group name="Railings">
      <MergedBoxes
        name="railing-glass"
        specs={layout.railings.glass}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes
        name="railing-rails"
        specs={layout.railings.rails}
        material={materials.frameMetal}
      />
      <MergedBoxes
        name="railing-posts"
        specs={layout.railings.posts}
        material={materials.frameMetal}
      />
    </group>
  );
}
