'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBlades } from './LandscapePrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * Every ornamental-grass blade on site, merged into one mesh. Each cluster
 * is 5–15 tapered blades scattered within a small radius, not a field.
 */
export function Grasses({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="Grasses">
      <MergedBlades name="grass" specs={layout.grass} material={materials.grass} />
    </group>
  );
}
