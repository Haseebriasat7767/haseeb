import { createFloorPlanModel } from '@/lib/experience/floorplan';

/**
 * Figures counted from the residence's own room schedule.
 *
 * ## Why this is not imported into `lib/constants/site.ts`
 *
 * It would be the obvious place, and it is the wrong one. `site.ts` is
 * imported by client components — the mobile menu, the enquiry form, the
 * loading screen — so anything it imports is shipped to the browser.
 * Reaching the schedule means reaching the villa's plan generator, and
 * that would put the building's geometry into the shared bundle to print
 * one number.
 *
 * So the constants stay plain and this module is the arbiter. `tests/
 * property-figures.test.ts` asserts the two agree, which means a partition
 * moved in `InteriorPlan.ts` fails CI with the new number rather than
 * quietly leaving the published figure wrong. Same guarantee as computing
 * it at render, no bundle cost.
 */

/**
 * Total floor area, in square metres, as the sum of the ROUNDED room
 * figures rather than the rounded sum of the exact ones.
 *
 * Those differ, and the difference is the whole point. The plans print each
 * room to the nearest square metre, so somebody checking the headline
 * against the schedule adds up what is printed: 21 rounded numbers. Round
 * the exact total instead and it lands two metres lower than the figures on
 * the page, and the page appears not to add up. What is displayed has to
 * reconcile with what is displayed.
 */
export function interiorArea(): number {
  return createFloorPlanModel()
    .levels.flatMap((level) => level.rooms)
    .reduce((total, room) => total + Math.round(room.width * room.height), 0);
}

/** Exact total, unrounded. Used by the tests to show the two apart. */
export function interiorAreaExact(): number {
  return createFloorPlanModel()
    .levels.flatMap((level) => level.rooms)
    .reduce((total, room) => total + room.width * room.height, 0);
}

/** Every enclosed space on the plans, circulation included. */
export function roomCount(): number {
  return createFloorPlanModel().levels.reduce((n, level) => n + level.rooms.length, 0);
}

export function levelCount(): number {
  return createFloorPlanModel().levels.length;
}

/** Counted by label, which is how the schedule names them. */
export function bedroomCount(): number {
  return createFloorPlanModel()
    .levels.flatMap((level) => level.rooms)
    .filter((room) => /bedroom/i.test(room.label)).length;
}

export function bathroomCount(): number {
  return createFloorPlanModel()
    .levels.flatMap((level) => level.rooms)
    .filter((room) => /bathroom/i.test(room.label)).length;
}
