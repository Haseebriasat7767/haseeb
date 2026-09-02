'use client';

import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { HOTSPOT_SPACES, type Space } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';
import { createVillaLayout, VILLA_CONFIG } from '../villa/VillaGeometry';
import { createSiteLayout, SITE_CONFIG } from '../villa/site/SiteGeometry';
import type { DetailTier } from '../villa/VillaTypes';
import { createSpaceAnchors } from './anchors';

type SpaceHotspotsProps = {
  detail?: DetailTier;
  /** The space currently open, if any. */
  activeId?: string | null;
  onSelect: (space: Space) => void;
};

/**
 * Architectural markers pinned to the model. Deliberately quiet: a hairline
 * ring and a rule that draws out to the label on hover, in the same gold
 * the rest of the site uses for emphasis. No icons, no badges, no game UI.
 *
 * Each marker is anchored to real geometry — see `anchors.ts` — so it stays
 * on the thing it labels rather than on a coordinate that happened to look
 * right once.
 */
export function SpaceHotspots({ detail = 'high', activeId, onSelect }: SpaceHotspotsProps) {
  const anchors = useMemo(() => {
    const layout = createVillaLayout(VILLA_CONFIG, detail);
    const site = createSiteLayout(SITE_CONFIG, layout.plan, detail);
    return createSpaceAnchors(layout.plan, layout.levels, site);
  }, [detail]);

  return (
    <>
      {HOTSPOT_SPACES.map((space) => {
        if (!space.anchor) return null;
        const active = activeId === space.id;

        return (
          <Html
            key={space.id}
            position={anchors[space.anchor]}
            center
            zIndexRange={[15, 10]}
            style={{ pointerEvents: 'none' }}
          >
            <button
              type="button"
              onClick={() => onSelect(space)}
              aria-label={`${space.name} — open details`}
              className={cn(
                'group ease-luxe pointer-events-auto flex items-center gap-0 transition-opacity duration-500',
                active ? 'opacity-100' : 'opacity-80 hover:opacity-100',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'ease-luxe relative flex h-6 w-6 shrink-0 items-center justify-center',
                  'rounded-pill border transition-all duration-500',
                  active
                    ? 'border-gold bg-gold/25'
                    : 'border-alabaster/60 bg-obsidian/40 group-hover:border-gold backdrop-blur-[2px]',
                )}
              >
                <span
                  className={cn(
                    'rounded-pill ease-luxe block transition-all duration-500',
                    active ? 'bg-gold h-2 w-2' : 'bg-alabaster group-hover:bg-gold h-1 w-1',
                  )}
                />
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  'bg-gold/70 ease-luxe h-px transition-all duration-500',
                  active ? 'w-4' : 'w-0 group-hover:w-4',
                )}
              />

              <span
                className={cn(
                  'ease-luxe overflow-hidden whitespace-nowrap transition-all duration-500',
                  'text-eyebrow text-alabaster font-sans uppercase',
                  active
                    ? 'max-w-[16rem] pl-2 opacity-100'
                    : 'max-w-0 opacity-0 group-hover:max-w-[16rem] group-hover:pl-2 group-hover:opacity-100',
                )}
              >
                {space.name}
              </span>
            </button>
          </Html>
        );
      })}
    </>
  );
}

export default SpaceHotspots;
