'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { SiteLayout } from './SiteTypes';

/**
 * A small, deliberate set of raised stone planters marking the deck's
 * arrival corners and its threshold with the sunken lounge — geometry only,
 * establishing where planting beds will land in a later phase.
 */
export function SitePlanters({ layout }: { layout: SiteLayout }) {
  const materials = getMaterials();

  return (
    <group name="SitePlanters">
      <MergedBoxes name="site-planters" specs={layout.planters} material={materials.stone} />
    </group>
  );
}
