'use client';

import { useEffect, useMemo } from 'react';
import type { VillaConfig } from './VillaTypes';
import { VILLA_CONFIG, createVillaLayout, disposeVillaGeometries } from './VillaGeometry';
import { VillaColumns } from './VillaColumns';
import { VillaFoundation } from './VillaFoundation';
import { VillaGlazing } from './VillaGlazing';
import { VillaLowerFloor } from './VillaLowerFloor';
import { VillaRoof } from './VillaRoof';
import { VillaStairs } from './VillaStairs';
import { VillaTerrace } from './VillaTerrace';
import { VillaUpperFloor } from './VillaUpperFloor';

type ProceduralVillaProps = {
  /** Partial override of the default proportions. */
  config?: Partial<VillaConfig>;
};

/**
 * The procedurally generated residence — a contemporary two-storey villa
 * built entirely from code, with no external model or texture of any kind.
 *
 * The whole building is a pure function of `VILLA_CONFIG`: the layout is
 * resolved once per configuration and every part reads from it, so a later
 * configurator can change width, depth, floor heights, cantilever, or
 * terrace depth and the architecture recomposes coherently.
 */
export function ProceduralVilla({ config }: ProceduralVillaProps) {
  const layout = useMemo(
    () => createVillaLayout(config ? { ...VILLA_CONFIG, ...config } : VILLA_CONFIG),
    [config],
  );

  // The shared unit primitives outlive individual parts; release them when
  // the villa leaves the scene entirely.
  useEffect(() => disposeVillaGeometries, []);

  return (
    <group name="ProceduralVilla">
      <VillaFoundation layout={layout} />
      <VillaLowerFloor layout={layout} />
      <VillaUpperFloor layout={layout} />
      <VillaRoof layout={layout} />
      <VillaTerrace layout={layout} />
      <VillaGlazing layout={layout} />
      <VillaColumns layout={layout} />
      <VillaStairs layout={layout} />
    </group>
  );
}

export default ProceduralVilla;
