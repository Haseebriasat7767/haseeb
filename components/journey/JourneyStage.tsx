'use client';

import { useMemo, useState } from 'react';
import { HourDial } from '@/components/experience/HourDial';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { hourTheme } from '@/lib/experience/hour-theme';
import { JOURNEY } from '@/lib/experience/journey';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { cn } from '@/lib/utils/cn';
import type { TimeOfDay } from '@/types';

const CHAPTER_IDS = JOURNEY.map((chapter) => `chapter-${chapter.id}`);

/**
 * The scroll journey. One canvas is pinned for the whole sequence and the
 * chapters scroll over it; whichever chapter owns the middle of the
 * viewport supplies the camera framing, and `CameraController`'s `journey`
 * mode eases position, target, and focal length toward it.
 *
 * The copy is real, in-flow markup rather than text painted onto the stage,
 * so the narrative is readable to search engines and screen readers and
 * survives the 3D layer failing to start.
 *
 * The hour dial rides on the same pinned stage, which is what makes it feel
 * like part of the building rather than a page control: it is there from
 * the first frame, it stays put through all eight chapters, and the light
 * it sets carries the whole way down.
 */
export function JourneyStage() {
  const activeId = useActiveSection(CHAPTER_IDS);
  const reducedMotion = useReducedMotion();
  // No renderer means no light to change. A control that visibly does
  // nothing is worse than an absent one.
  const webgl = useWebGLSupport();
  const [hour, setHour] = useState<TimeOfDay>(DEFAULT_TIME_OF_DAY);

  const active = useMemo(() => {
    const found = JOURNEY.find((chapter) => `chapter-${chapter.id}` === activeId);
    return found ?? JOURNEY[0]!;
  }, [activeId]);

  const theme = hourTheme(hour);

  return (
    <div className="relative">
      {/* The pinned stage. The negative margin pulls the chapters below back
          over it, so they scroll across a camera that never remounts. */}
      <div className="sticky top-0 -mb-[100svh] h-[100svh] w-full overflow-hidden">
        <ExperienceViewport
          className="absolute inset-0 h-full w-full"
          view={active.view}
          mode="journey"
          timeOfDay={hour}
          parallax={reducedMotion ? 0 : 1.4}
          label="Cinematic three-dimensional view of the residence, following the page"
        >
          {/* Readability scrim. The chapter copy sits in the lower half of
              the frame, and on narrower viewports the sunlit stone of the
              residence sits directly behind it — so the ground under the
              type has to be dark enough to carry alabaster at any width.
              Bottom-weighted, so the sky and the roofline stay clean.

              The colour it resolves to follows the hour: at golden hour it
              is a warm near-black, after dusk a cold one. The difference is
              a few degrees of hue and no change in value, which is the
              point — the frame should feel lit differently, not tinted. */}
          <div
            aria-hidden="true"
            className="ease-luxe pointer-events-none absolute inset-x-0 bottom-0 h-[62%] transition-[background] duration-[1200ms] lg:h-[64%]"
            style={{
              backgroundImage: `linear-gradient(to top, ${theme.scrim} 0%, ${theme.scrim}d9 22%, ${theme.scrim}59 58%, transparent 100%)`,
            }}
          />
          <div
            aria-hidden="true"
            className="ease-luxe pointer-events-none absolute inset-0 transition-[background] duration-[1200ms]"
            style={{
              backgroundImage: `linear-gradient(to right, ${theme.scrim}c4 0%, ${theme.scrim}59 34%, transparent 62%)`,
            }}
          />
          {/* Corner falloff. A frame this wide reads flat at the edges
              without it; a photographer would have burned them in. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(120% 85% at 50% 42%, transparent 42%, rgb(5 5 7 / 0.42) 100%)',
            }}
          />
          {/* A narrow ground for the chapter index, which sits over the
              sunlit side of the residence at wide viewports. */}
          <div
            aria-hidden="true"
            className="from-obsidian/70 pointer-events-none absolute inset-y-0 right-0 hidden w-96 bg-gradient-to-l to-transparent lg:block"
          />

          {/* The hour dial. Left edge on a wide screen, where it reads as
              the scale down the side of an architectural drawing. */}
          {webgl === false ? null : (
            <HourDial
              value={hour}
              onChange={setHour}
              className="rise absolute top-1/2 left-7 z-10 hidden -translate-y-1/2 lg:block xl:left-10"
            />
          )}

          {/* Chapter index. Doubles as the journey's navigation: the marks
              show where you are, and each one jumps to its chapter. */}
          <nav
            aria-label="Journey chapters"
            className="pointer-events-auto absolute top-1/2 right-6 z-10 hidden -translate-y-1/2 lg:block"
          >
            <ul className="flex flex-col items-end gap-4">
              {JOURNEY.map((chapter) => {
                const current = `chapter-${chapter.id}` === activeId;

                return (
                  <li key={chapter.id}>
                    <a
                      href={`#chapter-${chapter.id}`}
                      aria-current={current ? 'true' : undefined}
                      data-cursor="link"
                      className="group flex items-center justify-end gap-3"
                    >
                      <span
                        className={cn(
                          'text-eyebrow ease-luxe uppercase transition-all duration-500',
                          current
                            ? 'text-alabaster opacity-100'
                            : 'text-mist opacity-0 group-hover:opacity-100',
                        )}
                      >
                        {chapter.eyebrow}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'ease-luxe h-px transition-all duration-500',
                          current ? 'bg-gold w-8' : 'bg-alabaster/40 group-hover:bg-alabaster w-4',
                        )}
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Scroll cue, shown only while the first chapter is on screen.
              Wide viewports only: on a phone the dial occupies this band. */}
          <div
            aria-hidden="true"
            className={cn(
              'ease-luxe pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center transition-opacity duration-700 lg:flex',
              activeId === `chapter-${JOURNEY[0]!.id}` ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="text-stone text-[0.5625rem] tracking-[0.4em] uppercase">Scroll</span>
          </div>

          {/* The compact dial. Below `lg` the vertical form would sit under
              the thumb that drives the camera, so it moves to the foot of
              the frame, clear of the drag area and clear of the copy. */}
          {webgl === false ? null : (
            <div className="px-gutter absolute inset-x-0 bottom-5 z-10 lg:hidden">
              <HourDial value={hour} onChange={setHour} orientation="horizontal" className="rise" />
            </div>
          )}
        </ExperienceViewport>
      </div>

      {JOURNEY.map((chapter, index) => {
        const isActive = `chapter-${chapter.id}` === activeId;
        const isFirst = index === 0;
        const isLast = index === JOURNEY.length - 1;

        return (
          <section
            key={chapter.id}
            id={`chapter-${chapter.id}`}
            aria-labelledby={`chapter-${chapter.id}-title`}
            // The lower padding clears the compact dial on a phone; the
            // left indent clears the vertical one on a wide screen, so the
            // control never sits over a word of the copy at any width.
            // `pointer-events-none`, with the copy block opting back in.
            // Each chapter is a full-viewport box stacked over the pinned
            // stage, so its empty half was swallowing every click meant for
            // the chrome underneath — the chapter index down the right edge
            // was unreachable with a mouse, and the hour dial would have
            // been too. Scrolling, selection inside the copy and the
            // section's own intersection tracking are all unaffected.
            className="pointer-events-none relative flex h-[100svh] flex-col justify-end pb-32 sm:pb-36 lg:pb-24"
          >
            <Container>
              <div
                className={cn(
                  'ease-luxe pointer-events-auto max-w-[34ch] transition-[opacity,transform] duration-[900ms] sm:max-w-[46ch] lg:ml-[9.5rem] xl:ml-[11rem]',
                  isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-45',
                )}
              >
                <p
                  className={cn(
                    'text-eyebrow text-bone/70 flex items-center gap-4 uppercase',
                    isFirst && 'rise',
                  )}
                >
                  <span className="text-gold tabular-nums">{chapter.index}</span>
                  <span aria-hidden="true" className="bg-gold-dim h-px w-8" />
                  {chapter.eyebrow}
                </p>

                {isFirst ? (
                  <h1
                    id={`chapter-${chapter.id}-title`}
                    className="text-display-lg font-display text-alabaster rise mt-6 font-light"
                    style={{ animationDelay: '160ms' }}
                  >
                    {chapter.title}
                  </h1>
                ) : (
                  <h2
                    id={`chapter-${chapter.id}-title`}
                    className="text-display-md font-display text-alabaster mt-6 font-light"
                  >
                    {chapter.title}
                  </h2>
                )}

                <p
                  className={cn('text-lede text-mist mt-6', isFirst && 'rise')}
                  style={isFirst ? { animationDelay: '320ms' } : undefined}
                >
                  {chapter.body}
                </p>

                {isFirst || isLast ? (
                  <div
                    className={cn(
                      'mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-9',
                      isFirst && 'rise',
                    )}
                    style={isFirst ? { animationDelay: '440ms' } : undefined}
                  >
                    <Button href="/experience" magnetic>
                      Explore residence
                    </Button>
                    <Button href={isFirst ? '/floor-plan' : '/contact'} variant="outline" magnetic>
                      {isFirst ? 'View floor plan' : 'Request private viewing'}
                    </Button>
                  </div>
                ) : chapter.space ? (
                  <div className="mt-9">
                    <Button href={`/experience?space=${chapter.space}`} variant="ghost" size="sm">
                      Enter this space
                      <span aria-hidden="true">→</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            </Container>
          </section>
        );
      })}
    </div>
  );
}

export default JourneyStage;
