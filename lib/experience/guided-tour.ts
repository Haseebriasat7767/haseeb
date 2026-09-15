import { findSpace, type Space } from './spaces';
import type { TimeOfDay } from '@/types';

/**
 * The guided tour.
 *
 * ## What this is, and what it deliberately is not
 *
 * It is a *sequence*, not a system. Every step below names a space that
 * already exists in `SPACES` and, where the step is about the light rather
 * than the room, an hour that already exists in `TIME_OF_DAY`. Nothing here
 * carries a camera position, an easing curve or a duration: the explorer
 * already moves its camera by handing a framing to `CameraController`, and
 * the tour moves the camera by handing it the same framings in order. A
 * second camera path would be a second thing to keep in sync with the
 * building, and the building changes.
 *
 * So the whole feature is this list plus an overlay that reads it. A step
 * that needs a new vantage gets a new entry in `SPACES` — where the rail,
 * the gallery, the floor plan and the deep links will all pick it up too —
 * rather than a special case in here.
 *
 * ## Why the descriptions are not written here
 *
 * Each space already carries a one-line `feature` written against the
 * actual geometry. Restating it in the tour would be a second copy to drift
 * out of step with the model, and inventing a new line would be a claim
 * about a building nobody has surveyed. Steps therefore fall back to the
 * space's own `feature`, and only override it where the step is about
 * something the space cannot describe — the hour.
 */
export type GuidedTourStep = {
  id: string;
  /** Shown above the name. Falls back to the space's own eyebrow. */
  eyebrow?: string;
  /** The space framed at this step. Must exist in `SPACES`. */
  space: string;
  /**
   * The hour this step sets, for the two steps that are about the light.
   * Omitted on every other step, which leaves whatever the visitor chose
   * alone rather than yanking the sun back on each advance.
   */
  timeOfDay?: TimeOfDay;
  /** Overrides the space's own `feature` where the step is not about the room. */
  description?: string;
};

export const GUIDED_TOUR: readonly GuidedTourStep[] = [
  { id: 'arrival', space: 'arrival' },
  { id: 'entrance', space: 'foyer' },
  { id: 'living', space: 'living' },
  { id: 'master', space: 'master' },
  { id: 'terrace', space: 'terrace' },
  { id: 'pool', space: 'pool' },
  {
    id: 'golden-hour',
    space: 'terrace',
    timeOfDay: 'goldenHour',
    eyebrow: 'The hour',
    description: 'The same residence at golden hour — see it change with the light.',
  },
  {
    id: 'night',
    space: 'pool',
    timeOfDay: 'night',
    eyebrow: 'The hour',
    description: 'After dark the building lights from within, and the pool carries the edge.',
  },
];

/** What the overlay needs to draw one step, with the space already resolved. */
export type ResolvedTourStep = {
  step: GuidedTourStep;
  space: Space;
  eyebrow: string;
  name: string;
  description: string;
  /** One-based, for `03 / 08`. */
  position: number;
  total: number;
};

/**
 * Resolves a step index against the spaces that actually exist.
 *
 * Returns `null` rather than throwing for an index out of range or a step
 * naming a space that has since been removed — the caller treats that as
 * "leave the tour" instead of taking the page down with it. A tour is a
 * presentation layer; nothing in it is worth a white screen.
 */
export function resolveTourStep(index: number): ResolvedTourStep | null {
  const step = GUIDED_TOUR[index];
  if (!step) return null;

  const space = findSpace(step.space);
  if (!space) return null;

  return {
    step,
    space,
    eyebrow: step.eyebrow ?? space.eyebrow,
    name: space.name,
    description: step.description ?? space.feature,
    position: index + 1,
    total: GUIDED_TOUR.length,
  };
}

export const GUIDED_TOUR_LENGTH = GUIDED_TOUR.length;
