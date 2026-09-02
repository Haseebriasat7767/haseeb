import type { Vector3Tuple } from 'three';
import type { AnchorKey } from '@/lib/experience/spaces';
import { mid } from '../villa/SpecBuilders';
import type { VillaLevels, VillaPlan } from '../villa/VillaTypes';
import type { SiteLayout } from '../villa/site/SiteTypes';

/**
 * Resolves every hotspot's world position from the building that actually
 * exists — the villa's plan lines and the site's resolved bounds — so a
 * marker cannot drift away from the thing it labels when the configuration
 * changes.
 */
export function createSpaceAnchors(
  plan: VillaPlan,
  levels: VillaLevels,
  site: SiteLayout,
): Record<AnchorKey, Vector3Tuple> {
  const bounds = site.bounds;

  return {
    approach: [plan.entranceOffsetX, plan.groundY + 1.1, plan.entranceStairsOuterZ + 1.5],
    entrance: [plan.entranceOffsetX, plan.groundY + 2.3, plan.entranceBackZ + 0.5],
    livingGlass: [mid(plan.livingAxisX), plan.groundY + 2.1, plan.livingGlassZ + 0.4],
    terrace: [mid(plan.livingAxisX) - 6, plan.groundY + 1.2, (plan.frontZ + plan.plinthFrontZ) / 2],
    cantilever: [mid(plan.cantileverAxisX), levels.upperFloorY + 1.8, plan.cantileverZ[1] + 0.4],
    roofTerrace: [
      (-plan.halfWidth + plan.entranceX[0]) / 2,
      levels.upperFloorY + 1.5,
      plan.upperWestFrontZ + 1.2,
    ],
    pool: [mid(bounds.poolX), bounds.deckY + 0.7, mid(bounds.poolZ)],
    lounge: [mid(bounds.loungeFloorX), bounds.loungeFloorY + 1.3, mid(bounds.loungeZ)],
  };
}
