import { PROPERTY } from '@/lib/constants/site';
import {
  bathroomCount,
  bedroomCount,
  interiorArea,
  levelCount,
  roomCount,
} from '@/lib/property/schedule';

/**
 * The brochure's figures, counted rather than typed.
 *
 * The PDF is the one place a figure can go stale without anybody noticing:
 * nobody re-reads a downloaded document against the site. So the derived
 * entries here are computed from the same room schedule the 3D model is
 * generated from, and the asserted ones (grounds, pool, elevation — things
 * no plan can count) are read straight out of `PROPERTY.specification`
 * rather than retyped. Nothing in this file is a literal figure.
 *
 * `tests/brochure-figures.test.ts` asserts both halves against their
 * sources, so a partition moved in `InteriorPlan.ts` fails CI instead of
 * shipping a brochure that disagrees with the page it was downloaded from.
 */
export type BrochureFigure = {
  label: string;
  value: string;
  note: string;
};

/** Figures the schedule can count, keyed by their specification label. */
const COUNTED: Record<string, () => string> = {
  Levels: () => String(levelCount()),
  Rooms: () => String(roomCount()),
  Bedrooms: () => String(bedroomCount()),
  Bathrooms: () => String(bathroomCount()),
  Interior: () => `${interiorArea()} m²`,
};

/**
 * The specification as the brochure prints it — the site's own list, with
 * every countable value replaced by the count.
 *
 * Iterating `PROPERTY.specification` rather than naming the rows means a
 * row added to the site appears in the brochure too, instead of the two
 * silently diverging in length.
 */
export function brochureFigures(): BrochureFigure[] {
  return PROPERTY.specification.map((entry) => {
    const counted = entry.derived ? COUNTED[entry.label] : undefined;
    return {
      label: entry.label,
      value: counted ? counted() : entry.value,
      note: entry.note,
    };
  });
}
