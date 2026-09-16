'use client';

import { useCallback, useRef, useState } from 'react';
import { InteriorPanoViewer } from './InteriorPanoViewer';
import { PanoCompass, PanoHotspots } from './PanoHotspots';
import { PanoTransition } from './PanoTransition';
import { ViewportErrorBoundary } from './ViewportErrorBoundary';
import { ViewportSkeleton } from './ViewportSkeleton';
import { hasPanorama } from '@/lib/pano/manifest';
import { findSpace } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';

/**
 * The three pieces of the interior tour, assembled: a panorama to stand in,
 * a crossfade to the next one, and the doors between them.
 *
 * It holds one piece of state — which room the visitor is in — because that
 * is the only thing the pieces need to agree on. The camera belongs to
 * `InteriorPanoViewer`, the textures belong to the loader's cache, and the
 * route between rooms belongs to the generated plan.
 */
export type InteriorPanoExperienceProps = {
  /** Where the tour opens. Must be a space id from `spaces.ts`. */
  initialSpaceId: string;
  className?: string;
};

export function InteriorPanoExperience({ initialSpaceId, className }: InteriorPanoExperienceProps) {
  const [spaceId, setSpaceId] = useState(initialSpaceId);
  const [moving, setMoving] = useState(false);
  const yaw = useRef(0);

  const navigate = useCallback((targetId: string) => {
    setMoving(true);
    setSpaceId(targetId);
  }, []);

  const handleArrived = useCallback(() => setMoving(false), []);
  const handleYaw = useCallback((value: number) => {
    yaw.current = value;
  }, []);

  const space = findSpace(spaceId);

  // No render for this room means no room. Saying so is the honest state;
  // a stand-in panorama would be a picture of a place that does not exist.
  if (!space || !hasPanorama(spaceId)) {
    return (
      <div className={cn('bg-obsidian relative', className)}>
        <ViewportSkeleton spaceId={space ? spaceId : undefined} />
      </div>
    );
  }

  return (
    <div className={cn('bg-obsidian relative isolate overflow-hidden', className)}>
      <ViewportErrorBoundary>
        <InteriorPanoViewer
          className="absolute inset-0"
          label={`Panoramic view of the ${space.name.toLowerCase()}`}
          onYaw={handleYaw}
          overlay={
            <div className="pointer-events-none absolute inset-0">
              <div className="px-gutter absolute inset-x-0 bottom-6 flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-eyebrow text-stone uppercase">{space.eyebrow}</span>
                  <span data-pano-room={space.id} className="font-display text-alabaster text-2xl">
                    {space.name}
                  </span>
                </div>
                <PanoCompass yawRef={yaw} className="pointer-events-auto shrink-0" />
              </div>
            </div>
          }
        >
          <PanoTransition spaceId={spaceId} onTransitionEnd={handleArrived} />
          <PanoHotspots spaceId={spaceId} onNavigate={navigate} disabled={moving} />
        </InteriorPanoViewer>
      </ViewportErrorBoundary>
    </div>
  );
}
