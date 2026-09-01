'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBlobs } from './LandscapePrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * A small, deliberate scatter of landscape rocks near the feature trees and
 * entrance beds — irregular deformed volumes in the villa's own stone tone,
 * so the landscape reads as continuous with the architecture.
 */
export function LandscapeRocks({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="LandscapeRocks">
      <MergedBlobs
        name="landscape-rocks"
        specs={layout.rocks}
        material={materials.stone}
        receiveShadow
      />
    </group>
  );
}
