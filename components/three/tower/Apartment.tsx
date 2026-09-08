'use client';

import { useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import { FormRenderer } from '../villa/furniture/FormRenderer';
import { FoliageCards } from '../villa/landscape/FoliageCards';
import { createFoliageCards } from '../villa/landscape/FoliageGeometry';
import { MergedBoxes, MergedSupports, SOFT_RADIUS, SOFT_SEGMENTS } from '../villa/VillaPrimitives';
import type { DetailTier } from '../villa/VillaTypes';
import { ArtworkPanels } from '../ArtworkPanels';
import { InstancedModels } from '../models/InstancedModels';
import type { ApartmentLayout } from './ApartmentGeometry';

/**
 * The fitted-out apartment, drawn as one merged mesh per material.
 *
 * Same technique the residence's interiors use, and for the same reason: a
 * room with a millwork wall, a fluted panel, five shelves of objects and
 * two indoor trees is several hundred volumes, and sorted by material it is
 * about fifteen draw calls.
 */
export function Apartment({
  layout,
  detail = 'high',
}: {
  layout: ApartmentLayout;
  detail?: DetailTier;
}) {
  const materials = getMaterials();
  const { parts, forms, walls, soffit, models, artwork, artBodies } = layout;

  // Indoor trees share the outdoor cards, scaled well down: a crown outside
  // is mostly gaps and runs several times its own radius in card size,
  // where a potted tree is a dense little mass and cards that big would
  // fill the room.
  const plantCards = useMemo(
    () =>
      createFoliageCards(parts.foliageClusters, detail, { sizeScale: 0.6, cells: [0, 1, 2, 3] }),
    [parts.foliageClusters, detail],
  );

  return (
    <group name="Apartment">
      <MergedBoxes name="apt-walls" specs={walls} material={materials.plaster} />
      <MergedBoxes name="apt-soffit" specs={soffit} material={materials.plaster} />

      <FormRenderer name="apt-forms" forms={forms} />

      {/* DEC-03. The stretchers are merged with the rest of the dark metal;
          the faces cannot be, because each is a different image. */}
      <MergedBoxes
        name="apt-art-bodies"
        specs={artBodies}
        material={materials.darkMetal}
        castShadow={false}
      />
      <ArtworkPanels name="apt-artwork" works={artwork} />

      {/* The Blender-authored pieces, batched by piece rather than cloned
          per placement — the same reason the retail fit-out is. A pair of
          nightstands and a pair of table lamps are four placements of two
          models, and should cost what two models cost. */}
      <InstancedModels name="apt-models" placements={models} />

      <MergedBoxes name="apt-joinery" specs={parts.joinery} material={materials.joinery} />
      <MergedBoxes name="apt-plaster" specs={parts.plaster} material={materials.plaster} />
      <MergedBoxes
        name="apt-soft"
        specs={parts.soft}
        material={materials.upholstery}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes name="apt-stone" specs={parts.stone} material={materials.marble} />
      <MergedBoxes name="apt-metal" specs={parts.metal} material={materials.bronze} />
      <MergedBoxes name="apt-dark" specs={parts.dark} material={materials.darkMetal} />
      <MergedBoxes name="apt-ceramic" specs={parts.ceramic} material={materials.ceramic} />
      <MergedBoxes name="apt-paper" specs={parts.paper} material={materials.paper} />
      <MergedBoxes
        name="apt-rugs"
        specs={parts.rugs}
        material={materials.rug}
        castShadow={false}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes
        name="apt-sheer"
        specs={parts.sheer}
        material={materials.sheer}
        castShadow={false}
      />
      {/* The recesses the light lines sit in — matte and black, because a
          cove is a void with a light in it, not a surface to be seen. */}
      <MergedBoxes
        name="apt-channels"
        specs={parts.channel}
        material={materials.lightChannel}
        castShadow={false}
      />
      <MergedBoxes
        name="apt-strips"
        specs={parts.strip}
        material={materials.lightStrip}
        castShadow={false}
        receiveShadow={false}
      />
      <MergedSupports name="apt-posts" specs={parts.posts} material={materials.bronze} />
      <FoliageCards name="apt-plants" cards={plantCards} castShadow={detail === 'high'} />
    </group>
  );
}

export default Apartment;
