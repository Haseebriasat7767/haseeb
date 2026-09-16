'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ExperienceViewport } from '@/components/experience/ExperienceViewport';
import { HourDial } from '@/components/experience/HourDial';
import { useWebGLSupport } from '@/hooks/useWebGLSupport';
import { hourTheme } from '@/lib/experience/hour-theme';
import { BuildingSwitch } from '@/components/navigation/BuildingSwitch';
import { ControlHint, type ControlPair } from '@/components/experience/ControlHint';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { TouchSticks } from './TouchSticks';
import { WalkPad } from './WalkPad';
import { getWalkFloors, subscribeWalkFloors, travelTo } from '@/lib/three/walk-floors';
import type { WalkFloor } from '@/lib/three/walk-floors';
import { DEFAULT_TOWER_VIEW, TOWER_VIEWS, TOWER_VIEW_NOTES } from '@/lib/three/tower-views';
import { cn } from '@/lib/utils/cn';
import type { CameraView, TimeOfDay } from '@/types';
import { InventoryPanel } from './InventoryPanel';
import { unitFloorView, type Unit } from '@/lib/property/tower-inventory';

/**
 * Golden hour, not the site-wide default's reasoning but the same
 * conclusion: this building is oriented so the sun goes down over its ocean
 * elevation, and the walkthrough should open on the thing it was composed
 * for rather than make the visitor go and find it.
 */
const OPENING_HOUR: TimeOfDay = 'goldenHour';

/**
 * The server snapshot. Stable identity matters: returning a fresh array each
 * render makes `useSyncExternalStore` decide the store changed, every render,
 * forever. There are no floors during SSR because there is no scene yet.
 */
const NO_FLOORS: readonly WalkFloor[] = [];
const serverFloors = () => NO_FLOORS;

/**
 * The flyover. Reuses the site's own aerial framing for its position and
 * target rather than inventing a new vantage — `CameraController`'s
 * `cinematic` mode then does all the work: it orbits at the radius and
 * height that position already implies, around the target already composed
 * for it, at its own damped, frame-rate-independent pace. Nothing here is
 * new camera math, only a mode switch onto math that already exists.
 */
const FLYOVER_VIEW: CameraView = TOWER_VIEWS.find((entry) => entry.id === 'aerial')!;

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
declare global {
  interface Window {
    /** Set by `scripts/brochure-stills.mjs` only. See the capture note below. */
    __AURELIA_STILL_SAMPLES__?: number;
  }
}

export function TowerWalkthrough() {
  // `?step=` opens the walkthrough on a given framing. Deep-linking a
  // single view is what makes one of these shareable — a balcony at sunset
  // is a link you can send someone, where "open this and press Continue six
  // times" is not.
  //
  // `?step=` also accepts a view's own id (`?step=balcony`), not only its
  // position. A numeric index is generated fresh everywhere it's linked
  // from — see `TowerViews` — so it never goes stale on this site. But a
  // link someone saved or sent stays exactly what they typed, and if
  // `TOWER_VIEWS` is ever reordered, every numeric link anyone is holding
  // silently repoints to a different framing while every id-based one
  // keeps working. Indices and ids both resolve to the same list, so
  // neither form is a second source of truth to keep in sync.
  const params = useSearchParams();
  const raw = params.get('step');
  const byId = raw ? TOWER_VIEWS.findIndex((view) => view.id === raw) : -1;
  const requested = Number(raw);
  const byIndex =
    Number.isFinite(requested) && requested >= 1 && requested <= TOWER_VIEWS.length
      ? requested - 1
      : -1;
  const initial = byId >= 0 ? byId : byIndex >= 0 ? byIndex : 0;

  const [step, setStep] = useState(initial);
  const [hour, setHour] = useState<TimeOfDay>(OPENING_HOUR);
  const [walking, setWalking] = useState(false);
  // The flyover, nested under "on foot" rather than a third top-level mode:
  // it is the other way of moving through the building yourself, where the
  // guided tour is composed *for* the visitor. Reset whenever the visitor
  // leaves "on foot" entirely, so re-entering walk mode always opens on the
  // ground rather than remembering the sky.
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    if (!walking) setFlying(false);
  }, [walking]);

  const coarsePointer = useCoarsePointer();

  /**
   * The controls that are actually live in the current mode. Composed views
   * are `fixed` — no orbit, no zoom — so all they offer is the scene
   * sequence and the lift.
   */
  const controls = useMemo<readonly ControlPair[]>(() => {
    if (walking && !flying) {
      return coarsePointer
        ? [
            { input: 'Left thumb', action: 'Walk' },
            { input: 'Right thumb', action: 'Look' },
          ]
        : [
            { input: 'Drag', action: 'Look' },
            { input: 'W A S D', action: 'Walk' },
            { input: 'Shift', action: 'Run' },
          ];
    }
    if (flying) return [{ input: 'Watch', action: 'Circling the tower' }];
    return [{ input: 'Continue', action: 'Move through the tower' }];
  }, [walking, flying, coarsePointer]);
  // The inventory, the guided tour's own counterpart to flying: a second
  // way to choose a framing, open only while the tour is composing the
  // camera rather than the visitor. Closed by entering walk mode, same as
  // the selected unit it drives — arriving on foot should arrive at the
  // building's own opening framing, not a floor picked minutes earlier.
  const [showInventory, setShowInventory] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  useEffect(() => {
    if (walking) {
      setShowInventory(false);
      setSelectedUnit(null);
    }
  }, [walking]);
  // Open with a mouse, closed under a thumb. Starts closed so the server's
  // markup matches the first client render.
  const [liftOpen, setLiftOpen] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const read = () => setLiftOpen(fine.matches);
    read();
    fine.addEventListener('change', read);
    return () => fine.removeEventListener('change', read);
  }, []);

  // The floors come from the scene, not from a list kept here — see
  // `lib/three/walk-floors`. Empty until the 3D layer has mounted and built
  // the building, which is why the picker appears a moment after the toggle.
  const floors = useSyncExternalStore(subscribeWalkFloors, getWalkFloors, serverFloors);
  const [floorId, setFloorId] = useState<string | null>(null);
  const webgl = useWebGLSupport();

  const view = TOWER_VIEWS[step] ?? DEFAULT_TOWER_VIEW;
  const theme = hourTheme(hour);
  const note = TOWER_VIEW_NOTES[view.id] ?? '';
  const last = TOWER_VIEWS.length - 1;

  // What the camera is actually shown, in priority order: flying overrides
  // everything (it is its own exterior framing), a selected unit overrides
  // the tour step (the same eased transition `CameraController` already
  // gives a step change), and otherwise the step itself.
  const activeView = flying
    ? FLYOVER_VIEW
    : selectedUnit
      ? unitFloorView(selectedUnit.floor)
      : view;

  /**
   * Stills capture, through the hook the gallery lightbox already reads.
   *
   * The residence path-traces inside `GalleryLightbox`; the tower has no
   * lightbox, so its plates are captured from the walkthrough itself on
   * whichever framing `?step=` selects. `window.__AURELIA_STILL_SAMPLES__`
   * is set by `scripts/brochure-stills.mjs` and by nothing else — a
   * visitor never has it — so this stays off in the live experience and
   * there is no capture-only route to drift away from what the site
   * actually renders.
   *
   * Read once on mount rather than watched: the capture script sets it
   * before the scene is built, and a value that appeared later would mean
   * re-tracing a frame mid-view for somebody who is only looking.
   */
  const [stillSamples, setStillSamples] = useState<number | undefined>(undefined);
  useEffect(() => setStillSamples(window.__AURELIA_STILL_SAMPLES__), []);
  const capturing = stillSamples !== undefined;

  /** Convergence, for the marker the capture script waits on. */
  const [converged, setConverged] = useState(0);
  const onCinematicProgress = useCallback((samples: number, maxSamples: number) => {
    setConverged(maxSamples > 0 ? Math.min(1, samples / maxSamples) : 0);
  }, []);

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
        view={activeView}
        mode={walking ? (flying ? 'cinematic' : 'walk') : 'fixed'}
        // Path-traced only while a capture is running — see the note above.
        {...(capturing
          ? {
              cinematic: true as const,
              cinematicMaxSamples: stillSamples,
              onCinematicProgress,
            }
          : {})}
        // A slow move on every held framing. Eighteen dead-still shots in
        // sequence is a slideshow; the parallax between near and far is what
        // tells the eye this is a place and not a picture of one. Off on
        // foot, where the visitor is doing the moving — and off in flight,
        // where `cinematic` mode's own orbit is already that movement.
        // Held perfectly still for a capture: drift is what makes a held
        // framing feel alive, and what would smear a forty-minute trace.
        drift={capturing || walking ? 0 : 1.6}
        content="tower"
        timeOfDay={hour}
        label={
          flying
            ? 'Three-dimensional aerial view, circling the oceanfront tower'
            : selectedUnit
              ? `Three-dimensional view of the oceanfront tower — Unit ${selectedUnit.id}`
              : `Three-dimensional view of the oceanfront tower — ${view.label}`
        }
      >
        {/* Convergence, and only while a capture is resolving.
            `scripts/brochure-stills.mjs` waits for this element to attach
            and then detach rather than capturing on a timer — its absence
            *is* the "traced" signal, so there is no separate done state to
            keep in sync. Never mounted for a visitor: `capturing` is false
            unless the stills hook was set before mount. */}
        {capturing && converged < 1 ? (
          <div
            data-cinematic-progress
            className="pointer-events-none absolute right-6 bottom-6 flex items-center gap-3"
          >
            <div className="bg-alabaster/20 h-px w-24 overflow-hidden">
              <div
                className="bg-gold h-px transition-[width] duration-300"
                style={{ width: `${Math.round(converged * 100)}%` }}
              />
            </div>
            <span className="text-eyebrow text-mist uppercase tabular-nums">Resolving</span>
          </div>
        ) : null}

        {/* Readability ground for the caption and the controls. Dropped in
            walk mode: a gradient over the bottom half of a first-person view
            is a gradient over the floor you are trying to walk on. */}
        {walking ? null : (
          <div
            aria-hidden="true"
            className="ease-luxe pointer-events-none absolute inset-x-0 bottom-0 h-[54%] transition-[background] duration-[1200ms]"
            style={scrim}
          />
        )}

        {/* The switch between the two ways of seeing the building: a set of
            composed framings, or the run of the place on foot. */}
        {webgl === false ? null : (
          // `top-24`, not `top-6`: the site header is fixed, 80px tall and
          // z-40, so at `top-6` this button sat inside its box and was
          // unclickable across its whole width — the header ate the pointer.
          <button
            type="button"
            onClick={() => setWalking((on) => !on)}
            className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold bg-obsidian/40 absolute top-24 right-6 z-20 inline-flex min-h-11 items-center border px-4 py-2.5 uppercase backdrop-blur-sm transition-colors duration-300"
          >
            {/* While on foot this button's only job is to leave walk mode —
                it does not start any automated camera movement, so it
                can't be labelled "Guided tour" without promising a
                flythrough that doesn't exist. "Overview" names the
                click-through, scene-card mode it actually returns to. */}
            {walking ? 'Overview' : 'Walk the building'}
          </button>
        )}

        {/* The second choice, once on foot: cross the plaza yourself, or
            pull back to a drone's height and glide the exterior instead.
            Nested under the first toggle rather than a third top-level
            option — it is the other way of moving through the building
            yourself, where the guided tour is composed for the visitor. */}
        {webgl === false || !walking ? null : (
          <button
            type="button"
            onClick={() => setFlying((on) => !on)}
            className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold bg-obsidian/40 absolute top-40 right-6 z-20 inline-flex min-h-11 items-center border px-4 py-2.5 uppercase backdrop-blur-sm transition-colors duration-300"
          >
            {flying ? 'Ground view' : 'Fly over'}
          </button>
        )}

        {/* The tour's own second choice, in the same slot the flyover toggle
            takes on foot — the two never show together, since one only
            appears walking and the other only composing. */}
        {webgl === false || walking ? null : (
          <button
            type="button"
            onClick={() => setShowInventory((on) => !on)}
            className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold bg-obsidian/40 absolute top-40 right-6 z-20 inline-flex min-h-11 items-center border px-4 py-2.5 uppercase backdrop-blur-sm transition-colors duration-300"
          >
            {showInventory ? 'Back to tour' : 'Inventory'}
          </button>
        )}

        {/* Thumb controls. Outside the canvas because a touch target inside a
            WebGL scene has to be raycast, and they write to the same shared
            input the controller already reads. Neither applies in flight —
            the orbit flies itself. */}
        <TouchSticks active={walking && !flying} />
        {/* The mouse half of the same job: sticks under a thumb, arrows under
            a cursor. Each renders only for its own kind of pointer. */}
        <WalkPad active={walking && !flying} />

        {/* What this frame responds to, in whichever mode it is in. The
            composed views mount no orbit controls, so the old "drag to look
            around · pinch to zoom" named two gestures the tower never
            answered. */}
        <ControlHint controls={controls} hidden={showInventory} />

        {/* The lift. Twenty storeys is four minutes of stairwell at walking
            pace, and nobody wants to see the stair twenty times to reach the
            top — so the stair is there to be walked and this is there to be
            used. It sets you down in the lift lobby of the floor you pick,
            which is where a lift leaves you. */}
        {walking && !flying && floors.length > 0 ? (
          /* Collapsible, because on a phone twenty storeys of buttons filled
             the screen: the list covered the building it was meant to move
             you through, and sat directly over the left thumb zone. It opens
             by default with a mouse, where there is room for it and no thumb
             to block. */
          <div className="absolute top-24 left-6 z-20 flex max-h-[52%] w-52 flex-col sm:max-h-[68%]">
            <button
              type="button"
              onClick={() => setLiftOpen((open) => !open)}
              aria-expanded={liftOpen}
              aria-controls="lift-floors"
              className="text-eyebrow text-mist/80 hover:text-alabaster bg-obsidian/60 flex shrink-0 items-center justify-between gap-2 px-3 py-2 uppercase backdrop-blur-sm transition-colors"
            >
              Take the lift
              <span aria-hidden="true">{liftOpen ? '−' : '+'}</span>
            </button>
            <ul
              id="lift-floors"
              hidden={!liftOpen}
              className="bg-obsidian/50 min-h-0 overflow-y-auto backdrop-blur-sm"
            >
              {[...floors].reverse().map((floor) => {
                const current = floor.id === floorId;
                return (
                  <li key={floor.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFloorId(floor.id);
                        travelTo(floor);
                      }}
                      className={cn(
                        'text-eyebrow ease-luxe block w-full px-3 py-2 text-left uppercase transition-colors duration-300',
                        current
                          ? 'text-gold bg-alabaster/10'
                          : 'text-mist hover:text-alabaster hover:bg-alabaster/5',
                      )}
                    >
                      {floor.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* The hour, down the left edge on a wide screen. */}
        {webgl === false || walking ? null : (
          <HourDial
            value={hour}
            onChange={setHour}
            className="absolute top-1/2 left-7 z-10 hidden -translate-y-1/2 lg:block xl:left-10"
          />
        )}

        {/* Step index down the right edge, doubling as navigation. Hidden
            with the inventory open too — a visitor choosing a unit from the
            list is not also stepping through the composed sequence. */}
        <nav
          aria-label="Walkthrough steps"
          hidden={walking || showInventory}
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

        {/* Caption and step controls, or the inventory in their place. Gone
            entirely on foot: on a phone this block plus the hour dial covers
            most of the frame, and none of it means anything when the camera
            is no longer on a numbered step. */}
        <div hidden={walking} className="px-gutter absolute inset-x-0 bottom-0 z-10 pb-6 lg:pb-10">
          <div className="max-w-wide mx-auto flex flex-col gap-4 lg:pl-[7.5rem]">
            {showInventory ? (
              <InventoryPanel
                activeFloor={selectedUnit?.floor ?? null}
                onSelect={(unit) => setSelectedUnit(unit)}
                className="max-w-[56ch]"
              />
            ) : (
              // The ambient bottom-of-frame scrim above is tuned for the
              // stage as a whole, and a bright, busy frame — the plaza at
              // Arrival, the palms at the Park — can still leave pale text
              // sitting directly on photographic detail. The same backdrop
              // `CinematicOverlay` gives its own chips (`bg-obsidian/40` plus
              // a blur) makes the caption legible regardless of what is
              // behind it, rather than depending on any one frame's tones.
              <div className="border-alabaster/10 bg-obsidian/40 max-w-[56ch] border px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
                <p className="text-eyebrow text-bone/70 flex items-center gap-4 uppercase">
                  <span className="text-gold tabular-nums">
                    {String(step + 1).padStart(2, '0')}
                  </span>
                  <span aria-hidden="true" className="bg-gold-dim h-px w-8" />
                  {view.label}
                </p>
                {/* aria-live so a screen-reader user hears the new caption
                    when the step changes — the canvas itself cannot say it. */}
                <p className="text-lede text-mist mt-3" aria-live="polite">
                  {note}
                </p>
              </div>
            )}

            {/* The other building, reachable from inside this one. Hidden on
                foot along with the rest of the tour chrome. */}
            <BuildingSwitch className="self-start" />

            {showInventory ? null : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => go(step - 1)}
                  disabled={step === 0}
                  className="text-eyebrow text-alabaster border-alabaster/30 hover:border-alabaster focus-visible:outline-gold ease-luxe inline-flex min-h-11 items-center rounded-full border px-5 py-2 uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => go(step + 1)}
                  disabled={step === last}
                  className="text-eyebrow text-obsidian bg-alabaster hover:bg-bone focus-visible:outline-gold ease-luxe inline-flex min-h-11 items-center rounded-full px-5 py-2 uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {step === last ? 'End of walkthrough' : 'Continue'}
                </button>
                <span className="text-eyebrow text-stone uppercase tabular-nums">
                  {step + 1} / {TOWER_VIEWS.length}
                </span>
              </div>
            )}

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
