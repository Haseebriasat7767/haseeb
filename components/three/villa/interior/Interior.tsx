'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Object3D } from 'three';
import type { ResolvedLighting } from '@/lib/three/lighting';
import type { DetailTier, VillaLevels, VillaPlan } from '../VillaTypes';
import { createInteriorLayout, INTERIOR_CONFIG } from './InteriorGeometry';
import { InteriorArchitecture } from './InteriorArchitecture';
import { InteriorFurnishings } from './InteriorFurnishings';
import type { InteriorConfig, InteriorLight } from './InteriorTypes';

/**
 * How many interior lights may carry a shadow map, by tier.
 *
 * Two, on the best tier, and none below it. This is not timidity: a shadow
 * map is a full extra render of everything the light can see, and these
 * lights are in the scene during the *exterior* framings too, where their
 * shadows are barely visible through the glass. Two is what it takes to
 * give the living room and the master a floor their furniture sits on
 * rather than floats over, which is the whole point.
 */
const SHADOW_BUDGET: Record<string, number> = { high: 2, medium: 0, low: 0 };

/**
 * A ceiling downlight, aimed.
 *
 * A three.js spot light points at a `target` object that has to be in the
 * scene graph to have a world matrix, so the target is created here and
 * mounted alongside the light rather than being implied.
 */
function Downlight({
  light,
  intensity,
  castShadow,
}: {
  light: InteriorLight;
  intensity: number;
  castShadow: boolean;
}) {
  const target = useRef<Object3D>(new Object3D());

  useEffect(() => {
    const aim = light.target ?? [light.position[0], light.position[1] - 3, light.position[2]];
    target.current.position.set(aim[0], aim[1], aim[2]);
    target.current.updateMatrixWorld();
  }, [light.target, light.position]);

  return (
    <>
      <primitive object={target.current} />
      <spotLight
        name={light.key}
        position={light.position}
        target={target.current}
        angle={light.angle ?? 0.8}
        penumbra={light.penumbra ?? 0.85}
        intensity={intensity}
        distance={light.distance}
        decay={2}
        color={light.color}
        castShadow={castShadow}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-near={0.4}
        shadow-camera-far={light.distance}
      />
    </>
  );
}

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
      <InteriorFurnishings layout={layout} detail={detail} curtains={lighting.id !== 'night'} />

      {/*
        Practicals, in the plan's own ranked order. How many run and how
        brightly is the time of day's decision, capped by the quality tier —
        so a daylit house shows two, a house at night shows all seven, and a
        low-tier device shows none and lets the emissive fixtures carry it.
      */}
      {(() => {
        let shadowsLeft = SHADOW_BUDGET[lighting.tier] ?? 0;

        return layout.lights.slice(0, lighting.interiorLightCount).map((light) => {
          const intensity = light.intensity * lighting.interior.intensity;

          if (light.kind === 'spot') {
            const withShadow = Boolean(light.shadow) && shadowsLeft > 0;
            if (withShadow) shadowsLeft -= 1;
            return (
              <Downlight
                key={light.key}
                light={light}
                intensity={intensity}
                castShadow={withShadow}
              />
            );
          }

          return (
            <pointLight
              key={light.key}
              name={light.key}
              position={light.position}
              intensity={intensity}
              distance={light.distance}
              decay={2}
              color={light.color}
              castShadow={false}
            />
          );
        });
      })()}
    </group>
  );
}

export default Interior;
