'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes, Supports } from '../VillaPrimitives';
import type { OpeningsGeometry } from './OpeningTypes';

/**
 * The main entrance: an oversized pivot leaf in dark timber, offset toward
 * one jamb with a glazed sidelight filling the rest of the opening, and a
 * single tall handle. It sits at the back of the three-metre entrance
 * recess, under the canopy, so it reads as the focus of the front elevation.
 */
export function EntranceDoor({ openings }: { openings: OpeningsGeometry }) {
  const materials = getMaterials();

  return (
    <group name="Entrance">
      <MergedBoxes
        name="entrance-frame"
        specs={openings.entrance.frames}
        material={materials.frameMetal}
      />
      <MergedBoxes name="entrance-leaf" specs={openings.entrance.leaf} material={materials.wood} />
      <MergedBoxes
        name="entrance-sidelight"
        specs={openings.entrance.glassClear}
        material={materials.glazing}
        castShadow={false}
      />
      <Supports specs={openings.entrance.handle} material={materials.frameMetal} />
    </group>
  );
}
