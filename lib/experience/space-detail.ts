import { createFloorPlanModel } from './floorplan';
import { PALETTE } from './palette';
import type { Space } from './spaces';

/**
 * What can be said about a space without inventing anything.
 *
 * ## Area
 *
 * Measured, not written. Every room outline in the plan carries its extent
 * in metres because it was projected from the same schedule the 3D model
 * is built from, so the area is `width × height` rounded the same way the
 * schedule beside the drawing rounds it. Move a partition in
 * `InteriorPlan.ts` and this number moves with it. A hand-typed figure
 * here would be the exact drift `tests/property-figures.test.ts` exists to
 * catch — see the note in `lib/property/schedule.ts`.
 *
 * Spaces without a `room` — the approach, the terrace, the pool — have no
 * outline in the interior plan and therefore no area. They return `null`
 * rather than an estimate.
 *
 * ## Finishes
 *
 * Drawn from `PALETTE`, which is a schedule of the materials the renderer
 * actually uses. The mapping below only names a finish for a space where
 * the finish's own `where` already says it is there: `Dark timber` lists
 * "bedroom floors", so the bedrooms carry it; `Book-matched marble` lists
 * "Island, vanities", so the kitchen and the bathrooms carry it. Nothing
 * here introduces a material, a location or a specification that the
 * palette does not already state — and
 * `tests/space-detail.test.ts` fails if a name drifts out of `PALETTE`.
 */

/** Finish names, constrained to what the palette actually contains. */
export type FinishName = (typeof PALETTE)[number]['name'];

/**
 * Which of the six finishes each space reads as, per the palette's own
 * `where`. Spaces absent from this map simply show no palette — an empty
 * heading would be worse than none.
 */
const SPACE_FINISHES: Readonly<Record<string, readonly FinishName[]>> = {
  foyer: ['Honed limestone', 'Fair-faced concrete', 'Architectural glazing'],
  living: ['Honed limestone', 'Fair-faced concrete', 'Architectural glazing', 'Bronze'],
  dining: ['Honed limestone', 'Architectural glazing'],
  kitchen: ['Book-matched marble', 'Dark timber', 'Honed limestone'],
  study: ['Dark timber', 'Honed limestone'],
  guest: ['Dark timber', 'Honed limestone'],
  stair: ['Fair-faced concrete', 'Bronze', 'Honed limestone'],
  upperLounge: ['Honed limestone', 'Architectural glazing', 'Bronze'],
  master: ['Dark timber', 'Bronze', 'Architectural glazing'],
  dressing: ['Dark timber', 'Bronze'],
  masterBath: ['Book-matched marble', 'Bronze'],
  bedroom2: ['Dark timber', 'Honed limestone'],
  library: ['Dark timber', 'Bronze'],
  terrace: ['Honed limestone', 'Fair-faced concrete'],
  pool: ['Honed limestone'],
  lounge: ['Honed limestone', 'Fair-faced concrete'],
  arrival: ['Honed limestone', 'Fair-faced concrete', 'Dark timber'],
};

/** Room areas, keyed by the plan's own room id. Built once. */
let areaByRoom: Map<string, number> | null = null;

function areas(): Map<string, number> {
  areaByRoom ??= new Map(
    createFloorPlanModel()
      .levels.flatMap((level) => level.rooms)
      .map((room) => [room.id, Math.round(room.width * room.height)]),
  );
  return areaByRoom;
}

/**
 * The measured area of a space in whole square metres, or `null` where the
 * space is not a room in the interior plan.
 */
export function spaceArea(space: Space): number | null {
  if (!space.room) return null;
  return areas().get(space.room) ?? null;
}

/** The finishes this space reads as, or an empty list. */
export function spaceFinishes(space: Space): readonly FinishName[] {
  return SPACE_FINISHES[space.id] ?? [];
}

/** Every finish name this module claims, for the test that guards drift. */
export function allMappedFinishes(): readonly string[] {
  return Object.values(SPACE_FINISHES).flat();
}
