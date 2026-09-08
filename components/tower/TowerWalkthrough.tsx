'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { HourDial } from '@/components/experience/HourDial';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { hourTheme } from '@/lib/experience/hour-theme';
import { DEFAULT_TOWER_VIEW, TOWER_VIEWS, TOWER_VIEW_NOTES } from '@/lib/three/tower-views';
import { cn } from '@/lib/utils/cn';
import type { TimeOfDay } from '@/types';

/**
 * Golden hour, not the site-wide default's reasoning but the same
 * conclusion: this building is oriented so the sun goes down over its ocean
 * elevation, and the walkthrough should open on the thing it was composed
 * for rather than make the visitor go and find it.
 */
const OPENING_HOUR: TimeOfDay = 'goldenHour';

/**
 * The walkthrough.
 *
 * A stepped sequence rather than a free camera, and deliberately: nine
 * framings that a person actually moves through, in the order they would
 * move through them. Free orbit is better for inspecting a model and worse
 * for being shown a building — it puts the burden of finding the good view
 * on the visitor, and most visitors will not find it.
 *
 * The hour runs underneath the whole sequence, so any step can be seen at
 * any time of day. That pairing is the point of the page: the balcony at
 * golden hour and the balcony at blue hour are two different apartments.
 */
export function TowerWalkthrough() {
  // `?step=` opens the walkthrough on a given framing. Deep-linking a
  // single view is what makes one of these shareable — a balcony at sunset
  // is a link you can send someone, where "open this and press Continue six
  // times" is not.
  const params = useSearchParams();
  const requested = Number(params.get('step'));
  const initial =
    Number.isFinite(requested) && requested >= 1 && requested <= TOWER_VIEWS.length
      ? requested - 1
      : 0;

  const [step, setStep] = useState(initial);
  const [hour, setHour] = useState<TimeOfDay>(OPENING_HOUR);
  const webgl = useWebGLSupport();

  const view = TOWER_VIEWS[step] ?? DEFAULT_TOWER_VIEW;
  const theme = hourTheme(hour);
  const note = TOWER_VIEW_NOTES[view.id] ?? '';
  const last = TOWER_VIEWS.length - 1;

  const go = useCallback((next: number) => setStep(Math.min(last, Math.max(0, next))), [last]);

  const scrim = useMemo(
    () => ({
      backgroundImage: `linear-gradient(to top, ${theme.scrim} 0%, ${theme.scrim}d4 24%, ${theme.scrim}4d 58%, transparent 100%)`,
    }),
    [theme.scrim],
  );

  return (
    <section aria-label="Tower walkthrough" className="relative">
      <ExperienceViewport
        className="h-[86svh] w-full"
        view={view}
        mode="fixed"
        content="tower"
        timeOfDay={hour}
        label={`Three-dimensional view of the oceanfront tower — ${view.label}`}
      >
        {/* Readability ground for the caption and the controls. */}
        <div
          aria-hidden="true"
          className="ease-luxe pointer-events-none absolute inset-x-0 bottom-0 h-[54%] transition-[background] duration-[1200ms]"
          style={scrim}
        />

        {/* The hour, down the left edge on a wide screen. */}
        {webgl === false ? null : (
          <HourDial
            value={hour}
            onChange={setHour}
            className="absolute top-1/2 left-7 z-10 hidden -translate-y-1/2 lg:block xl:left-10"
          />
        )}

        {/* Step index down the right edge, doubling as navigation. */}
        <nav
          aria-label="Walkthrough steps"
          className="absolute top-1/2 right-6 z-10 hidden -translate-y-1/2 lg:block"
        >
          <ol className="flex flex-col items-end gap-4">
            {TOWER_VIEWS.map((entry, index) => {
              const current = index === step;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => go(index)}
                    aria-current={current ? 'step' : undefined}
                    data-cursor="link"
                    className="group flex items-center justify-end gap-3"
                  >
                    <span
                      className={cn(
                        'text-eyebrow ease-luxe uppercase transition-all duration-500',
                        current
                          ? 'text-alabaster opacity-100'
                          : 'text-mist opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                      )}
                    >
                      {entry.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'ease-luxe h-px transition-all duration-500',
                        current ? 'bg-gold w-8' : 'bg-alabaster/40 group-hover:bg-alabaster w-4',
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Caption and step controls. */}
        <div className="px-gutter absolute inset-x-0 bottom-0 z-10 pb-6 lg:pb-10">
          <div className="max-w-wide mx-auto flex flex-col gap-4 lg:pl-[7.5rem]">
            <div className="max-w-[56ch]">
              <p className="text-eyebrow text-bone/70 flex items-center gap-4 uppercase">
                <span className="text-gold tabular-nums">{String(step + 1).padStart(2, '0')}</span>
                <span aria-hidden="true" className="bg-gold-dim h-px w-8" />
                {view.label}
              </p>
              {/* aria-live so a screen-reader user hears the new caption
                  when the step changes — the canvas itself cannot say it. */}
              <p className="text-lede text-mist mt-3" aria-live="polite">
                {note}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => go(step - 1)}
                disabled={step === 0}
                className="text-eyebrow text-alabaster border-alabaster/30 hover:border-alabaster focus-visible:outline-gold ease-luxe rounded-full border px-5 py-2 uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => go(step + 1)}
                disabled={step === last}
                className="text-eyebrow text-obsidian bg-alabaster hover:bg-bone focus-visible:outline-gold ease-luxe rounded-full px-5 py-2 uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {step === last ? 'End of walkthrough' : 'Continue'}
              </button>
              <span className="text-eyebrow text-stone uppercase tabular-nums">
                {step + 1} / {TOWER_VIEWS.length}
              </span>
            </div>

            {/* The compact hour dial. Below `lg` the vertical form would sit
                under the thumb, so it moves to the foot of the frame. */}
            {webgl === false ? null : (
              <div className="lg:hidden">
                <HourDial value={hour} onChange={setHour} orientation="horizontal" />
              </div>
            )}
          </div>
        </div>
      </ExperienceViewport>
    </section>
  );
}

export default TowerWalkthrough;
