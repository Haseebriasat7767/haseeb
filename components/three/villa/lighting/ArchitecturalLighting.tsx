'use client';

import { useMemo } from 'react';
import { Object3D } from 'three';
import { getMaterials } from '@/lib/three/materials';
import type { ResolvedLighting } from '@/lib/three/lighting';
import { MergedBoxes } from '../VillaPrimitives';
import type { ArchitecturalLightingLayout, FixtureLight } from './LightingTypes';

/**
 * A spot needs a target object in the scene graph. It never moves, so it is
 * built once and mounted alongside the light rather than animated.
 */
function AimedSpot({ spec, intensity }: { spec: FixtureLight; intensity: number }) {
  const target = useMemo(() => {
    const object = new Object3D();
    if (spec.target) object.position.set(...spec.target);
    object.updateMatrixWorld();
    return object;
  }, [spec.target]);

  return (
    <>
      <primitive object={target} />
      <spotLight
        name={spec.key}
        position={spec.position}
        target={target}
        intensity={intensity}
        distance={spec.distance}
        angle={spec.angle}
        penumbra={spec.penumbra}
        decay={2}
        color={spec.color}
        castShadow={false}
      />
    </>
  );
}

type ArchitecturalLightingProps = {
  layout: ArchitecturalLightingLayout;
  lighting: ResolvedLighting;
};

/**
 * The exterior lighting scheme. The fixtures themselves are geometry — two
 * merged meshes, one dark housing and one emissive face — and they carry
 * most of the read on their own; the dynamic lights are the few places
 * where light actually has to fall on something.
 *
 * How many of those are mounted is the product of the hour and the quality
 * tier: none in daylight, where they would be invisible anyway, and none on
 * the low tier, where the emissive faces do the whole job.
 */
export function ArchitecturalLighting({ layout, lighting }: ArchitecturalLightingProps) {
  const materials = getMaterials();
  const active = layout.lights.slice(0, lighting.exteriorLightCount);
  const base = lighting.exterior.intensity;

  return (
    <group name="ArchitecturalLighting">
      <MergedBoxes
        name="fixture-housings"
        specs={layout.housings}
        material={materials.darkMetal}
        castShadow={false}
      />
      <MergedBoxes
        name="fixture-glow"
        specs={layout.glow}
        material={materials.lightGlow}
        castShadow={false}
        receiveShadow={false}
      />

      {active.map((spec) =>
        spec.kind === 'spot' ? (
          <AimedSpot key={spec.key} spec={spec} intensity={spec.intensity * base} />
        ) : (
          <pointLight
            key={spec.key}
            name={spec.key}
            position={spec.position}
            intensity={spec.intensity * base}
            distance={spec.distance}
            decay={2}
            color={spec.color}
            castShadow={false}
          />
        ),
      )}
    </group>
  );
}

export default ArchitecturalLighting;
