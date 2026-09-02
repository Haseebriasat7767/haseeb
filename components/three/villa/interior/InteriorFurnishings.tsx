'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes, MergedSupports, UPHOLSTERY_CHAMFER } from '../VillaPrimitives';
import type { InteriorLayout } from './InteriorTypes';

/**
 * Every piece of furniture in the residence, drawn as one merged mesh per
 * material. Sorting by material rather than by room is what keeps a fully
 * furnished two-storey house inside the same draw-call budget the empty
 * shell had.
 */
export function InteriorFurnishings({ layout }: { layout: InteriorLayout }) {
  const materials = getMaterials();
  const parts = layout.furniture;

  return (
    <group name="InteriorFurnishings">
      <MergedBoxes name="furniture-joinery" specs={parts.joinery} material={materials.joinery} />
      {/* Seats, backs, arms and mattresses take a far softer edge than the
          building does — a cushion breaks over a couple of centimetres. */}
      <MergedBoxes
        name="furniture-soft"
        specs={parts.soft}
        material={materials.upholstery}
        chamfer={UPHOLSTERY_CHAMFER}
      />
      <MergedBoxes
        name="furniture-soft-dark"
        specs={parts.softDark}
        material={materials.upholsteryDark}
        chamfer={UPHOLSTERY_CHAMFER}
      />
      <MergedBoxes name="furniture-stone" specs={parts.stone} material={materials.marble} />
      <MergedBoxes name="furniture-metal" specs={parts.metal} material={materials.bronze} />
      <MergedBoxes name="furniture-dark" specs={parts.dark} material={materials.darkMetal} />
      <MergedBoxes name="furniture-ceramic" specs={parts.ceramic} material={materials.ceramic} />
      <MergedBoxes
        name="furniture-glass"
        specs={parts.glass}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes
        name="furniture-rugs"
        specs={parts.rugs}
        material={materials.rug}
        castShadow={false}
        chamfer={UPHOLSTERY_CHAMFER}
      />
      <MergedBoxes name="furniture-plaster" specs={parts.plaster} material={materials.plaster} />
      {/* Emissive fixture faces: lit surfaces, not light sources. */}
      <MergedBoxes
        name="furniture-glow"
        specs={parts.glow}
        material={materials.lightGlow}
        castShadow={false}
        receiveShadow={false}
      />
      <MergedSupports name="furniture-posts" specs={parts.posts} material={materials.bronze} />
    </group>
  );
}

export default InteriorFurnishings;
