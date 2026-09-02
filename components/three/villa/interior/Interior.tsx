'use client';

import { useMemo } from 'react';
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
};

/**
 * The residence's interiors — rooms, finishes, joinery, and furniture,
 * generated entirely from the villa's own plan lines and levels.
 *
 * Like `SiteExterior` and `LandscapeExterior`, this composes a pure layout
 * function and mounts the result; nothing here holds state, and no geometry
 * or material is created outside the shared caches.
 */
export function Interior({ plan, levels, config, detail = 'high' }: InteriorProps) {
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
      <InteriorFurnishings layout={layout} />

      {/*
        A handful of soft, shadowless fill lights so rooms behind glass read
        as inhabited. The quality tier decides how many are mounted at all —
        on the low tier the emissive fixtures carry the read on their own.
        Cinematic lighting and any post-processing belong to a later phase.
      */}
      {layout.lights.map((light) => (
        <pointLight
          key={light.key}
          name={light.key}
          position={light.position}
          intensity={light.intensity}
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
