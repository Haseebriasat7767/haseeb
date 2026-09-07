'use client';

import { getMaterials } from '@/lib/three/materials';
import { MergedBoxes } from '../VillaPrimitives';
import type { LandscapeLayout } from './LandscapeTypes';

/**
 * Clipped hedging and the deck's structural glass.
 *
 * Both are plain boxes reusing the villa's own primitive, so both cost one
 * merged mesh. They are grouped together because they are the two things
 * that give the grounds an *edge* — the hedge draws the garden's, the glass
 * draws the terrace's — and neither is planting or paving.
 */
export function Hedges({ layout }: { layout: LandscapeLayout }) {
  const materials = getMaterials();

  return (
    <group name="Hedges">
      <MergedBoxes name="hedges" specs={layout.hedges} material={materials.foliageMid} />
      {/* Frameless panels along the seaward edge of the pool deck. The
          villa's own glazing material, so the balustrade picks up the same
          sky and the same Fresnel as the building behind it. */}
      <MergedBoxes
        name="deck-glass"
        specs={layout.glass}
        material={materials.glazing}
        castShadow={false}
      />
    </group>
  );
}
