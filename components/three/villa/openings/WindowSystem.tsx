'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { OpeningsGeometry } from './OpeningTypes';

/**
 * The punched facade layer and every fixed window in it.
 *
 * Depth comes from construction rather than from a texture: the skin is a
 * real layer over the structural mass with the openings left out, so each
 * window sits at the back of a genuine recess and the reveal casts its own
 * shadow. The frame is slim and dark, and the glass sits behind it again.
 */
export function WindowSystem({ openings }: { openings: OpeningsGeometry }) {
  const materials = getMaterials();

  return (
    <group name="Windows">
      <MergedBoxes name="facade-skin" specs={openings.skin} material={materials.concrete} />
      <MergedBoxes name="facade-skin-stone" specs={openings.skinStone} material={materials.stone} />
      <MergedBoxes
        name="facade-skin-reveals"
        specs={openings.skinReveals}
        material={materials.darkMetal}
        castShadow={false}
      />
      <MergedBoxes
        name="window-frames"
        specs={openings.windows.frames}
        material={materials.frameMetal}
      />
      <MergedBoxes
        name="window-glass"
        specs={openings.windows.glassOpaque}
        material={materials.glazingSurface}
        castShadow={false}
      />
      <MergedBoxes
        name="window-glass-clear"
        specs={openings.windows.glassClear}
        material={materials.glazing}
        castShadow={false}
      />
    </group>
  );
}
