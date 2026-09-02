'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { JOURNEY } from '@/lib/experience/journey';
import { cn } from '@/lib/utils/cn';

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
 */
export function JourneyStage() {
  const activeId = useActiveSection(CHAPTER_IDS);
  const reducedMotion = useReducedMotion();

  // The opening frame is staged: the residence settles first, then the
  // typography arrives over it. It is a reveal, never a gate — a fallback
  // timer and the reduced-motion preference both release it on their own,
  // so the copy can never be held back by the renderer.
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(reveal, 1600);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, reveal]);

  const active = useMemo(() => {
    const found = JOURNEY.find((chapter) => `chapter-${chapter.id}` === activeId);
    return found ?? JOURNEY[0]!;
  }, [activeId]);

  return (
    <div className="relative">
      {/* The pinned stage. The negative margin pulls the chapters below back
          over it, so they scroll across a camera that never remounts. */}
      <div className="sticky top-0 -mb-[100svh] h-[100svh] w-full overflow-hidden">
        <ExperienceViewport
          className="absolute inset-0 h-full w-full"
          view={active.view}
          mode="journey"
          parallax={reducedMotion ? 0 : 1.4}
          onReady={reveal}
          label="Cinematic three-dimensional view of the residence, following the page"
        >
          {/* Readability scrim. The chapter copy sits in the lower half of
              the frame, and on narrower viewports the sunlit stone of the
              residence sits directly behind it — so the ground under the
              type has to be dark enough to carry alabaster at any width.
              Bottom-weighted, so the sky and the roofline stay clean. */}
          <div
            aria-hidden="true"
            className="from-obsidian via-obsidian/75 lg:via-obsidian/35 pointer-events-none absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t to-transparent lg:h-[58%]"
          />
          <div
            aria-hidden="true"
            className="from-obsidian/70 lg:from-obsidian/55 pointer-events-none absolute inset-0 bg-gradient-to-r via-transparent to-transparent"
          />
          {/* A narrow ground for the chapter index, which sits over the
              sunlit side of the residence at wide viewports. */}
          <div
            aria-hidden="true"
            className="from-obsidian/70 pointer-events-none absolute inset-y-0 right-0 hidden w-96 bg-gradient-to-l to-transparent lg:block"
          />

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

          {/* Scroll cue, shown only while the first chapter is on screen. */}
          <div
            aria-hidden="true"
            className={cn(
              'ease-luxe pointer-events-none absolute inset-x-0 bottom-6 flex justify-center transition-opacity duration-700',
              activeId === `chapter-${JOURNEY[0]!.id}` && revealed ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="text-stone text-[0.5625rem] tracking-[0.4em] uppercase">Scroll</span>
          </div>
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
            className="relative flex h-[100svh] flex-col justify-end pb-20 sm:pb-24"
          >
            <Container>
              <div
                className={cn(
                  'ease-luxe max-w-[46ch] transition-[opacity,transform] duration-[900ms]',
                  isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-45',
                  // Only the opening chapter waits for the reveal; every
                  // chapter below it is already scrolled to on its own terms.
                  isFirst && !revealed && 'translate-y-8 !opacity-0',
                )}
                style={isFirst ? { transitionDelay: revealed ? '260ms' : '0ms' } : undefined}
              >
                <p className="text-eyebrow text-stone flex items-center gap-4 uppercase">
                  <span className="text-gold tabular-nums">{chapter.index}</span>
                  <span aria-hidden="true" className="bg-gold-dim h-px w-8" />
                  {chapter.eyebrow}
                </p>

                {isFirst ? (
                  <h1
                    id={`chapter-${chapter.id}-title`}
                    className="text-display-lg font-display text-alabaster mt-6 font-light"
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

                <p className="text-lede text-mist mt-6">{chapter.body}</p>

                {isFirst || isLast ? (
                  <div className="mt-9 flex flex-wrap gap-3">
                    <Button href="/experience" magnetic>
                      Explore residence
                    </Button>
                    <Button href={isFirst ? '/floor-plan' : '/contact'} variant="outline" magnetic>
                      {isFirst ? 'View details' : 'Request private tour'}
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
