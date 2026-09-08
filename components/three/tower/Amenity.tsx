'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../villa/VillaPrimitives';
import { InstancedModels } from '../models/InstancedModels';
import type { AmenityLayout } from './AmenityGeometry';

/**
 * The amenity floor, drawn as one merged mesh per material.
 *
 * Same contract as the apartment: the fabric merges, the furniture instances,
 * and nothing here is its own draw call for the sake of being its own object.
 */
export function Amenity({ layout }: { layout: AmenityLayout }) {
  const materials = getMaterials();

  return (
    <group name="Amenity">
      <MergedBoxes name="amn-walls" specs={layout.walls} material={materials.plaster} />
      {/* Tiled, not plastered. A wet room is the one part of a residential
          floor whose finish is decided by water rather than by taste. */}
      <MergedBoxes name="amn-tiling" specs={layout.tiling} material={materials.interiorStone} />
      <MergedBoxes name="amn-joinery" specs={layout.joinery} material={materials.teak} />
      <MergedBoxes name="amn-soft" specs={layout.soft} material={materials.rug} />
      {/* The gym mirror and the sauna door. Neither casts: a mirror that
          throws a shadow reads as a dark panel, which is the opposite of
          what it is doing. */}
      <MergedBoxes
        name="amn-mirrors"
        specs={layout.mirrors}
        material={materials.glazing}
        castShadow={false}
      />
      <MergedBoxes
        name="amn-plunge-shell"
        specs={layout.plungeShell}
        material={materials.poolInterior}
      />
      <MergedBoxes
        name="amn-plunge-water"
        specs={layout.plungeWater}
        material={materials.poolWater}
        castShadow={false}
      />
      <InstancedModels name="amn-models" placements={layout.models} />
    </group>
  );
}

export default Amenity;
