'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { ViewportSkeleton } from '@/components/experience/ViewportSkeleton';
import { panoramaCoverage } from '@/lib/pano/manifest';
import { findSpace } from '@/lib/experience/spaces';

/**
 * The mount point for the interior tour, and the only place its
 * "which room am I in" lives.
 *
 * ## Why the tour is loaded dynamically
 *
 * It pulls in three, fiber and drei. Imported statically it lands in the
 * residence page's own chunk, which took `/residence` from 149 kB to 392 kB
 * — paid by every visitor on first load, for a tab most of them never open.
 * `next/dynamic` with `ssr: false` is the same treatment `ExperienceViewport`
 * gives the exterior canvas, and for the same reason.
 *
 * Two facts, one owner. `requested` is the door the visitor took;
 * `current` is the room whose panorama is actually on screen, which
 * `InteriorPanoExperience` reports when the transition promotes a loaded
 * texture. Everything downstream — caption, canvas label, which doors are
 * offered — reads `current`. The tour itself holds neither.
 */
const InteriorPanoExperience = dynamic(
  () =>
    import('@/components/experience/InteriorPanoExperience').then(
      (mod) => mod.InteriorPanoExperience,
    ),
  { ssr: false, loading: () => <ViewportSkeleton /> },
);

export function InteriorTourPanel({ className }: { className?: string }) {
  const coverage = panoramaCoverage();
  const opening = coverage[0] ?? null;

  const [requested, setRequested] = useState<string | null>(opening);
  const [current, setCurrent] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const request = useCallback((spaceId: string) => {
    setMoving(true);
    setRequested(spaceId);
  }, []);

  if (!opening || !requested || !findSpace(requested)) return null;

  return (
    <InteriorPanoExperience
      className={className}
      requestedSpaceId={requested}
      currentSpaceId={current}
      onRequest={request}
      onCurrentSpaceChange={setCurrent}
      onSettled={() => setMoving(false)}
      moving={moving}
    />
  );
}

/**
 * Whether there is an interior to show at all.
 *
 * With no rendered rooms the tour is not offered — no tab, no frame, no
 * empty state promising something that does not exist. This is the same
 * null-means-hide rule `CLIENT` and `SITE` follow: absent data renders
 * nothing rather than a placeholder.
 */
export function hasInteriorTour(): boolean {
  return panoramaCoverage().length > 0;
}
