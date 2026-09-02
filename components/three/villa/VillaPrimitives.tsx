'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { CylinderGeometry, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createChamferedBox } from './ChamferedBox';
import type { BoxSpec, ColumnSpec } from './VillaTypes';
import { getChamferedBox, getVillaGeometries } from './VillaPrimitiveCache';

/**
 * The edge treatment every volume below the villa root inherits, in metres.
 *
 * Threaded as context rather than as a prop because it applies to all
 * sixty-odd primitive call sites across the villa, the site, the landscape
 * and the interior, and none of those components has any business knowing
 * about quality tiers. `ProceduralVilla` sets it once from the resolved
 * tier; a call site that needs a different edge — upholstery, which is far
 * softer than architecture — overrides it locally.
 *
 * Zero means the plain unit cube, which is what the low tier renders.
 */
const ChamferContext = createContext(0);

/**
 * The architectural edge, per quality tier, in metres.
 *
 * 4 mm is a real arris: the cut a mason puts on a stone edge, the fillet a
 * formwork chamfer strip leaves on cast concrete, the break an extrusion
 * carries. It is chosen to be visible as a line of light and never as a
 * radius — at 10 mm the building starts reading as moulded plastic, and at
 * 1 mm it disappears before the hero camera can resolve it.
 *
 * The low tier keeps square edges. The chamfer costs 44 triangles a volume
 * against 12, and on the hardware that resolves to `low` the established
 * pattern in this project is to spend the budget on the things that carry
 * the image at a distance — the lawn, the shadows, the lighting — rather
 * than on detail at arm's length that a phone screen will not resolve.
 */
export const ARCHITECTURAL_CHAMFER: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 0.004,
  high: 0.004,
};

/**
 * Upholstery is not architecture. A sofa arm, a mattress edge, a seat
 * cushion and a rug all break over a couple of centimetres, and giving them
 * the building's 4 mm arris leaves them reading as painted plywood — which
 * is exactly how the interiors read today.
 */
export const UPHOLSTERY_CHAMFER = 0.022;

export const ChamferProvider = ChamferContext.Provider;

/** The edge in force here, unless a call site overrides it. */
function useChamfer(override?: number): number {
  const inherited = useContext(ChamferContext);
  return override ?? inherited;
}

type MassingProps = {
  specs: readonly BoxSpec[];
  material: Material;
  /** Glazing and trim read better without self-shadowing. */
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Edge size in metres, overriding the inherited architectural default. */
  chamfer?: number;
};

/**
 * Renders volumes as the primary architectural masses, which stay
 * individually named so later phases can address them.
 *
 * Unchamfered, these are transforms of one shared unit cube. Chamfered, they
 * are true-size geometries drawn from a cache keyed on their dimensions —
 * the scale has to move out of the transform and into the geometry, because
 * a chamfer applied before a non-uniform scale is no longer the same width
 * on every edge.
 */
export function Massing({
  specs,
  material,
  castShadow = true,
  receiveShadow = true,
  chamfer,
}: MassingProps) {
  const edge = useChamfer(chamfer);
  const unitBox = getVillaGeometries().box;

  if (edge <= 0) {
    return (
      <>
        {specs.map((spec) => (
          <mesh
            key={spec.key}
            name={spec.key}
            geometry={unitBox}
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

  return (
    <>
      {specs.map((spec) => (
        <mesh
          key={spec.key}
          name={spec.key}
          geometry={getChamferedBox(spec.scale[0], spec.scale[1], spec.scale[2], edge)}
          material={material}
          position={spec.position}
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
 *
 * Unlike `Massing` this deliberately does *not* draw from the shared
 * chamfered cache: every part here is consumed by the merge and thrown away,
 * so caching the sources would hold thousands of arrays in memory that are
 * never drawn from again.
 */
export function MergedBoxes({
  specs,
  material,
  name,
  castShadow = true,
  receiveShadow = true,
  chamfer,
}: MergedBoxesProps) {
  const edge = useChamfer(chamfer);

  const geometry = useMemo<BufferGeometry | null>(() => {
    if (specs.length === 0) return null;

    const parts = specs.map((spec) => {
      const part = createChamferedBox(spec.scale[0], spec.scale[1], spec.scale[2], edge);
      part.translate(...spec.position);
      return part;
    });

    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged;
  }, [specs, edge]);

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

type MergedSupportsProps = {
  specs: readonly ColumnSpec[];
  material: Material;
  name: string;
};

/**
 * Bakes many turned elements — pendant stems, lamp columns, taps — into a
 * single geometry, the cylinder counterpart of `MergedBoxes`. A furnished
 * house has dozens of them and none needs to be addressed on its own.
 */
export function MergedSupports({ specs, material, name }: MergedSupportsProps) {
  const geometry = useMemo<BufferGeometry | null>(() => {
    if (specs.length === 0) return null;

    const parts = specs.map((spec) => {
      // Twelve sides rather than eight: these are turned metal, and at eight
      // the flats are wide enough to catch the sun as distinct facets.
      const part = new CylinderGeometry(1, 1, 1, 12);
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

  return <mesh name={name} geometry={geometry} material={material} castShadow receiveShadow />;
}
