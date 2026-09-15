'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { CLIENT } from '@/lib/constants/client';
import type { ResolvedTourStep } from '@/lib/experience/guided-tour';
import { cn } from '@/lib/utils/cn';

/**
 * The guided tour's chrome.
 *
 * Presentational by design: it holds no camera, no scene and no state of
 * its own beyond focus. Every control calls back into the explorer, which
 * moves the existing camera by the existing means — so the tour is an order
 * to see the building in, not a second way of seeing it.
 *
 * Sized to stay out of the way. The architecture is the thing being sold;
 * a tour that covers it to explain it has defeated itself.
 */

export type TourPhase = 'intro' | 'running' | 'complete';

type GuidedTourProps = {
  phase: TourPhase;
  /** Null at `intro` and `complete`, where there is no step to draw. */
  current: ResolvedTourStep | null;
  onBegin: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
  onFloorPlan: () => void;
};

/** The shared panel treatment — the same border, ground and blur the rest
 *  of the overlay chrome uses. */
const PANEL = 'border-alabaster/15 bg-obsidian/70 border backdrop-blur-md';

export function GuidedTour({
  phase,
  current,
  onBegin,
  onSkip,
  onPrevious,
  onNext,
  onExit,
  onFloorPlan,
}: GuidedTourProps) {
  // Escape leaves, from any phase. A visitor who wants out of a guided
  // sequence wants out immediately, and hunting for the exit is the moment
  // a presentation stops feeling like one.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  if (phase === 'intro') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6">
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Begin the guided experience"
          className={cn(
            PANEL,
            'pointer-events-auto flex w-full max-w-md flex-col gap-6 p-8 text-center sm:p-10',
          )}
        >
          <div className="flex flex-col gap-3">
            <p className="text-eyebrow text-stone uppercase">Experience AURELIA</p>
            <p className="font-display text-alabaster text-2xl leading-tight font-semibold sm:text-3xl">
              A guided walk through the residence.
            </p>
            <p className="text-mist text-sm leading-relaxed">
              Eight stops through the building and its grounds, from the approach to the pool after
              dark — then the floor plan, and the way to ask for a viewing.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onBegin} magnetic>
              Begin
            </Button>
            <Button onClick={onSkip} variant="ghost" size="sm">
              Explore freely
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6">
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Guided experience complete"
          className={cn(
            PANEL,
            'pointer-events-auto flex w-full max-w-md flex-col gap-6 p-8 text-center sm:p-10',
          )}
        >
          <div className="flex flex-col gap-3">
            <p className="text-eyebrow text-stone uppercase">You&rsquo;ve seen the property</p>
            <p className="font-display text-alabaster text-2xl leading-tight font-semibold sm:text-3xl">
              Now imagine your property this way.
            </p>
            <p className="text-mist text-sm leading-relaxed">
              The residence is conceptual. The experience is real — and can be built for a
              development that does not exist yet.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button onClick={onFloorPlan} variant="outline" magnetic>
                Explore the floor plan
              </Button>
              <Button href="/contact" magnetic>
                Request a viewing
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={onExit}
                className="text-eyebrow text-stone hover:text-alabaster uppercase transition-colors"
              >
                Explore freely
              </button>
              {CLIENT.brochurePath ? (
                <a
                  href={CLIENT.brochurePath}
                  download
                  data-cursor="link"
                  className="text-eyebrow text-stone hover:text-alabaster uppercase transition-colors"
                >
                  Download brochure
                </a>
              ) : null}
              <a
                href="/for-agencies"
                data-cursor="link"
                className="text-eyebrow text-stone hover:text-alabaster uppercase transition-colors"
              >
                Create this for my property
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const isFirst = current.position === 1;
  const isLast = current.position === current.total;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* The step itself. `aria-live` on the inner block rather than the
          whole bar, so advancing announces the new space and not the
          buttons around it as well. */}
      <div className={cn(PANEL, 'pointer-events-auto w-full max-w-lg px-5 py-4 sm:px-6 sm:py-5')}>
        <div aria-live="polite" className="flex flex-col gap-1.5 text-center">
          <div className="flex items-center justify-center gap-3">
            <p className="text-eyebrow text-stone uppercase">{current.eyebrow}</p>
            <span aria-hidden="true" className="bg-alabaster/20 h-px w-6" />
            <p className="text-eyebrow text-gold tabular-nums">
              {String(current.position).padStart(2, '0')} / {String(current.total).padStart(2, '0')}
            </p>
          </div>
          <p className="font-display text-alabaster text-xl leading-tight font-semibold sm:text-2xl">
            {current.name}
          </p>
          <p className="text-mist text-xs leading-relaxed sm:text-sm">{current.description}</p>
        </div>

        {/* Progress. A hairline rather than dots — the same rule the rest of
            the site's indicators follow. */}
        <div
          aria-hidden="true"
          className="bg-alabaster/15 relative mt-4 h-px w-full overflow-hidden"
        >
          <span
            className="bg-gold ease-luxe absolute inset-y-0 left-0 transition-[width] duration-700"
            style={{ width: `${(current.position / current.total) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrevious}
            disabled={isFirst}
            className="text-eyebrow ease-luxe text-alabaster/80 hover:text-alabaster inline-flex min-h-11 items-center gap-2 uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span aria-hidden="true">‹</span>
            Previous
          </button>

          <button
            type="button"
            onClick={onExit}
            className="text-eyebrow text-stone hover:text-alabaster inline-flex min-h-11 items-center uppercase transition-colors"
          >
            Exit tour
          </button>

          <button
            type="button"
            onClick={onNext}
            className="text-eyebrow ease-luxe text-alabaster/80 hover:text-alabaster inline-flex min-h-11 items-center gap-2 uppercase transition-colors"
          >
            {isLast ? 'Finish' : 'Next'}
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuidedTour;
