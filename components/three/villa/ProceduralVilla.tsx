'use client';

import { useEffect, useMemo } from 'react';
import { resolveLighting, type ResolvedLighting } from '@/lib/three/lighting';
import type { DetailTier, VillaConfig } from './VillaTypes';
import { VILLA_CONFIG, createVillaLayout } from './VillaGeometry';
import { disposeSurfaceMaps } from '../textures/SurfaceMaps';
import { disposeFoliageAtlas } from './landscape/FoliageAtlas';
import { disposeVillaGeometries } from './VillaPrimitiveCache';
import { ARCHITECTURAL_CHAMFER, ChamferProvider } from './VillaPrimitives';
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
import { EstateExterior } from './site/EstateExterior';
import { ARRIVAL_CONFIG, createEstateLayout, OUTDOOR_CONFIG } from './site/EstateGeometry';
import { SiteExterior } from './site/SiteExterior';
import { createSiteLayout, SITE_CONFIG } from './site/SiteGeometry';
import { WalkControls } from '../WalkControls';
import { walkLook, walkMove } from '@/lib/three/walk-input';
import { createVillaWalkCollider } from './WalkCollider';

type ProceduralVillaProps = {
  /** Partial override of the default proportions. */
  config?: Partial<VillaConfig>;
  /** Thins out repeated facade detail on weaker GPUs. */
  detail?: DetailTier;
  /** The resolved time-of-day rig. Defaults to the presentation hero hour. */
  lighting?: ResolvedLighting;
  /** Hands the camera to the visitor and builds the collider they walk on. */
  walk?: boolean;
};

/**
 * Where the walk starts: a couple of metres out from the foot of the
 * approach stairs, at grade, facing the entrance. Every number is a real
 * plan line rather than a guess — `entranceStairsOuterZ` is the villa's own
 * "where the stairs meet the ground" — so the start point stays correct
 * through any configuration that reshapes the approach.
 */
const WALK_START_CLEARANCE = 2;

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
export function ProceduralVilla({
  config,
  detail = 'high',
  lighting,
  walk = false,
}: ProceduralVillaProps) {
  const layout = useMemo(
    () => createVillaLayout(config ? { ...VILLA_CONFIG, ...config } : VILLA_CONFIG, detail),
    [config, detail],
  );

  // The surfaces a visitor can stand on and bump into. Built only while
  // actually walking, same reasoning as the tower's own collider: it is a
  // second merged geometry over the whole building and there is no reason
  // to pay for it while the camera is composed.
  const collider = useMemo(() => (walk ? createVillaWalkCollider(layout) : null), [walk, layout]);
  useEffect(() => () => collider?.geometry.dispose(), [collider]);

  const rig = useMemo(() => lighting ?? resolveLighting(undefined, detail), [lighting, detail]);

  // The exterior lighting scheme is placed from the site's resolved bounds.
  // `createSiteLayout` is the same pure function `SiteExterior` calls and is
  // documented safe for multiple callers, so the fixtures land on the real
  // paving rather than on a second guess at where it is.
  const site = useMemo(
    () => createSiteLayout(SITE_CONFIG, layout.plan, detail),
    [layout.plan, detail],
  );

  const fixtures = useMemo(
    () =>
      createArchitecturalLighting(
        ARCHITECTURAL_LIGHTING_CONFIG,
        layout.plan,
        layout.levels,
        site,
        detail,
      ),
    [layout.plan, layout.levels, site, detail],
  );

  // The arrival sequence and the outdoor furniture, resolved from the same
  // plan and site bounds everything else is placed from.
  const estate = useMemo(
    () => createEstateLayout(ARRIVAL_CONFIG, OUTDOOR_CONFIG, layout.plan, site, detail),
    [layout.plan, site, detail],
  );

  // Grass is kept off the building's own paving and off everything the
  // estate paves, which the estate reports rather than the call site
  // restating — an exclusion that drifts from the paving is a driveway
  // with grass growing through it.
  const lawnPaving = useMemo(
    () => [
      {
        x: [-(layout.plan.plinthHalfWidth + 2), layout.plan.plinthHalfWidth + 2] as const,
        z: [-layout.plan.halfDepth - 5, layout.plan.plinthFrontZ + 24] as const,
      },
      ...estate.pavedGround.map((rect) => ({ x: rect.x, z: rect.z })),
    ],
    [layout.plan, estate],
  );

  // The shared unit primitives outlive individual parts; release them when
  // the villa leaves the scene entirely.
  useEffect(
    () => () => {
      disposeVillaGeometries();
      disposeFoliageAtlas();
      disposeSurfaceMaps();
    },
    [],
  );

  return (
    <ChamferProvider value={ARCHITECTURAL_CHAMFER[detail]}>
      <group name="ProceduralVilla">
        {collider ? (
          <WalkControls
            collider={collider}
            start={[
              layout.plan.entranceOffsetX,
              layout.levels.groundY,
              layout.plan.entranceStairsOuterZ + WALK_START_CLEARANCE,
            ]}
            // Facing −Z, which is toward the entrance from the approach —
            // the same direction the composed `arrival` camera looks from
            // further back.
            heading={0}
            moveRef={walkMove}
            lookRef={walkLook}
          />
        ) : null}
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
        <EstateExterior layout={estate} />
        <Lawn paving={lawnPaving} detail={detail} />
        <ArchitecturalLighting layout={fixtures} lighting={rig} />
      </group>
    </ChamferProvider>
  );
}

export default ProceduralVilla;
