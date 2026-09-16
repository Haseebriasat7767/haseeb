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
 * ## One source of "which room am I in"
 *
 * There are two candidates and only one of them is true. `requestedId` is
 * where the visitor asked to go; `currentId` is the room whose panorama is
 * actually on screen, reported by `PanoTransition` when it promotes a
 * loaded texture. Between the two there is a real interval — the load, then
 * the 600ms crossfade — and everything the visitor can see or hear must
 * read the second one.
 *
 * Phase 2 had both and treated the request as the truth. It cost two bugs:
 * a caption that changed while the picture didn't, and a canvas label that
 * named a room the screen reader's user was not yet in. So the request is
 * held only long enough to hand it to the transition, and never read for
 * anything else.
 *
 * The camera belongs to `InteriorPanoViewer`, the textures belong to the
 * loader's cache, and the route between rooms belongs to the generated plan.
 */
export type InteriorPanoExperienceProps = {
  /** Where the tour opens. Must be a space id from `spaces.ts`. */
  initialSpaceId: string;
  className?: string;
};

export function InteriorPanoExperience({ initialSpaceId, className }: InteriorPanoExperienceProps) {
  const [requestedId, setRequestedId] = useState(initialSpaceId);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const yaw = useRef(0);

  const navigate = useCallback((targetId: string) => {
    setMoving(true);
    setRequestedId(targetId);
  }, []);

  const handleArrived = useCallback(() => setMoving(false), []);
  const handleYaw = useCallback((value: number) => {
    yaw.current = value;
  }, []);

  // Until a panorama has been promoted there is no room to be in, so the
  // first arrival shows the skeleton for the room being loaded.
  const space = currentId === null ? undefined : findSpace(currentId);
  const requested = findSpace(requestedId);

  // No render for this room means no room. Saying so is the honest state;
  // a stand-in panorama would be a picture of a place that does not exist.
  if (!requested || !hasPanorama(requestedId)) {
    return (
      <div className={cn('bg-obsidian relative', className)}>
        <ViewportSkeleton spaceId={requested ? requestedId : undefined} />
      </div>
    );
  }

  return (
    <div className={cn('bg-obsidian relative isolate overflow-hidden', className)}>
      <ViewportErrorBoundary>
        <InteriorPanoViewer
          className="absolute inset-0"
          label={
            space
              ? `Panoramic view of the ${space.name.toLowerCase()}`
              : 'Panoramic interior view, loading'
          }
          onYaw={handleYaw}
          overlay={
            <div className="pointer-events-none absolute inset-0">
              <div className="px-gutter absolute inset-x-0 bottom-6 flex items-end justify-between gap-4">
                {/* Named from the room on screen, not the one requested —
                    during a crossfade those differ, and the caption must
                    not describe a picture that is not there yet. */}
                {space ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-eyebrow text-stone uppercase">{space.eyebrow}</span>
                    <span
                      data-pano-room={space.id}
                      className="font-display text-alabaster text-2xl"
                    >
                      {space.name}
                    </span>
                  </div>
                ) : (
                  <span />
                )}
                <PanoCompass yawRef={yaw} className="pointer-events-auto shrink-0" />
              </div>
            </div>
          }
        >
          <PanoTransition
            spaceId={requestedId}
            onCurrentSpaceChange={setCurrentId}
            onTransitionEnd={handleArrived}
          />
          {/* Doors belong to the room you are standing in. Reading the
              request here would offer the next room's exits before its
              picture had arrived. */}
          {space ? (
            <PanoHotspots spaceId={space.id} onNavigate={navigate} disabled={moving} />
          ) : null}
        </InteriorPanoViewer>
      </ViewportErrorBoundary>
    </div>
  );
}
