'use client';

import { FormRenderer } from '../furniture/FormRenderer';
import { useMemo } from 'react';
import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes, MergedSupports, SOFT_RADIUS, SOFT_SEGMENTS } from '../VillaPrimitives';
import type { DetailTier, VillaPlan } from '../VillaTypes';
import { ARRIVAL_CONFIG, createEstateLayout, OUTDOOR_CONFIG } from './EstateGeometry';
import type { EstateLayout } from './EstateTypes';
import type { SiteLayout } from './SiteTypes';

/**
 * The estate around the residence: the arrival sequence, and the outdoor
 * furniture that turns a paved terrace into somewhere people sit.
 *
 * One merged mesh per material, exactly as the villa and its interior do,
 * so a fully furnished terrace and a driveway together cost a handful of
 * draw calls rather than one per object.
 */
export function EstateExterior({ layout }: { layout: EstateLayout }) {
  const materials = getMaterials();

  return (
    <group name="EstateExterior">
      {/* Outdoor furniture — loungers, sofas, dining chairs. Rounded and
          turned geometry, merged per material exactly like the paving. */}
      <FormRenderer name="estate-forms" forms={layout.forms} />
      <MergedBoxes name="estate-paving" specs={layout.paving} material={materials.paving} />
      <MergedBoxes name="estate-kerbs" specs={layout.kerbs} material={materials.stone} />
      <MergedBoxes name="estate-timber" specs={layout.timber} material={materials.teak} />
      {/* Outdoor upholstery takes the same soft edge the interior seating
          does — a cushion breaks over centimetres, not millimetres. */}
      <MergedBoxes
        name="estate-cushions"
        specs={layout.cushions}
        material={materials.upholstery}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes
        name="estate-accents"
        specs={layout.accents}
        material={materials.upholsteryDark}
        chamfer={SOFT_RADIUS}
        chamferSegments={SOFT_SEGMENTS}
      />
      <MergedBoxes name="estate-stone" specs={layout.stone} material={materials.stone} />
      <MergedBoxes name="estate-metal" specs={layout.metal} material={materials.darkMetal} />
      <MergedSupports name="estate-posts" specs={layout.posts} material={materials.darkMetal} />
      {/* Lit lantern faces: emissive surfaces, not light sources. The hour
          decides their brightness through `applyLightingToMaterials`. */}
      <MergedBoxes
        name="estate-glow"
        specs={layout.glow}
        material={materials.lightGlow}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}

/** Resolves the estate from the building and the site it already stands on. */
export function useEstateLayout(
  plan: VillaPlan,
  site: SiteLayout,
  detail: DetailTier,
): EstateLayout {
  return useMemo(
    () => createEstateLayout(ARRIVAL_CONFIG, OUTDOOR_CONFIG, plan, site, detail),
    [plan, site, detail],
  );
}

export default EstateExterior;
