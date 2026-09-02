'use client';

import { getMaterials } from '@/lib/three/materials';
import { Massing, MergedBoxes } from '../VillaPrimitives';
import type { SiteLayout } from './SiteTypes';

/**
 * The infinity pool. Basin, submerged steps, and the overflow channel share
 * one dark plaster mesh; coping is a separate light-stone band; the water
 * body is a single thin static surface — no simulation and no transmission.
 *
 * A real planar reflector was tried here on the top tier, to mirror the
 * residence in the water rather than only the sky. It was removed: the
 * reflection it bought was barely legible at the angles the pool is ever
 * seen from, and being a second pass over the whole scene it doubled the
 * measured frame cost. The generated environment map already gives the
 * water the sky, the sun, and the warmth of the hour, which is most of
 * what a pool reflects at these viewing angles, for nothing extra.
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
