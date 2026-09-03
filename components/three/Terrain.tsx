'use client';

import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { getMaterials } from '@/lib/three/materials';

/**
 * How far the ground runs, in metres.
 *
 * Far wider than the two hundred and forty it used to be, and the reason is
 * the horizon rather than the site. A finite plane ends in a straight line
 * against the sky, and the only way to hide that line is for the ground to
 * have faded entirely into the air before it reaches its own edge. Fading
 * begins where a real landscape starts hazing — well past the property, so
 * the estate itself stays crisp — and that pushes the edge a long way out.
 *
 * It costs nothing: the plane keeps the same vertex budget, and the extra
 * ground is empty land at a distance where nothing on it would resolve.
 */
const GROUND_SIZE = 660;

/** Where the ground stops being a level building platform, in metres. */
const LEVEL_RADIUS = 46;
/** How far past that the ground takes its full relief. */
const BLEND_RADIUS = 80;
/** Peak relief amplitude, in metres. */
const RELIEF = 3.4;

/**
 * A stateless position hash, matching the technique the vegetation uses.
 * Keying displacement to each vertex's own coordinates rather than to a
 * sequential stream is what keeps shared edges continuous.
 */
function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise over the ground plane. */
function relief(x: number, z: number): number {
  const sample = (fx: number, fz: number) => {
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  };

  // Two octaves: a broad roll of the land, and a finer undulation on it.
  return sample(x * 0.012, z * 0.012) * 0.75 + sample(x * 0.045, z * 0.045) * 0.25;
}

/**
 * The landform beyond the property, at a scale the estate does not have.
 *
 * The relief above rolls over tens of metres, which is right for the ground
 * a visitor walks across and invisible at the distances the hero framing
 * actually looks out over. Land at four hundred metres reads through its
 * ridgelines, and without any the far ground stays a perfectly level shelf
 * — flat enough that the haze fading it out is doing all the work alone.
 *
 * One very long wavelength, and an amplitude that only comes up once the
 * site is well behind the camera, so nothing here disturbs the platform the
 * building stands on.
 */
function landform(x: number, z: number): number {
  const sample = (fx: number, fz: number) => {
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = hash(ix + 37, iz - 19);
    const b = hash(ix + 38, iz - 19);
    const c = hash(ix + 37, iz - 18);
    const d = hash(ix + 38, iz - 18);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  };
  return sample(x * 0.0022, z * 0.0022) - 0.5;
}

/** Where the distant landform starts to rise, and where it reaches full height. */
const LANDFORM_NEAR = 110;
const LANDFORM_FAR = 420;
/** Peak height of that landform, in metres. */
const LANDFORM_RELIEF = 26;

/**
 * The ground the residence sits on.
 *
 * This was a flat plane in a single near-black colour, which is the main
 * reason the building read as floating in a void rather than standing on a
 * property. It is now mown ground that rolls away from the site: level
 * across the building platform, where a slope would fight the plinth and
 * the paving, then taking its full relief beyond it so the horizon is a
 * landscape rather than a straight edge.
 *
 * Displacement is baked into the geometry once at mount — it never
 * animates, so there is nothing to pay for per frame.
 */
export function Terrain() {
  const materials = getMaterials();

  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 128, 128);
    const position = plane.getAttribute('position');

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      // The plane is authored face-up and rotated into place below, so its
      // local Y is the world Z.
      const z = position.getY(i);
      const distance = Math.hypot(x, z);

      // Hold the building platform dead level, then ease into the relief.
      const t = Math.min(1, Math.max(0, (distance - LEVEL_RADIUS) / (BLEND_RADIUS - LEVEL_RADIUS)));
      const mask = t * t * (3 - 2 * t);

      const far = Math.min(
        1,
        Math.max(0, (distance - LANDFORM_NEAR) / (LANDFORM_FAR - LANDFORM_NEAR)),
      );
      const farMask = far * far * (3 - 2 * far);

      position.setZ(
        i,
        (relief(x, z) - 0.5) * 2 * RELIEF * mask + landform(x, z) * LANDFORM_RELIEF * farMask,
      );
    }

    position.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return (
    <mesh
      name="Terrain"
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      receiveShadow
      material={materials.terrain}
    />
  );
}
