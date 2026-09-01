'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { OpeningsGeometry } from './OpeningTypes';

/**
 * Sliding glass door systems. Leaves alternate between two track depths so
 * the assembly reads as overlapping panels rather than one fixed sheet, and
 * the bottom rail drops into a recessed threshold flush with the terrace.
 * Phase 2B is static — nothing opens yet.
 */
export function SlidingDoor({ openings }: { openings: OpeningsGeometry }) {
  const materials = getMaterials();

  return (
    <group name="SlidingDoors">
      <MergedBoxes
        name="slider-frames"
        specs={openings.sliding.frames}
        material={materials.frameMetal}
      />
      <MergedBoxes
        name="slider-threshold"
        specs={openings.sliding.thresholds}
        material={materials.frameMetal}
        castShadow={false}
      />
      <MergedBoxes
        name="slider-glass-clear"
        specs={openings.sliding.glassClear}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes
        name="slider-glass"
        specs={openings.sliding.glassOpaque}
        material={materials.glazingSurface}
        castShadow={false}
      />
    </group>
  );
}
