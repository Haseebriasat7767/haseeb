'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterials } from '@/lib/three/materials';
import type { DetailTier } from '../villa/VillaTypes';
import type { PalmSpec } from './TowerTypes';

/** Trunk facets per tier. A palm at forty metres does not need twelve. */
const TRUNK_SIDES: Record<DetailTier, number> = { low: 5, medium: 7, high: 9 };

/** Deterministic hash, matching the one the layout uses. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Builds one palm's trunk and one palm's fronds as separate geometry lists,
 * so the whole planting scheme merges into exactly two meshes.
 *
 * The trunk is a tapered cylinder given a slight lean; the fronds are thin
 * tapered blades radiating from its head, each one tilted down by a
 * different amount. Palms are the one tree whose silhouette is almost
 * entirely in the crown, so the frond angles are where the effort goes —
 * an even radial fan reads as a parasol, and what makes it read as a palm
 * is that some fronds stand up, some sit level, and the older ones hang
 * well below horizontal.
 */
function buildPalm(spec: PalmSpec, sides: number, frondsPerTree: number): {
  trunk: BufferGeometry;
  fronds: BufferGeometry[];
} {
  const { position, trunkHeight, trunkRadius, lean, leanAngle, frondLength, seed } = spec;
  const [ox, oy, oz] = position;

  // The lean, as a rotation applied about the base rather than the centre.
  const tilt = new Quaternion().setFromEuler(
    new Euler(Math.sin(leanAngle) * lean, 0, Math.cos(leanAngle) * lean),
  );

  const trunk = new CylinderGeometry(trunkRadius * 0.62, trunkRadius, trunkHeight, sides, 1);
  trunk.translate(0, trunkHeight / 2, 0);
  trunk.applyMatrix4(new Matrix4().makeRotationFromQuaternion(tilt));
  trunk.translate(ox, oy, oz);

  // Where the crown actually sits once the trunk has leaned over.
  const head = new Vector3(0, trunkHeight, 0)
    .applyQuaternion(tilt)
    .add(new Vector3(ox, oy, oz));

  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < frondsPerTree; i += 1) {
    const r = rand(seed + i * 53);
    const r2 = rand(seed + i * 97);
    // Radial spread with jitter, so no two trees fan the same way.
    const yaw = (i / frondsPerTree) * Math.PI * 2 + (r - 0.5) * 0.5;
    // From a little above horizontal down to a heavy droop.
    const pitch = -0.42 + r2 * 1.25;
    const length = frondLength * (0.66 + r * 0.44);

    // Wider than a real frond's proportions, and deliberately. A palm leaf
    // is a comb of hundreds of leaflets with air between them; drawn as a
    // single blade at true width it reads as a dark stick, which is exactly
    // how the first render came out. The extra width stands in for the
    // leaflets that are not being drawn.
    const blade = new BoxGeometry(length, 0.05, 0.72 + r2 * 0.42);
    // Authored from the origin outward, so the rotation swings it about the
    // crown rather than about its own middle.
    blade.translate(length / 2, 0, 0);
    blade.applyMatrix4(
      new Matrix4().makeRotationFromEuler(new Euler(0, yaw, -pitch, 'YZX')),
    );
    blade.translate(head.x, head.y, head.z);
    fronds.push(blade);
  }

  return { trunk, fronds };
}

/**
 * A stand of palms, drawn as two merged meshes regardless of how many trees
 * there are. Trunks take the villa's bark material; the fronds take a
 * lighter, more yellow-green leaf than the villa's broadleaf canopy.
 */
export function Palms({
  specs,
  detail = 'high',
  name = 'palms',
  castShadow = true,
}: {
  specs: readonly PalmSpec[];
  detail?: DetailTier;
  name?: string;
  castShadow?: boolean;
}) {
  const materials = getMaterials();
  const sides = TRUNK_SIDES[detail];
  // A palm's crown is its whole silhouette, so the frond count is the last
  // thing to cut — but on the low tier it is still the largest saving here.
  const frondScale = detail === 'low' ? 0.6 : detail === 'medium' ? 0.8 : 1;

  const geometry = useMemo(() => {
    if (specs.length === 0) return null;

    const trunks: BufferGeometry[] = [];
    const blades: BufferGeometry[] = [];

    for (const spec of specs) {
      const count = Math.max(5, Math.round(spec.frondCount * frondScale));
      const built = buildPalm(spec, sides, count);
      trunks.push(built.trunk);
      blades.push(...built.fronds);
    }

    const trunk = mergeGeometries(trunks, false);
    const frond = mergeGeometries(blades, false);
    trunks.forEach((g) => g.dispose());
    blades.forEach((g) => g.dispose());

    return { trunk, frond };
  }, [specs, sides, frondScale]);

  useEffect(
    () => () => {
      geometry?.trunk?.dispose();
      geometry?.frond?.dispose();
    },
    [geometry],
  );

  if (!geometry?.trunk || !geometry.frond) return null;

  return (
    <group name={name}>
      <mesh
        name={`${name}-trunks`}
        geometry={geometry.trunk}
        material={materials.bark}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        name={`${name}-fronds`}
        geometry={geometry.frond}
        material={materials.frond}
        castShadow={castShadow}
        receiveShadow
      />
    </group>
  );
}

export default Palms;
