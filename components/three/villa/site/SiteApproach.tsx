'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { SiteLayout } from './SiteTypes';

/**
 * The approach path: large, discretely spaced stone slabs continuing from
 * the villa's own entrance stairs out into the site — an architectural
 * stride, not a continuous game-style sidewalk.
 */
export function SiteApproach({ layout }: { layout: SiteLayout }) {
  const materials = getMaterials();

  return (
    <group name="SiteApproach">
      <MergedBoxes
        name="site-approach"
        specs={layout.paving.approach}
        material={materials.concrete}
        castShadow={false}
      />
    </group>
  );
}
