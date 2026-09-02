'use client';

import { useEffect, useMemo } from 'react';
import { ConeGeometry, Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { getMaterials } from '@/lib/three/materials';
import type { DetailTier } from '../VillaTypes';
import { mulberry32 } from './LandscapeGeometry';

/** Blades per tier. One instanced mesh, so this is one draw call at any count. */
const DENSITY: Record<DetailTier, number> = {
  low: 6_000,
  medium: 18_000,
  high: 42_000,
};

/**
 * How far out from the property the sown band reaches, in metres.
 *
 * Deliberately tight. The first attempt sowed to 62 m, which spread the
 * same budget so thin that individual blades read as scattered needles on
 * bare ground — worse than no grass at all. Concentrating the count into
 * the band the camera actually flies through is what turns the same
 * instances into turf; past it the ground's own colour variation carries.
 */
const LAWN_RADIUS = 30;

const LAWN_SEED = 0x4c41574e; // 'LAWN'

/** A rectangle of ground, in plan, that grass must not grow through. */
export type LawnExclusion = { x: readonly [number, number]; z: readonly [number, number] };

type LawnProps = {
  /**
   * Ground already covered by hard landscaping. Taken as a list rather
   * than as one rectangle because the estate's drive and turning court sit
   * well outside the building's own paving, and grass sown through a
   * driveway would undo everything the driveway is there to say.
   */
  paving: readonly LawnExclusion[];
  detail?: DetailTier;
};

/**
 * The lawn the residence stands in.
 *
 * Grass is the difference between a building on a green plane and a
 * building on a property, but a blade per mesh would be tens of thousands
 * of draw calls. Every blade here is an instance of one geometry with one
 * material, so the whole lawn costs a single draw call however many blades
 * are sown — which is what makes it affordable to scale the count by tier
 * rather than cutting the feature on weaker hardware.
 *
 * Placement is deterministic: the same seed always sows the same lawn, so
 * nothing shifts between renders or between visitors.
 */
export function Lawn({ paving, detail = 'high' }: LawnProps) {
  const materials = getMaterials();

  const geometry = useMemo(() => {
    // Three faces is all a blade needs at the distance one is ever seen
    // from; the density is what reads, not the silhouette of any one.
    const blade = new ConeGeometry(0.5, 1, 3, 1, false);
    blade.translate(0, 0.5, 0);
    return blade;
  }, []);

  const mesh = useMemo(() => {
    const count = DENSITY[detail];
    const instanced = new InstancedMesh(geometry, materials.lawnBlade, count);
    instanced.name = 'Lawn';
    instanced.castShadow = false;
    instanced.receiveShadow = true;

    const random = mulberry32(LAWN_SEED);
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const axis = new Vector3(0, 1, 0);
    const tint = new Color();
    let placed = 0;

    // Sow until the target count lands, rejecting anything that falls on
    // paving — grass growing through the terrace would undo the realism it
    // is here to add.
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt += 1) {
      // Square root biases the distribution toward the building, where the
      // camera actually is, instead of wasting blades at the horizon.
      const radius = Math.sqrt(random()) * LAWN_RADIUS;
      const angle = random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      let onPaving = false;
      for (const rect of paving) {
        if (x > rect.x[0] && x < rect.x[1] && z > rect.z[0] && z < rect.z[1]) {
          onPaving = true;
          break;
        }
      }
      if (onPaving) continue;

      // Blades thin out toward the edge of the band so it fades into the
      // ground rather than ending on a visible ring.
      if (radius > 22 && random() > 0.55) continue;

      // Short and broad, not long and thin: a mown lawn is a nap a few
      // centimetres deep, and tall blades at this scale read as weeds.
      const height = 0.1 + random() * 0.13;
      const lean = (random() - 0.5) * 0.7;

      position.set(x, 0, z);
      quaternion.setFromAxisAngle(axis, random() * Math.PI * 2);
      quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), lean));
      const width = 0.06 + random() * 0.035;
      scale.set(width, height, width);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(placed, matrix);

      // Per-blade tint: a lawn is never one colour, and the variation is
      // what stops a dense field reading as a solid green mass.
      // Kept narrow and green: the earlier wide, warm range pushed the
      // brightest blades to yellow, which is what made them read as
      // separate specks rather than as a continuous surface.
      const shade = 0.82 + random() * 0.28;
      tint.setRGB(shade * 0.92, shade, shade * 0.78);
      instanced.setColorAt(placed, tint);

      placed += 1;
    }

    instanced.count = placed;
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    instanced.computeBoundingSphere();
    return instanced;
  }, [geometry, materials.lawnBlade, detail, paving]);

  useEffect(
    () => () => {
      mesh.dispose();
    },
    [mesh],
  );
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return <primitive object={mesh} />;
}

export default Lawn;
