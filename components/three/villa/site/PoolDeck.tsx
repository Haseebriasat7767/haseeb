'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { SiteLayout } from './SiteTypes';

/**
 * The paved surrounds: a frame of large deck slabs around the pool, the
 * steps continuing the villa's own terrace down onto it, and the sunken
 * lounge's floor and stepped edge. All paving shares one mesh and material —
 * a small number of large architectural slabs, not a tiled pattern.
 */
export function PoolDeck({ layout }: { layout: SiteLayout }) {
  const materials = getMaterials();

  const paving = [
    ...layout.paving.deckSlabs,
    ...layout.paving.terraceSteps,
    ...layout.paving.loungeFloor,
    ...layout.paving.loungeSteps,
  ];

  return (
    <group name="PoolDeck">
      <MergedBoxes name="site-paving" specs={paving} material={materials.concrete} />
    </group>
  );
}
