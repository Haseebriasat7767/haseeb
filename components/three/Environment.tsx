'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Fog } from 'three';
import type { ResolvedLighting } from '@/lib/three/lighting';
import { applyLightingToMaterials } from '@/lib/three/lighting-materials';
import { ProceduralSky } from './ProceduralSky';

type EnvironmentProps = {
  lighting: ResolvedLighting;
  shadows: boolean;
  shadowMapSize: number;
  /** Exposure compensation for the active framing, in stops. */
  exposure?: number;
};

/**
 * The cinematic lighting rig: one key sun, a sky/ground hemisphere, and a
 * single shadowless bounce standing in for light returned off the paving
 * and the plinth. Three lights, whatever the hour — everything that changes
 * between morning and night is colour, angle, exposure, and which
 * *practical* fixtures elsewhere in the scene are switched on.
 *
 * Code-only: no HDRI is fetched and no environment map exists, which is
 * also why the metals are tuned the way they are in `materials.ts`.
 */
export function SceneEnvironment({
  lighting,
  shadows,
  shadowMapSize,
  exposure = 0,
}: EnvironmentProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const { atmosphere, sun, sky, bounce } = lighting;

  useEffect(() => {
    scene.fog = new Fog(atmosphere.fogColor, atmosphere.fogNear, atmosphere.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene, atmosphere.fogColor, atmosphere.fogNear, atmosphere.fogFar]);

  // Exposure and the hour-dependent material responses are owned here, so
  // the renderer and the material library never disagree about the time of
  // day. `invalidate` matters because fixed-camera views render on demand.
  useEffect(() => {
    // A stop is a doubling, so the framing's compensation is a power of two
    // on the hour's own exposure rather than an addition to it.
    gl.toneMappingExposure = atmosphere.exposure * Math.pow(2, exposure);
    applyLightingToMaterials(lighting);
    invalidate();
  }, [gl, invalidate, lighting, atmosphere.exposure, exposure]);

  return (
    <>
      <ProceduralSky lighting={lighting} />

      {/* The hemisphere is now a small corrective on top of image-based
          light from the sky dome, not the ambient term itself — it keeps a
          little colour separation between what faces up and what faces
          down, which a single environment map alone does not give. */}
      <hemisphereLight args={[sky.skyColor, sky.groundColor, sky.intensity]} />

      <directionalLight
        name="key-sun"
        position={lighting.sunPosition}
        intensity={sun.intensity}
        color={sun.color}
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={1}
        // Sized from the sun's own elevation: a low key throws long shadows,
        // and a frustum tuned for midday would clip them off mid-terrace.
        shadow-camera-far={lighting.shadowFar}
        shadow-camera-left={-lighting.shadowExtent}
        shadow-camera-right={lighting.shadowExtent}
        shadow-camera-top={lighting.shadowExtent}
        shadow-camera-bottom={-lighting.shadowExtent}
        shadow-bias={sun.shadowBias}
        // Removes shadow acne where the sun grazes the large horizontal planes.
        shadow-normalBias={sun.shadowNormalBias}
      />

      <directionalLight
        name="architectural-bounce"
        position={lighting.bouncePosition}
        intensity={bounce.intensity}
        color={bounce.color}
      />
    </>
  );
}
