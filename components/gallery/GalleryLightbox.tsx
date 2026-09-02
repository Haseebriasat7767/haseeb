'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { Space } from '@/lib/experience/spaces';
import type { TimeOfDay } from '@/types';

type GalleryLightboxProps = {
  space: Space | null;
  index: number;
  total: number;
  timeOfDay: TimeOfDay;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

/**
 * Full-screen viewer. There is no photograph to show — the frame is
 * rendered live at the framing the caption names, which is the honest
 * version of a gallery for a building that only exists as code.
 *
 * Path traced rather than rasterized. This is the one place in the site
 * where a still image is the entire product and nobody is navigating, so
 * it is worth spending seconds of convergence on real global illumination
 * instead of the real-time approximation the explorer needs. Same geometry,
 * same materials, same sky — more light paths.
 *
 * The canvas mounts on open and unmounts on close, so a closed gallery
 * holds no GPU resources.
 */
export function GalleryLightbox({
  space,
  index,
  total,
  timeOfDay,
  onClose,
  onPrevious,
  onNext,
}: GalleryLightboxProps) {
  const open = space !== null;
  const [converged, setConverged] = useState(0);

  // Reset whenever the framing changes; each space converges from scratch.
  useEffect(() => setConverged(0), [space?.id, timeOfDay]);

  const handleProgress = useCallback((samples: number, maxSamples: number) => {
    setConverged(Math.min(1, samples / Math.max(1, maxSamples)));
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrevious();
      if (event.key === 'ArrowRight') onNext();
      if (event.key !== 'Tab') return;

      // A modal viewer has to hold focus, or tabbing walks out into the
      // page behind it while the page is inert to the eye.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreTo.current?.focus();
    };
  }, [open, onClose, onPrevious, onNext]);

  if (!space) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${space.name} — frame ${index + 1} of ${total}`}
      tabIndex={-1}
      className="bg-obsidian fixed inset-0 z-50 flex flex-col outline-none"
    >
      <div className="px-gutter flex h-20 shrink-0 items-center justify-between">
        <p className="text-eyebrow text-stone uppercase">
          <span className="text-gold tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <span className="mx-3" aria-hidden="true">
            /
          </span>
          {String(total).padStart(2, '0')}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          data-cursor="link"
          className="text-mist hover:text-alabaster -mr-2 inline-flex h-11 w-11 items-center justify-center transition-colors"
        >
          <X size={22} strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <ExperienceViewport
          key={space.id}
          className="absolute inset-0 h-full w-full"
          view={space.view}
          mode="fixed"
          cinematic
          onCinematicProgress={handleProgress}
          timeOfDay={timeOfDay}
          label={`${space.name} — path-traced frame`}
        />
        {/* Convergence, and only while it matters. A progress figure that
            lingers on a finished image is chrome competing with the
            architecture, which is the one thing this page must not do. */}
        {converged < 1 ? (
          <div className="pointer-events-none absolute right-6 bottom-6 flex items-center gap-3">
            <div className="bg-alabaster/20 h-px w-24 overflow-hidden">
              <div
                className="bg-gold h-px transition-[width] duration-300"
                style={{ width: `${Math.round(converged * 100)}%` }}
              />
            </div>
            <span className="text-eyebrow text-mist uppercase tabular-nums">Resolving</span>
          </div>
        ) : null}
      </div>

      <div className="px-gutter flex shrink-0 items-end justify-between gap-8 py-8">
        <div className="max-w-[48ch]">
          <p className="text-eyebrow text-stone uppercase">{space.eyebrow}</p>
          <h2 className="font-display text-alabaster mt-3 text-2xl font-light sm:text-3xl">
            {space.name}
          </h2>
          <p className="text-mist mt-3 text-sm leading-relaxed">{space.feature}</p>
        </div>

        <div className="flex shrink-0 gap-px">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous frame"
            data-cursor="link"
            className="border-alabaster/20 text-mist hover:text-alabaster hover:border-gold inline-flex h-12 w-12 items-center justify-center border transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={1.25} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next frame"
            data-cursor="link"
            className="border-alabaster/20 text-mist hover:text-alabaster hover:border-gold inline-flex h-12 w-12 items-center justify-center border transition-colors"
          >
            <ChevronRight size={18} strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
