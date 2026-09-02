'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes, MergedSupports, SOFT_RADIUS, SOFT_SEGMENTS } from '../VillaPrimitives';
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
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes
        name="furniture-soft-dark"
        specs={parts.softDark}
        material={materials.upholsteryDark}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
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
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes name="furniture-plaster" specs={parts.plaster} material={materials.plaster} />
      {/* Curtains take the softest edge in the house: fabric hanging in
          folds has no arris at all. */}
      <MergedBoxes
        name="furniture-drapery"
        specs={parts.drapery}
        material={materials.drapery}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes
        name="furniture-sheer"
        specs={parts.sheer}
        material={materials.sheer}
        castShadow={false}
      />
      <MergedBoxes name="furniture-paper" specs={parts.paper} material={materials.paper} />
      <MergedBoxes
        name="furniture-foliage"
        specs={parts.foliage}
        material={materials.indoorFoliage}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
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
