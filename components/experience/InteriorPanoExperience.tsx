'use client';

import { useRef } from 'react';
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
 * This component holds none of it. Both `requested` — where the visitor
 * asked to go — and `current` — the room whose panorama is actually on
 * screen — are props, owned by whatever mounts the tour.
 *
 * They are genuinely different facts, separated by a real interval: the
 * load, then the 600ms crossfade. Phase 2 kept both and read the request as
 * the truth, which cost a caption that changed while the picture didn't and
 * a canvas label naming a room the screen-reader user was not yet in. Phase
 * 3 split them but kept them here, which was fine while nothing else was on
 * the page. Mounting the tour beside the exterior explorer puts two systems
 * in one tree, so ownership moves up: there is one place to look, and no
 * second copy can drift from it.
 *
 * The camera belongs to `InteriorPanoViewer`, the textures belong to the
 * loader's cache, and the route between rooms belongs to the generated plan.
 */
export type InteriorPanoExperienceProps = {
  /** The room the visitor has asked for. A request, not a fact. */
  requestedSpaceId: string;
  /** The room whose panorama is on screen. Null until the first promotion. */
  currentSpaceId: string | null;
  /** A door was taken. The owner decides what the new request is. */
  onRequest: (spaceId: string) => void;
  /** A panorama was promoted — this is the moment `current` becomes true. */
  onCurrentSpaceChange: (spaceId: string) => void;
  /** The crossfade finished. Doors are live again. */
  onSettled?: () => void;
  /** Doors are suppressed while a transition runs. */
  moving?: boolean;
  className?: string;
};

export function InteriorPanoExperience({
  requestedSpaceId,
  currentSpaceId,
  onRequest,
  onCurrentSpaceChange,
  onSettled,
  moving = false,
  className,
}: InteriorPanoExperienceProps) {
  const yaw = useRef(0);
  const handleYaw = (value: number) => {
    yaw.current = value;
  };

  // Until a panorama has been promoted there is no room to be in, so the
  // first arrival shows the skeleton for the room being loaded.
  const space = currentSpaceId === null ? undefined : findSpace(currentSpaceId);
  const requested = findSpace(requestedSpaceId);

  // No render for this room means no room. Saying so is the honest state;
  // a stand-in panorama would be a picture of a place that does not exist.
  if (!requested || !hasPanorama(requestedSpaceId)) {
    return (
      <div className={cn('bg-obsidian relative', className)}>
        <ViewportSkeleton spaceId={requested ? requestedSpaceId : undefined} />
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
            spaceId={requestedSpaceId}
            onCurrentSpaceChange={onCurrentSpaceChange}
            {...(onSettled ? { onTransitionEnd: onSettled } : {})}
          />
          {/* Doors belong to the room you are standing in. Reading the
              request here would offer the next room's exits before its
              picture had arrived. */}
          {space ? (
            <PanoHotspots spaceId={space.id} onNavigate={onRequest} disabled={moving} />
          ) : null}
        </InteriorPanoViewer>
      </ViewportErrorBoundary>
    </div>
  );
}
