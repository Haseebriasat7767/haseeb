'use client';

import { useMemo } from 'react';
import type { DetailTier, VillaPlan } from '../VillaTypes';
import { Pool } from './Pool';
import { PoolDeck } from './PoolDeck';
import { SiteApproach } from './SiteApproach';
import { SiteEdges } from './SiteEdges';
import { SitePlanters } from './SitePlanters';
import { createSiteLayout, SITE_CONFIG } from './SiteGeometry';
import type { SiteConfig } from './SiteTypes';

type SiteExteriorProps = {
  plan: VillaPlan;
  config?: Partial<SiteConfig>;
  detail?: DetailTier;
};

/**
 * The exterior site — pool, deck, approach path, planters, and the
 * retaining edges that ground them — composed as a continuation of the
 * villa's own terrace axis. Entirely code-generated, exactly like the
 * villa: `createSiteLayout` is a pure function of `SITE_CONFIG` and the
 * villa's plan, resolved once and memoised.
 */
export function SiteExterior({ plan, config, detail = 'high' }: SiteExteriorProps) {
  const layout = useMemo(
    () => createSiteLayout(config ? { ...SITE_CONFIG, ...config } : SITE_CONFIG, plan, detail),
    [config, plan, detail],
  );

  return (
    <group name="SiteExterior">
      <Pool layout={layout} />
      <PoolDeck layout={layout} />
      <SiteApproach layout={layout} />
      <SitePlanters layout={layout} />
      <SiteEdges layout={layout} />
    </group>
  );
}

export default SiteExterior;
