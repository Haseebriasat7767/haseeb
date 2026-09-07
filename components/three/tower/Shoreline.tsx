'use client';

import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../villa/VillaPrimitives';
import type { DetailTier } from '../villa/VillaTypes';
import { Palms } from './Palms';
import type { ShorelineLayout } from './TowerTypes';

/**
 * How far out the sea is drawn, in metres.
 *
 * The horizon has to be beyond the fog's far plane or the water ends in a
 * visible straight edge against the sky — the same problem the villa's
 * terrain solves by fading into haze before it runs out of ground. The
 * plane costs four vertices however big it is, so the only real cost of
 * going this far is that the swell has to damp out with distance, which
 * the ocean material already does.
 */
const OCEAN_REACH = 2600;

/**
 * Beach sand, sloping gently into the water.
 *
 * A flat plate reads as concrete no matter what material is on it: a beach
 * is defined by the fact that it falls toward the sea, and by the fact that
 * the fall is not even. Two octaves of the same positional hash the terrain
 * uses give it a low dune line at the back and a scoured, flatter run at
 * the waterline.
 */
function useBeachGeometry(x: [number, number], spanZ: number, segments: number) {
  return useMemo(() => {
    const width = x[1] - x[0];
    const plane = new PlaneGeometry(width, spanZ, segments, Math.round(segments * 1.6));
    const position = plane.getAttribute('position');

    const hash = (a: number, b: number) => {
      const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    const noise = (fx: number, fz: number) => {
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

    for (let i = 0; i < position.count; i += 1) {
      const lx = position.getX(i);
      const lz = position.getY(i);
      // 0 at the boardwalk, 1 at the water.
      const t = (lx + width / 2) / width;

      // The profile: a dune shoulder just behind the beach, then a steady
      // fall to slightly below sea level so the waterline is a soft edge
      // rather than a cut.
      const dune = Math.exp(-((t - 0.12) ** 2) / 0.012) * 0.9;
      const fall = -1.5 * t * t;
      const grain = (noise(lx * 0.06, lz * 0.06) - 0.5) * 0.5 * (1 - t * 0.6);

      position.setZ(i, dune + fall + grain);
    }

    position.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, [x, spanZ, segments]);
}

/**
 * The beach, the boardwalk and the sea in front of the podium.
 *
 * Three horizontal plates and the things standing on them. The sea is two
 * overlapping planes rather than one: a turquoise shallows band over the
 * sandbar, and open water beyond it. That band is not decoration — it is
 * the single most recognisable thing about this coastline, and without it
 * the water reads as any cold northern sea.
 */
export function Shoreline({
  layout,
  detail = 'high',
}: {
  layout: ShorelineLayout;
  detail?: DetailTier;
}) {
  const materials = getMaterials();
  const { beachX, shallowsX, oceanX, spanZ, boardwalk, steps, loungers, parasols, palms } = layout;

  const segments = detail === 'low' ? 24 : detail === 'medium' ? 40 : 64;
  const beach = useBeachGeometry(beachX as [number, number], spanZ, segments);

  useEffect(() => () => beach.dispose(), [beach]);

  const shallowsWidth = shallowsX[1] - shallowsX[0];
  const oceanWidth = OCEAN_REACH;

  return (
    <group name="Shoreline">
      <mesh
        name="beach"
        geometry={beach}
        material={materials.sand}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(beachX[0] + beachX[1]) / 2, 0, 0]}
        receiveShadow
      />

      {/* Open water. Sits a hair below the shallows so the two never fight
          for the same depth value where they overlap. */}
      <mesh
        name="ocean"
        material={materials.ocean}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[oceanX[0] + oceanWidth / 2, -0.06, 0]}
      >
        <planeGeometry args={[oceanWidth, OCEAN_REACH]} />
      </mesh>

      {/* The sandbar band, drawn over the sea and fading it toward the
          beach. Transparent, so the sand under it still reads through. */}
      <mesh
        name="shallows"
        material={materials.shallows}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(shallowsX[0] + shallowsX[1]) / 2, -0.02, 0]}
      >
        <planeGeometry args={[shallowsWidth, spanZ]} />
      </mesh>

      <MergedBoxes name="boardwalk" specs={boardwalk} material={materials.teak} />
      <MergedBoxes name="boardwalk-steps" specs={steps} material={materials.stone} />
      <MergedBoxes name="beach-loungers" specs={loungers} material={materials.teak} />
      <MergedBoxes name="beach-parasols" specs={parasols} material={materials.drapery} />
      <Palms specs={palms} detail={detail} name="beach-palms" />
    </group>
  );
}

export default Shoreline;
