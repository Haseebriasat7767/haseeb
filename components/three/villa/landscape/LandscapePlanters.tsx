'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * The soil cap on each Phase 2C planter — an inset dark band at the rim,
 * standing in for exposed earth beneath the plant cluster `Shrubs`/
 * `Grasses` renders above it. No texture: soil reads through material
 * alone.
 */
export function LandscapePlanters({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="LandscapePlanters">
      <MergedBoxes
        name="planter-soil"
        specs={layout.planterSoil}
        material={materials.soil}
        castShadow={false}
      />
    </group>
  );
}
