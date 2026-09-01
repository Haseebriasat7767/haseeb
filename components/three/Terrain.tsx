'use client';

import { getMaterials } from '@/lib/three/materials';
import { SITE_GEOMETRY } from '@/lib/three/scene-config';

/**
 * The site ground plane. Shared by every scene content option, so it lives
 * beside the Canvas rather than inside any one building component.
 * Landscaping arrives in a later phase.
 */
export function Terrain() {
  const materials = getMaterials();

  return (
    <mesh
      name="Terrain"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
      material={materials.terrain}
    >
      <planeGeometry args={[SITE_GEOMETRY.groundSize, SITE_GEOMETRY.groundSize]} />
    </mesh>
  );
}
