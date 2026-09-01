'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { getMaterials } from '@/lib/three/materials';
import { SITE_GEOMETRY } from '@/lib/three/scene-config';

/**
 * PHASE 1 PLACEHOLDER ONLY.
 *
 * A ground plane, a podium, and two architectural blocks — just enough to
 * prove the render pipeline, lighting, and shadows work. Phase 2 replaces
 * this with procedurally generated villa geometry; the surrounding scene
 * architecture does not need to change.
 */
export function PlaceholderMassing() {
  const materials = useMemo(() => getMaterials(), []);
  const groupRef = useRef<Group>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.traverse((object) => {
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }, []);

  const { block, wing, podium, groundSize } = SITE_GEOMETRY;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        material={materials.terrain}
      >
        <planeGeometry args={[groundSize, groundSize]} />
      </mesh>

      <group ref={groupRef}>
        <mesh position={[0, podium.height / 2, 0]} material={materials.stone}>
          <boxGeometry args={[podium.width, podium.height, podium.depth]} />
        </mesh>

        <mesh position={[0, podium.height + block.height / 2, 0]} material={materials.concrete}>
          <boxGeometry args={[block.width, block.height, block.depth]} />
        </mesh>

        <mesh
          position={[
            block.width / 2 + wing.width / 2 - 1,
            podium.height + wing.height / 2,
            -block.depth / 2 + wing.depth / 2,
          ]}
          material={materials.concrete}
        >
          <boxGeometry args={[wing.width, wing.height, wing.depth]} />
        </mesh>

        <mesh
          position={[0, podium.height + block.height / 2, block.depth / 2 + 0.02]}
          material={materials.glass}
        >
          <planeGeometry args={[block.width - 1.6, block.height - 1.4]} />
        </mesh>
      </group>
    </group>
  );
}
