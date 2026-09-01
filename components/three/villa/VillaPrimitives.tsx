'use client';

import type { Material } from 'three';
import type { BoxSpec, ColumnSpec, PanelSpec } from './VillaTypes';
import { getVillaGeometries } from './VillaGeometry';

type MassingProps = {
  specs: readonly BoxSpec[];
  material: Material;
  /** Glazing and trim read better without self-shadowing. */
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/** Renders volumes as transforms of the shared unit cube. */
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

/** Renders glazing as transforms of the shared unit plane. */
export function Panels({ specs, material }: { specs: readonly PanelSpec[]; material: Material }) {
  const geometry = getVillaGeometries().panel;

  return (
    <>
      {specs.map((spec) => (
        <mesh
          key={spec.key}
          name={spec.key}
          geometry={geometry}
          material={material}
          position={spec.position}
          rotation={spec.rotation}
          scale={spec.scale}
          receiveShadow
        />
      ))}
    </>
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
