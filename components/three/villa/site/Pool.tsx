'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing, MergedBoxes } from '../VillaPrimitives';
import type { SiteLayout } from './SiteTypes';

/**
 * The infinity pool. Basin, submerged steps, and the overflow channel share
 * one dark plaster mesh; coping is a separate light-stone band; water is a
 * single thin, static surface — no simulation, no reflection target, no
 * transmission. The far wall is deliberately shorter than the other three
 * (a weir) so the water reads as running to the edge rather than being held
 * by a visible parapet.
 */
export function Pool({ layout }: { layout: SiteLayout }) {
  const materials = getMaterials();

  return (
    <group name="Pool">
      <MergedBoxes
        name="pool-interior"
        specs={layout.pool.interior}
        material={materials.poolInterior}
        castShadow={false}
      />
      <MergedBoxes name="pool-coping" specs={layout.pool.coping} material={materials.stone} />
      <Massing
        specs={layout.pool.water}
        material={materials.poolWater}
        castShadow={false}
        receiveShadow
      />
    </group>
  );
}
