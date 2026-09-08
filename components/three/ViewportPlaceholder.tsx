'use client';

import { SITE } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';

/**
 * What fills the viewport before the three.js chunk exists.
 *
 * ## Why this is not `LoadingScreen`
 *
 * Because `LoadingScreen` reads drei's `useProgress`, which means it lives
 * inside the very chunk it would be reporting the arrival of. It cannot
 * appear until the thing it is waiting for has already landed.
 *
 * That was not a theoretical gap. `ExperienceCanvas` is a `next/dynamic`
 * import with `ssr: false` and no `loading` fallback, so from first paint
 * until the three.js bundle finished downloading, this area rendered
 * literally nothing. On a desktop connection that is a flicker. On a phone on
 * mobile data it is a black rectangle for as long as the download takes, with
 * no spinner, no text and no indication that anything is happening — which is
 * exactly what a visitor reported, and exactly what it looked like.
 *
 * So this carries no dependency beyond the design tokens: it is in the main
 * bundle, it renders on the first paint, and it holds the frame until the
 * real loading screen can take over.
 */
export function ViewportPlaceholder({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'bg-obsidian absolute inset-0 z-20 flex flex-col items-center justify-center gap-8',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="font-display text-alabaster text-3xl tracking-[0.5em] sm:text-4xl">
          {SITE.name}
        </span>
        <span className="text-eyebrow text-stone uppercase">Preparing the view</span>
      </div>

      {/* An indeterminate rule rather than a percentage. Nothing has started
          loading yet, so a 0% readout would be a number pretending to be a
          measurement. */}
      <div className="bg-alabaster/15 relative h-px w-48 overflow-hidden" aria-hidden="true">
        <span className="bg-gold absolute inset-y-0 left-0 w-1/3 animate-[viewport-sweep_1.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

export default ViewportPlaceholder;
