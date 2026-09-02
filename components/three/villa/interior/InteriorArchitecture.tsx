'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { InteriorLayout } from './InteriorTypes';

/**
 * The built interior: floor and ceiling finishes, the partitions dividing
 * each structural volume into rooms, feature panelling, the connecting
 * stair, and the foyer laylight.
 *
 * Everything is merged per material, so the whole of the residence's
 * interior architecture costs seven draw calls rather than one per surface.
 */
export function InteriorArchitecture({ layout }: { layout: InteriorLayout }) {
  const materials = getMaterials();

  return (
    <group name="InteriorArchitecture">
      <MergedBoxes
        name="interior-floors-stone"
        specs={layout.floorsStone}
        material={materials.interiorStone}
        castShadow={false}
      />
      <MergedBoxes
        name="interior-floors-timber"
        specs={layout.floorsTimber}
        material={materials.joinery}
        castShadow={false}
      />
      <MergedBoxes
        name="interior-ceilings"
        specs={layout.ceilings}
        material={materials.plaster}
        castShadow={false}
      />
      <MergedBoxes
        name="interior-partitions"
        specs={layout.partitions}
        material={materials.plaster}
      />
      <MergedBoxes
        name="interior-panelling"
        specs={layout.panelling}
        material={materials.plaster}
      />
      <MergedBoxes name="interior-stair" specs={layout.stairs} material={materials.interiorStone} />
      <MergedBoxes
        name="interior-laylight-frame"
        specs={layout.laylight.frame}
        material={materials.frameMetal}
      />
      <MergedBoxes
        name="interior-laylight-glass"
        specs={layout.laylight.glass}
        material={materials.glazing}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}

export default InteriorArchitecture;
