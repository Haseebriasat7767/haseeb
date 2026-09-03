'use client';

import { useMemo } from 'react';
import type { ResolvedLighting } from '@/lib/three/lighting';
import type { DetailTier, VillaLevels, VillaPlan } from '../VillaTypes';
import { createInteriorLayout, INTERIOR_CONFIG } from './InteriorGeometry';
import { InteriorArchitecture } from './InteriorArchitecture';
import { InteriorFurnishings } from './InteriorFurnishings';
import type { InteriorConfig } from './InteriorTypes';

type InteriorProps = {
  plan: VillaPlan;
  levels: VillaLevels;
  config?: Partial<InteriorConfig>;
  detail?: DetailTier;
  /** Decides how many practicals run, and how brightly. */
  lighting: ResolvedLighting;
};

/**
 * The residence's interiors — rooms, finishes, joinery, and furniture,
 * generated entirely from the villa's own plan lines and levels.
 *
 * Like `SiteExterior` and `LandscapeExterior`, this composes a pure layout
 * function and mounts the result; nothing here holds state, and no geometry
 * or material is created outside the shared caches.
 */
export function Interior({ plan, levels, config, detail = 'high', lighting }: InteriorProps) {
  const layout = useMemo(
    () =>
      createInteriorLayout(
        config ? { ...INTERIOR_CONFIG, ...config } : INTERIOR_CONFIG,
        plan,
        levels,
        detail,
      ),
    [config, plan, levels, detail],
  );

  return (
    <group name="Interior">
      <InteriorArchitecture layout={layout} />
      <InteriorFurnishings layout={layout} detail={detail} />

      {/*
        Practicals, in the plan's own ranked order. How many run and how
        brightly is the time of day's decision, capped by the quality tier —
        so a daylit house shows two, a house at night shows all seven, and a
        low-tier device shows none and lets the emissive fixtures carry it.
      */}
      {layout.lights.slice(0, lighting.interiorLightCount).map((light) => (
        <pointLight
          key={light.key}
          name={light.key}
          position={light.position}
          intensity={light.intensity * lighting.interior.intensity}
          distance={light.distance}
          decay={2}
          color={light.color}
          castShadow={false}
        />
      ))}
    </group>
  );
}

export default Interior;
