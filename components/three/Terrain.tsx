'use client';

import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { getMaterials } from '@/lib/three/materials';
import { SITE_GEOMETRY } from '@/lib/three/scene-config';

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
    const size = SITE_GEOMETRY.groundSize;
    const plane = new PlaneGeometry(size, size, 96, 96);
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

      position.setZ(i, (relief(x, z) - 0.5) * 2 * RELIEF * mask);
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
