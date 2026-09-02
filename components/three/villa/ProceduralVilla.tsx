'use client';

import { useEffect, useMemo } from 'react';
import { resolveLighting, type ResolvedLighting } from '@/lib/three/lighting';
import type { DetailTier, VillaConfig } from './VillaTypes';
import { VILLA_CONFIG, createVillaLayout } from './VillaGeometry';
import { disposeVillaGeometries } from './VillaPrimitiveCache';
import { VillaColumns } from './VillaColumns';
import { VillaFacade } from './VillaFacade';
import { VillaFoundation } from './VillaFoundation';
import { VillaGlazing } from './VillaGlazing';
import { VillaLowerFloor } from './VillaLowerFloor';
import { VillaRailings } from './VillaRailings';
import { VillaRoof } from './VillaRoof';
import { VillaStairs } from './VillaStairs';
import { VillaTerrace } from './VillaTerrace';
import { VillaUpperFloor } from './VillaUpperFloor';
import { Interior } from './interior/Interior';
import { LandscapeExterior } from './landscape/LandscapeExterior';
import { Lawn } from './landscape/Lawn';
import { ArchitecturalLighting } from './lighting/ArchitecturalLighting';
import {
  ARCHITECTURAL_LIGHTING_CONFIG,
  createArchitecturalLighting,
} from './lighting/LightingGeometry';
import { SiteExterior } from './site/SiteExterior';
import { createSiteLayout, SITE_CONFIG } from './site/SiteGeometry';

type ProceduralVillaProps = {
  /** Partial override of the default proportions. */
  config?: Partial<VillaConfig>;
  /** Thins out repeated facade detail on weaker GPUs. */
  detail?: DetailTier;
  /** The resolved time-of-day rig. Defaults to the presentation hero hour. */
  lighting?: ResolvedLighting;
};

/**
 * The procedurally generated residence — a contemporary two-storey villa
 * built entirely from code, with no external model or texture of any kind.
 *
 * The whole building is a pure function of `VILLA_CONFIG`: the layout is
 * resolved once per configuration and every part reads from it, so a later
 * configurator can change width, depth, floor heights, cantilever, or
 * terrace depth and the architecture — inside and out — recomposes
 * coherently.
 */
export function ProceduralVilla({ config, detail = 'high', lighting }: ProceduralVillaProps) {
  const layout = useMemo(
    () => createVillaLayout(config ? { ...VILLA_CONFIG, ...config } : VILLA_CONFIG, detail),
    [config, detail],
  );

  const rig = useMemo(() => lighting ?? resolveLighting(undefined, detail), [lighting, detail]);

  // The exterior lighting scheme is placed from the site's resolved bounds.
  // `createSiteLayout` is the same pure function `SiteExterior` calls and is
  // documented safe for multiple callers, so the fixtures land on the real
  // paving rather than on a second guess at where it is.
  const fixtures = useMemo(() => {
    const site = createSiteLayout(SITE_CONFIG, layout.plan, detail);
    return createArchitecturalLighting(
      ARCHITECTURAL_LIGHTING_CONFIG,
      layout.plan,
      layout.levels,
      site,
      detail,
    );
  }, [layout.plan, layout.levels, detail]);

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
      <VillaFacade layout={layout} />
      <VillaRailings layout={layout} />
      <VillaColumns layout={layout} />
      <VillaStairs layout={layout} />
      <Interior plan={layout.plan} levels={layout.levels} detail={detail} lighting={rig} />
      <SiteExterior plan={layout.plan} detail={detail} />
      <LandscapeExterior plan={layout.plan} detail={detail} />
      <Lawn
        paving={{
          x: layout.plan.plinthHalfWidth + 2,
          zNear: -layout.plan.halfDepth - 5,
          zFar: layout.plan.plinthFrontZ + 24,
        }}
        detail={detail}
      />
      <ArchitecturalLighting layout={fixtures} lighting={rig} />
    </group>
  );
}

export default ProceduralVilla;
