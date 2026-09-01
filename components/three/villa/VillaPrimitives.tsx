'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoxSpec, ColumnSpec } from './VillaTypes';
import { getVillaGeometries } from './VillaGeometry';

type MassingProps = {
  specs: readonly BoxSpec[];
  material: Material;
  /** Glazing and trim read better without self-shadowing. */
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/**
 * Renders volumes as transforms of the shared unit cube. Used for the primary
 * architectural masses, which stay individually named so later phases can
 * address them.
 */
export function Massing({
  specs,
  material,
  castShadow = true,
  receiveShadow = true,
}: MassingProps) {
  const geometry = getVillaGeometries().box;

  return (
    <>
      {specs.map((spec) => (
        <mesh
          key={spec.key}
          name={spec.key}
          geometry={geometry}
          material={material}
          position={spec.position}
          scale={spec.scale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      ))}
    </>
  );
}

type MergedBoxesProps = MassingProps & { name: string };

/**
 * Bakes many volumes into a single geometry, so a facade's worth of frames,
 * mullions, or skin panels costs one draw call instead of a hundred. Used for
 * repeated detail elements, which never need to be addressed individually.
 */
export function MergedBoxes({
  specs,
  material,
  name,
  castShadow = true,
  receiveShadow = true,
}: MergedBoxesProps) {
  const geometry = useMemo<BufferGeometry | null>(() => {
    if (specs.length === 0) return null;

    const parts = specs.map((spec) => {
      const part = new BoxGeometry(1, 1, 1);
      part.scale(...spec.scale);
      part.translate(...spec.position);
      return part;
    });

    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged;
  }, [specs]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh
      name={name}
      geometry={geometry}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Renders supports as transforms of the shared unit cylinder. */
export function Supports({
  specs,
  material,
}: {
  specs: readonly ColumnSpec[];
  material: Material;
}) {
  const geometry = getVillaGeometries().column;

  return (
    <>
      {specs.map((spec) => (
        <mesh
          key={spec.key}
          name={spec.key}
          geometry={geometry}
          material={material}
          position={spec.position}
          scale={spec.scale}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
}
