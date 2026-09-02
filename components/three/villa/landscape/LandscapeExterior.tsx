'use client';

import { useMemo } from 'react';
import type { DetailTier, VillaPlan } from '../VillaTypes';
import { createSiteLayout, SITE_CONFIG } from '../site/SiteGeometry';
import type { SiteConfig } from '../site/SiteTypes';
import { Grasses } from './Grasses';
import { Hedges } from './Hedges';
import { createLandscapeLayout, LANDSCAPE_CONFIG } from './LandscapeGeometry';
import { LandscapePlanters } from './LandscapePlanters';
import { LandscapeRocks } from './LandscapeRocks';
import { Shrubs } from './Shrubs';
import type { LandscapeConfig, LandscapeContext } from './LandscapeTypes';
import { Trees } from './Trees';

type LandscapeExteriorProps = {
  plan: VillaPlan;
  config?: Partial<LandscapeConfig>;
  /** Must match whatever `SiteExterior` was given, so beds line up with the paving. */
  siteConfig?: Partial<SiteConfig>;
  detail?: DetailTier;
};

/**
 * The procedural landscape — feature trees, shrubs, grasses, hedges, rocks,
 * and planter planting — composed entirely from the villa's plan and the
 * site's own resolved bounds. Nothing here is an eyeballed coordinate:
 * `createSiteLayout` is the same pure function `SiteExterior` calls (it is
 * documented to be safe for multiple callers), so this module derives its
 * `LandscapeContext` from the real paving geometry rather than guessing it.
 */
export function LandscapeExterior({
  plan,
  config,
  siteConfig,
  detail = 'high',
}: LandscapeExteriorProps) {
  const site = useMemo(
    () =>
      createSiteLayout(siteConfig ? { ...SITE_CONFIG, ...siteConfig } : SITE_CONFIG, plan, detail),
    [siteConfig, plan, detail],
  );

  const context = useMemo<LandscapeContext>(
    () => ({
      halfWidth: plan.halfWidth,
      halfDepth: plan.halfDepth,
      plinthHalfWidth: plan.plinthHalfWidth,
      groundY: plan.groundY,
      entranceStairsX: plan.entranceStairsX,
      entranceStairsOuterZ: plan.entranceStairsOuterZ,
      deckX: site.bounds.deckX,
      deckZ: site.bounds.deckZ,
      deckY: site.bounds.deckY,
      poolX: site.bounds.poolX,
      poolZ: site.bounds.poolZ,
      loungeX: site.bounds.loungeX,
      loungeZ: site.bounds.loungeZ,
      loungeFloorX: site.bounds.loungeFloorX,
      loungeFloorY: site.bounds.loungeFloorY,
      approachX: site.bounds.approachX,
      approachZ: site.bounds.approachZ,
      planters: site.planters,
    }),
    [plan, site],
  );

  const layout = useMemo(
    () =>
      createLandscapeLayout(
        config ? { ...LANDSCAPE_CONFIG, ...config } : LANDSCAPE_CONFIG,
        context,
        detail,
      ),
    [config, context, detail],
  );

  return (
    <group name="LandscapeExterior">
      <Trees layout={layout} detail={detail} />
      <Shrubs layout={layout} detail={detail} />
      <Grasses layout={layout} />
      <Hedges layout={layout} />
      <LandscapeRocks layout={layout} />
      <LandscapePlanters layout={layout} />
    </group>
  );
}

export default LandscapeExterior;
