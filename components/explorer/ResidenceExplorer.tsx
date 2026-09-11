'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { Container } from '@/components/ui/Container';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { findSpace, SPACES } from '@/lib/experience/spaces';
import type { Space } from '@/lib/experience/spaces';
import type { TimeOfDay } from '@/types';
import { CinematicOverlay } from '@/components/experience/CinematicOverlay';
import { TouchHint } from '@/components/experience/TouchHint';
import { VisitedCTA } from '@/components/experience/VisitedCTA';
import { BuildingSwitch } from '@/components/navigation/BuildingSwitch';
import { HourDial } from '@/components/experience/HourDial';
import { DeepLinkedSpace } from './DeepLinkedSpace';
import { SpacePanel } from './SpacePanel';
import { SpaceRail } from './SpaceRail';

const DEFAULT_SPACE = SPACES[0]!;

/**
 * The residence explorer. One canvas, one camera, and a set of named
 * spaces: selecting a space in the rail or clicking its marker on the model
 * eases the camera to that framing and opens its details. Nothing here
 * navigates — the scene is never torn down and rebuilt.
 */
export function ResidenceExplorer() {
  const reducedMotion = useReducedMotion();
  // Pointer parallax has no meaning without a pointer: on a touch screen the
  // camera would only shift while a thumb is already dragging it, which
  // fights the drag rather than adding to it. It also costs a render every
  // pointermove on exactly the devices with the least headroom.
  const coarsePointer = useCoarsePointer();
  const webgl = useWebGLSupport();

  const [framedId, setFramedId] = useState<string>(DEFAULT_SPACE.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(DEFAULT_TIME_OF_DAY);

  /**
   * Which of the three levels the visitor has framed.
   *
   * A Set rather than a counter: revisiting the terrace three times is not
   * the same as having seen the upper floor, and only the second earns the
   * closing offer.
   */
  const [seen, setSeen] = useState<ReadonlySet<Space['level']>>(() => new Set());

  /**
   * Opens the space named in `?space=`.
   *
   * Passed down to `DeepLinkedSpace` rather than read here. Calling
   * `useSearchParams` in this component made Next bail out of server
   * rendering for the whole Suspense boundary, so the page's HTML was an
   * empty placeholder — no heading, no rail, nothing for a crawler that does
   * not run JavaScript. Confining the hook to a leaf that renders nothing
   * leaves the rest of this tree server-rendered.
   */
  const openSpace = useCallback((id: string) => {
    const target = findSpace(id);
    if (!target) return;
    setFramedId(target.id);
    setOpenId(target.id);
  }, []);

  const framed = useMemo(() => findSpace(framedId) ?? DEFAULT_SPACE, [framedId]);

  useEffect(() => {
    setSeen((previous) => {
      if (previous.has(framed.level)) return previous;
      const next = new Set(previous);
      next.add(framed.level);
      return next;
    });
  }, [framed.level]);

  const seenEverything = seen.size >= 3;
  const open = useMemo(() => (openId ? (findSpace(openId) ?? null) : null), [openId]);

  const select = useCallback((space: Space) => {
    setFramedId(space.id);
    setOpenId(space.id);
  }, []);

  const frame = useCallback((space: Space) => setFramedId(space.id), []);
  const close = useCallback(() => setOpenId(null), []);

  // Where the framed space sits in the series, and what sits either side of
  // it. The list wraps, so prev/next never dead-ends on the first or last
  // plate — a portfolio of views has no edges.
  const position = useMemo(() => {
    const at = SPACES.findIndex((entry) => entry.id === framed.id);
    const index = at < 0 ? 0 : at;
    return {
      index,
      previous: SPACES[(index - 1 + SPACES.length) % SPACES.length]!,
      next: SPACES[(index + 1) % SPACES.length]!,
    };
  }, [framed.id]);

  const openFramed = useCallback(() => setOpenId(framed.id), [framed.id]);

  return (
    <div className="relative">
      {/*
        Full bleed. The reference language for a residence of this kind puts
        the architecture edge to edge and lets nothing but hairline chrome
        sit over it; a view boxed into two thirds of the viewport with its
        controls stacked underneath reads as a product page instead. The
        rail and the hour control still live below, for the visitor who
        wants the whole set at once.
      */}
      <div className="relative h-[86svh] w-full overflow-hidden lg:h-[92svh]">
        <ExperienceViewport
          className="absolute inset-0 h-full w-full"
          view={framed.view}
          mode="journey"
          timeOfDay={timeOfDay}
          parallax={reducedMotion || coarsePointer ? 0 : 4.0}
          label={`Interactive residence, currently framing the ${framed.name.toLowerCase()}`}
          hotspots={{ activeId: openId, onSelect: select }}
        >
          {/* Ground for the chrome. Bottom-weighted and shallow: the
              caption, the figures and the prev/next all sit in the lower
              band, and the architecture above it stays untouched. */}
          <div
            aria-hidden="true"
            className="from-obsidian/85 via-obsidian/25 pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t to-transparent"
          />
          <div
            aria-hidden="true"
            className="from-obsidian/50 pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent"
          />
          {/* Ground for the dial. Without it the scale stands over open sky
              at the top of its travel and over sunlit grass at the bottom,
              and the two ends of the same control read at different
              strengths. Wide viewports only — that is the only place the
              vertical dial is shown. */}
          <div
            aria-hidden="true"
            className="from-obsidian/70 pointer-events-none absolute inset-y-0 left-0 hidden w-72 bg-gradient-to-r to-transparent lg:block"
          />

          {/* Touch only. Without a cursor there is nothing to tell a phone
              visitor the frame moves, and an interactive view mistaken for
              a photograph is scrolled past. */}
          <TouchHint label="Drag to look around · Pinch to zoom" />

          {/* The same dial that stands on the landing page, in the same
              place, doing the same thing — the hour is one idea across the
              site, not a control that moves when the page does. */}
          {webgl === false ? null : (
            <HourDial
              value={timeOfDay}
              onChange={setTimeOfDay}
              className="absolute top-1/2 left-7 z-10 hidden -translate-y-1/2 lg:block xl:left-10"
            />
          )}

          <CinematicOverlay
            space={framed}
            index={position.index}
            total={SPACES.length}
            previous={position.previous}
            next={position.next}
            onSelect={select}
            onOpen={openFramed}
            hidden={open !== null}
          />
        </ExperienceViewport>

        <SpacePanel space={open} onClose={close} onFocusSpace={frame} />
      </div>

      {/* `min-w-0` on both columns: a grid item defaults to `min-width:
          auto`, so without it the widest child sets the track width and the
          whole page scrolls sideways on a narrow screen. */}
      {/* Reads `?space=` and renders nothing. Its own boundary, so its
          client-only nature cannot pull the rest of the page out of the
          server-rendered HTML. */}
      <Suspense fallback={null}>
        <DeepLinkedSpace onSpace={openSpace} />
      </Suspense>

      <Container className="pb-section">
        {/* The page's only `h1`, and it belongs here rather than above the
            frame: the view opens the page full bleed on purpose, so the
            heading introduces the rail once the visitor has looked. It was
            described that way in `app/experience/page.tsx` but never
            actually written, which left this page with no `h1` at all —
            invisible to a crawler reading the document outline, and a
            document that starts at `h2` for anyone navigating by heading. */}
        <header className="border-alabaster/10 flex flex-col gap-6 border-t pt-10">
          {/* The pair, so the second building is visible from inside the
              first rather than only in the menu. */}
          <BuildingSwitch className="self-start" />
          <p className="text-eyebrow text-stone uppercase">Explore</p>
          <h1 className="font-display text-alabaster text-display-md mt-5 max-w-[24ch] font-light">
            Every space in the residence
          </h1>
        </header>
        <div className="grid gap-10 pt-10 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 lg:col-span-7">
            <SpaceRail activeId={framedId} onSelect={select} />
          </div>
          <div className="flex min-w-0 flex-col gap-8 lg:col-span-5">
            {/* Below `lg` the dial cannot live in the frame — that edge is
                where the thumb drives the camera — so it takes the head of
                this column instead, in its compact form. */}
            {webgl === false ? null : (
              <HourDial
                value={timeOfDay}
                onChange={setTimeOfDay}
                orientation="horizontal"
                className="max-w-md lg:hidden"
              />
            )}
            <p className="text-stone max-w-[42ch] text-xs leading-relaxed">
              Select a space to move the camera to it — markers on the model open the same details.
              Moving the pointer across the frame shifts the camera slightly, the way a hand-held
              architectural camera would. The hour changes the lighting state, not the geometry.
            </p>

            {/* Appears once the site, the ground floor and the upper floor
                have all been framed — never before. */}
            <VisitedCTA shown={seenEverything} />
          </div>
        </div>
      </Container>
    </div>
  );
}

export default ResidenceExplorer;
