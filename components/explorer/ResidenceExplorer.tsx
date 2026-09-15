'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { Container } from '@/components/ui/Container';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { CAMERA_VIEWS } from '@/lib/three/scene-config';
import { findSpace, SPACES } from '@/lib/experience/spaces';
import type { Space } from '@/lib/experience/spaces';
import type { CameraView, TimeOfDay } from '@/types';
import { CinematicOverlay } from '@/components/experience/CinematicOverlay';
import { TouchHint } from '@/components/experience/TouchHint';
import { VisitedCTA } from '@/components/experience/VisitedCTA';
import { BuildingSwitch } from '@/components/navigation/BuildingSwitch';
import { HourDial } from '@/components/experience/HourDial';
import { FloorPlan } from '@/components/plan/FloorPlan';
import { Gallery } from '@/components/gallery/Gallery';
import { AccommodationSchedule } from '@/components/residence/AccommodationSchedule';
import { Reveal } from '@/components/effects/Reveal';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PROPERTY } from '@/lib/constants/site';
import { PALETTE } from '@/lib/experience/palette';
import { cn } from '@/lib/utils/cn';
import { DeepLinkedSpace } from './DeepLinkedSpace';
import { SpacePanel } from './SpacePanel';
import { SpaceRail } from './SpaceRail';
import { TouchSticks } from '@/components/tower/TouchSticks';
import { WalkPad } from '@/components/tower/WalkPad';

const DEFAULT_SPACE = SPACES[0]!;

export type ExplorerTab = 'overview' | 'explore' | 'plan' | 'gallery';

/**
 * The residence, in one page — the same pattern `/tower` already set: a
 * guided read of the building, a way to move through it yourself, a
 * drawing of it, and a set of framings, held as tabs in one component tree
 * rather than spread across four separate pages. This used to be four
 * routes (`/residence`, `/experience`, `/floor-plan`, `/gallery`) each with
 * its own masthead; the other three now redirect here (`next.config.ts`)
 * so an old link keeps working, but a visitor only ever sees one page.
 */
const TABS: ReadonlyArray<{ id: ExplorerTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'explore', label: 'Explore' },
  { id: 'plan', label: 'Floor plan' },
  { id: 'gallery', label: 'Gallery' },
];

/**
 * The flyover. Reuses the site's own aerial framing for its position and
 * target rather than inventing a new vantage — `CameraController`'s
 * `cinematic` mode then does all the work, orbiting at the radius and
 * height that position already implies around the target already composed
 * for it. The same technique `TowerWalkthrough`'s "Fly over" uses.
 */
const FLYOVER_VIEW: CameraView = CAMERA_VIEWS.find((entry) => entry.id === 'aerial')!;

const TAB_COPY: Record<ExplorerTab, { eyebrow: string; title: string }> = {
  overview: { eyebrow: 'The Residence', title: PROPERTY.name },
  explore: { eyebrow: 'Explore', title: 'Every space in the residence' },
  plan: { eyebrow: 'Architecture', title: 'Plans and levels' },
  gallery: { eyebrow: 'Gallery', title: 'Framings of the residence' },
};

/**
 * The residence explorer. One canvas, one camera, and a set of named
 * spaces: selecting a space in the rail or clicking its marker on the model
 * eases the camera to that framing and opens its details. Nothing here
 * navigates — the scene is never torn down and rebuilt.
 *
 * `initialTab` seeds the starting tab; after that it is ordinary component
 * state, switched by the tab bar without a route change — the same way the
 * tower's own guided tour, walk mode and inventory are mode switches on one
 * page rather than separate ones. `?tab=` and `?space=` (read by
 * `DeepLinkedSpace`) can still request a starting tab or space, which is how
 * the redirects from the old routes and the journey's "Enter this space"
 * links keep landing in the right place.
 */
export function ResidenceExplorer({ initialTab = 'overview' }: { initialTab?: ExplorerTab }) {
  const reducedMotion = useReducedMotion();
  // Pointer parallax has no meaning without a pointer: on a touch screen the
  // camera would only shift while a thumb is already dragging it, which
  // fights the drag rather than adding to it. It also costs a render every
  // pointermove on exactly the devices with the least headroom.
  const coarsePointer = useCoarsePointer();
  const webgl = useWebGLSupport();

  const [tab, setTab] = useState<ExplorerTab>(initialTab);
  const [framedId, setFramedId] = useState<string>(DEFAULT_SPACE.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(DEFAULT_TIME_OF_DAY);
  const [walking, setWalking] = useState(false);
  // The flyover, nested under "on foot" rather than a third top-level mode —
  // it is the other way of moving through the grounds yourself, where the
  // guided tour is composed for the visitor. Reset whenever the visitor
  // leaves "on foot" entirely, so re-entering walk mode always opens on the
  // ground rather than remembering the sky.
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    if (!walking) setFlying(false);
  }, [walking]);

  /**
   * Which of the three levels the visitor has framed.
   *
   * A Set rather than a counter: revisiting the terrace three times is not
   * the same as having seen the upper floor, and only the second earns the
   * closing offer.
   */
  const [seen, setSeen] = useState<ReadonlySet<Space['level']>>(() => new Set());

  /**
   * Opens the space named in `?space=`, and switches to the tab that shows
   * it — a space only means anything on `explore`, so a link that names one
   * takes the visitor straight there regardless of which tab it happened to
   * ask for.
   */
  const openSpace = useCallback((id: string) => {
    const target = findSpace(id);
    if (!target) return;
    setFramedId(target.id);
    setOpenId(target.id);
    setTab('explore');
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

  const copy = TAB_COPY[tab];

  return (
    <div className="relative">
      {/*
        Full bleed, `explore` only. The reference language for a residence
        of this kind puts the architecture edge to edge and lets nothing but
        hairline chrome sit over it; a view boxed into two thirds of the
        viewport with its controls stacked underneath reads as a product
        page instead. The rail and the hour control still live below, for
        the visitor who wants the whole set at once.

        The other tabs have no canvas of their own to open on — `FloorPlan`
        is a drawing, `Gallery` renders each framing only once it's opened,
        and `overview` is read, not looked through — so they skip straight
        to the heading below.
      */}
      {tab !== 'explore' ? null : (
        <div className="relative h-[86svh] w-full overflow-hidden lg:h-[92svh]">
          <ExperienceViewport
            className="absolute inset-0 h-full w-full"
            view={flying ? FLYOVER_VIEW : framed.view}
            mode={walking ? (flying ? 'cinematic' : 'walk') : 'journey'}
            timeOfDay={timeOfDay}
            parallax={walking ? 0 : reducedMotion || coarsePointer ? 0 : 4.0}
            label={
              flying
                ? 'Three-dimensional aerial view, circling the residence'
                : `Interactive residence, currently framing the ${framed.name.toLowerCase()}`
            }
            hotspots={flying ? undefined : { activeId: openId, onSelect: select }}
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

            {/* Walk toggle button */}
            {webgl === false ? null : (
              <button
                type="button"
                onClick={() => setWalking((on) => !on)}
                className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold bg-obsidian/40 absolute top-24 right-6 z-20 inline-flex min-h-11 items-center border px-4 py-2.5 uppercase backdrop-blur-sm transition-colors duration-300"
              >
                {walking ? 'Guided tour' : 'Walk the residence'}
              </button>
            )}

            {/* The second choice, once on foot: cross the grounds yourself,
                or pull back to a drone's height and glide the exterior
                instead. Nested under the first toggle rather than a third
                top-level option, matching the tower's own "Fly over". */}
            {webgl === false || !walking ? null : (
              <button
                type="button"
                onClick={() => setFlying((on) => !on)}
                className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold bg-obsidian/40 absolute top-40 right-6 z-20 inline-flex min-h-11 items-center border px-4 py-2.5 uppercase backdrop-blur-sm transition-colors duration-300"
              >
                {flying ? 'Ground view' : 'Fly over'}
              </button>
            )}

            {/* Touch only. Without a cursor there is nothing to tell a phone
              visitor the frame moves, and an interactive view mistaken for
              a photograph is scrolled past. */}
            {walking ? null : <TouchHint label="Drag to look around · Pinch to zoom" />}

            {/* Walk mode instructions */}
            {walking && !flying ? (
              <div className="text-eyebrow text-mist/80 bg-obsidian/50 pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-sm px-4 py-2.5 text-center uppercase backdrop-blur-sm">
                <span className="hidden sm:inline">
                  Drag to look · arrows or W A S D to walk · Shift to run
                </span>
                <span className="sm:hidden">Left thumb to walk · Right thumb to look</span>
              </div>
            ) : null}

            {flying ? (
              <div className="text-eyebrow text-mist/80 bg-obsidian/50 pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-sm px-4 py-2.5 text-center uppercase backdrop-blur-sm">
                Circling the residence
              </div>
            ) : null}

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

          {/* Thumb controls for walk mode. Neither applies in flight — the
              orbit flies itself. */}
          <TouchSticks active={walking && !flying} />
          {/* Keyboard controls for walk mode */}
          <WalkPad active={walking && !flying} />

          <SpacePanel space={open} onClose={close} onFocusSpace={frame} />
        </div>
      )}

      {/* Reads `?space=` and `?tab=` and renders nothing. Its own boundary,
          so its client-only nature cannot pull the rest of the page out of
          the server-rendered HTML. Unconditional — not just inside
          `explore` — since a `?tab=` link has to be read before any tab is
          showing. */}
      <Suspense fallback={null}>
        <DeepLinkedSpace onSpace={openSpace} onTab={setTab} />
      </Suspense>

      <Container className={cn('pb-section', tab === 'explore' ? undefined : 'pt-32 sm:pt-36')}>
        {/* The page's only `h1`. On `explore` it belongs here rather than
            above the frame: the view opens the page full bleed on purpose,
            so the heading introduces the rail once the visitor has looked.
            Every other tab has no frame above it, so the same header carries
            the extra top padding added above instead. */}
        <header className="border-alabaster/10 flex flex-col gap-6 border-t pt-10">
          {/* The pair, so the second building is visible from inside the
              first rather than only in the menu. */}
          <BuildingSwitch className="self-start" />

          {/* The spine's own navigation: four sections of one flow, held as
              tabs rather than as four separate pages. */}
          <nav aria-label="Residence sections" role="tablist" className="flex flex-wrap gap-px">
            {TABS.map((entry) => {
              const active = entry.id === tab;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-cursor="link"
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    'ease-luxe flex min-h-11 items-center px-5 font-sans text-[0.6875rem] tracking-[0.24em] uppercase transition-colors duration-200',
                    active
                      ? 'bg-alabaster text-obsidian'
                      : 'border-alabaster/25 text-mist hover:text-alabaster border',
                  )}
                >
                  {entry.label}
                </button>
              );
            })}
          </nav>

          <p className="text-eyebrow text-stone uppercase">{copy.eyebrow}</p>
          <h1 className="font-display text-alabaster text-display-md mt-5 max-w-[24ch] font-light">
            {copy.title}
          </h1>
          {tab === 'overview' ? (
            <p className="text-lede text-mist max-w-[62ch]">
              {PROPERTY.location}. Designed by {PROPERTY.architect} and completed in {PROPERTY.year}{' '}
              — a single continuous volume set against the ridge, oriented for one uninterrupted
              view.
            </p>
          ) : null}
        </header>

        {tab === 'overview' ? (
          <div className="flex flex-col gap-24 pt-16">
            <section
              aria-labelledby="concept-heading"
              className="grid gap-12 lg:grid-cols-12 lg:gap-20"
            >
              <div className="lg:col-span-5">
                <Reveal>
                  <SectionHeading
                    eyebrow="Concept"
                    title={<span id="concept-heading">Mass, shadow, and horizon</span>}
                  />
                </Reveal>
              </div>
              <div className="flex flex-col gap-6 lg:col-span-7">
                <Reveal delay={80}>
                  <p className="text-lede text-mist">
                    A rear service bar holds the private rooms. Two stone wings push forward from
                    it, and the glazed living volume occupies the gap they leave — so the house is
                    read as two solids and the light between them.
                  </p>
                </Reveal>
                <Reveal delay={140}>
                  <p className="text-mist text-sm leading-relaxed">
                    Above, the upper floor cantilevers four metres past the building line over the
                    terrace, and a two-storey slot is cut through both levels at the entrance and
                    roofed in glass. Nothing is decorative. Every element is structural, and the
                    landscape is invited to do the rest.
                  </p>
                </Reveal>
              </div>
            </section>

            <section aria-labelledby="palette-heading" className="flex flex-col gap-12">
              <Reveal>
                <SectionHeading
                  eyebrow="Materials"
                  title={<span id="palette-heading">Six finishes, and no others</span>}
                  lede="The palette is deliberately short. Each finish below is a material the
                    model is genuinely rendered with, not a specification written after the fact."
                />
              </Reveal>

              <dl className="border-alabaster/10 grid border-t sm:grid-cols-2 lg:grid-cols-3">
                {PALETTE.map((finish, index) => (
                  <Reveal
                    key={finish.name}
                    delay={index * 50}
                    className="border-alabaster/10 flex flex-col gap-3 border-b py-8 sm:pr-10"
                  >
                    <dt className="font-display text-alabaster text-xl font-light">
                      {finish.name}
                    </dt>
                    <dd className="flex flex-col gap-2">
                      <span className="text-eyebrow text-stone block uppercase">
                        {finish.where}
                      </span>
                      <span className="text-mist block text-sm leading-relaxed">{finish.note}</span>
                    </dd>
                  </Reveal>
                ))}
              </dl>
            </section>

            <section aria-labelledby="accommodation-heading" className="flex flex-col gap-12">
              <Reveal>
                <SectionHeading
                  eyebrow="Accommodation"
                  title={<span id="accommodation-heading">Room by room</span>}
                  lede="Areas are computed from the residence's room schedule, level by level."
                />
              </Reveal>
              <AccommodationSchedule />
            </section>

            <section className="border-alabaster/10 flex flex-col items-start gap-8 border-t pt-16">
              <SectionHeading
                eyebrow="Enquire"
                title="See it in person"
                lede="Viewings are held by appointment. Share your details and the private client team will respond with a proposed time."
              />
              <div className="flex flex-wrap gap-3">
                <Button href="/contact" magnetic>
                  Request private viewing
                </Button>
                <Button variant="outline" magnetic onClick={() => setTab('plan')}>
                  Study the plans
                </Button>
              </div>
            </section>
          </div>
        ) : tab === 'explore' ? (
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
                Select a space to move the camera to it — markers on the model open the same
                details. Moving the pointer across the frame shifts the camera slightly, the way a
                hand-held architectural camera would. The hour changes the lighting state, not the
                geometry.
              </p>

              {/* Appears once the site, the ground floor and the upper floor
                  have all been framed — never before. */}
              <VisitedCTA shown={seenEverything} />
            </div>
          </div>
        ) : tab === 'plan' ? (
          <div className="pt-10">
            <p className="text-mist max-w-[64ch] pb-10 text-sm leading-relaxed">
              Two levels stepped onto the ridge. The plans and the residence are drawn to one
              schedule, so what you walk through in{' '}
              <button
                type="button"
                onClick={() => setTab('explore')}
                className="text-alabaster hover:text-gold underline"
              >
                Explore
              </button>{' '}
              and what you read here are the same description.
            </p>
            <FloorPlan />
          </div>
        ) : (
          <div className="pt-10">
            <p className="text-mist max-w-[64ch] pb-10 text-sm leading-relaxed">
              These are not photographs. Each framing opens as a live view of the residence — choose
              an hour, and the whole set answers to it.
            </p>
            <Gallery />
          </div>
        )}
      </Container>
    </div>
  );
}

export default ResidenceExplorer;
