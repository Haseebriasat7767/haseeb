'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { Container } from '@/components/ui/Container';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { findSpace, SPACES } from '@/lib/experience/spaces';
import type { Space } from '@/lib/experience/spaces';
import type { TimeOfDay } from '@/types';
import { CinematicOverlay } from '@/components/experience/CinematicOverlay';
import { HourDial } from '@/components/experience/HourDial';
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
  const params = useSearchParams();
  const reducedMotion = useReducedMotion();
  const webgl = useWebGLSupport();

  const requested = params.get('space');
  const [framedId, setFramedId] = useState<string>(
    () => findSpace(requested ?? '')?.id ?? DEFAULT_SPACE.id,
  );
  const [openId, setOpenId] = useState<string | null>(() => findSpace(requested ?? '')?.id ?? null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(DEFAULT_TIME_OF_DAY);

  // A deep link arriving after mount (client navigation) should still land.
  useEffect(() => {
    const target = findSpace(requested ?? '');
    if (!target) return;
    setFramedId(target.id);
    setOpenId(target.id);
  }, [requested]);

  const framed = useMemo(() => findSpace(framedId) ?? DEFAULT_SPACE, [framedId]);
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
          parallax={reducedMotion ? 0 : 1}
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
      <Container className="pb-section">
        <div className="border-alabaster/10 grid gap-10 border-t pt-10 lg:grid-cols-12 lg:gap-16">
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
          </div>
        </div>
      </Container>
    </div>
  );
}

export default ResidenceExplorer;
