'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Fog } from 'three';
import { LIGHTING } from '@/lib/three/scene-config';

type EnvironmentProps = {
  shadows: boolean;
  shadowMapSize: number;
};

/**
 * Code-only lighting environment: one directional key light shaped like a
 * low sun, a sky/ground hemisphere fill, and a warm bounce. No HDRI is
 * fetched, so the scene has zero external asset dependencies.
 */
export function SceneEnvironment({ shadows, shadowMapSize }: EnvironmentProps) {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    scene.fog = new Fog(LIGHTING.fogColor, LIGHTING.fogNear, LIGHTING.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return (
    <>
      <hemisphereLight
        args={[LIGHTING.ambientColor, LIGHTING.fogColor, LIGHTING.ambientIntensity]}
      />

      <directionalLight
        position={[...LIGHTING.sunPosition]}
        intensity={LIGHTING.sunIntensity}
        color={LIGHTING.sunColor}
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0004}
      />

      <directionalLight
        position={[-14, 4, -10]}
        intensity={LIGHTING.bounceIntensity}
        color={LIGHTING.bounceColor}
      />
    </>
  );
}
