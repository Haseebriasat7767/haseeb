'use client';

import { findSpace } from '@/lib/experience/spaces';
import { cn } from '@/lib/utils/cn';

/**
 * What occupies the viewport before it is worth mounting a renderer into.
 *
 * ## Why this is not `ViewportPlaceholder`
 *
 * They answer different questions. `ViewportPlaceholder` says *the view is
 * being prepared* — it belongs to the window between "we have decided to
 * load three.js" and "three.js has arrived". This says *there will be a view
 * here*, for a region that is still below the fold and has deliberately not
 * started loading anything. Showing the loading treatment for a region we
 * are not loading would be a progress indicator for work that has not begun.
 *
 * It holds the frame at the same size the canvas will occupy, so the mount
 * causes no reflow, and it names the space it stands in — read from
 * `spaces.ts`, so it cannot describe a room the residence does not have.
 */
export function ViewportSkeleton({
  spaceId,
  className,
}: {
  /** The space this viewport will show, for the caption. */
  spaceId?: string;
  className?: string;
}) {
  const space = spaceId ? findSpace(spaceId) : undefined;

  return (
    <div
      aria-hidden="true"
      className={cn('bg-obsidian absolute inset-0 overflow-hidden', className)}
    >
      {/* The shimmer is decoration, and decoration that moves is exactly
          what `prefers-reduced-motion` exists to stop. The surface below it
          stays, so the frame is still held. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent motion-safe:animate-[viewport-shimmer_2.4s_ease-in-out_infinite]" />

      {space ? (
        <div className="px-gutter absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-center">
          <span className="text-eyebrow text-stone/70 uppercase">{space.eyebrow}</span>
          <span className="font-display text-alabaster/50 text-xl">{space.name}</span>
        </div>
      ) : null}
    </div>
  );
}
