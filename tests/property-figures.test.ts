import { describe, expect, it } from 'vitest';
import { PROPERTY } from '@/lib/constants/site';
import {
  bathroomCount,
  bedroomCount,
  interiorArea,
  interiorAreaExact,
  levelCount,
  roomCount,
} from '@/lib/property/schedule';

/**
 * The published figures against the residence's own room schedule.
 *
 * These exist because one of them was wrong for most of the project. The
 * headline interior area read 1,120 m² while the plans totalled 840, a gap
 * of 280 — and every one of those plans is on the site with its area
 * printed on it, so the arithmetic was there for any buyer or agent to do.
 *
 * `site.ts` cannot import the schedule: client components import it, and
 * the schedule reaches the villa's geometry. So the numbers are written by
 * hand there and pinned here instead. Move a partition and this fails with
 * the figure to publish.
 */

/** Reads '840 m²' and the like back to a number. */
const figure = (label: string): number => {
  const entry = PROPERTY.specification.find((item) => item.label === label);
  if (!entry) throw new Error(`no specification entry labelled ${label}`);
  return Number(entry.value.replace(/[^\d.]/g, ''));
};

describe('published figures match the room schedule', () => {
  it('interior area', () => {
    expect(figure('Interior')).toBe(interiorArea());
  });

  it('the headline stat agrees with the specification', () => {
    // Two lists, one building. They drifted apart once already.
    const stat = PROPERTY.stats.find((item) => item.label === 'Interior');
    expect(stat?.value).toBe(
      PROPERTY.specification.find((item) => item.label === 'Interior')?.value,
    );
  });

  it.each([
    ['Rooms', roomCount],
    ['Bedrooms', bedroomCount],
    ['Bathrooms', bathroomCount],
    ['Levels', levelCount],
  ])('%s', (label, compute) => {
    expect(figure(label)).toBe(compute());
  });
});

describe('the total is the one a reader can reproduce', () => {
  it('sums the rounded room figures, not the rounded exact total', () => {
    // The plans print each room to the nearest square metre. Somebody
    // checking the headline adds up what is printed, so the headline has to
    // be that sum — rounding the exact total instead lands two metres low
    // and makes the page look like it does not add up.
    expect(interiorArea()).toBe(840);
    expect(Math.round(interiorAreaExact())).toBe(836);
    expect(interiorArea()).not.toBe(Math.round(interiorAreaExact()));
  });
});

describe('every figure claiming to be derived can be', () => {
  it('has a counterpart in the schedule', () => {
    const derived = PROPERTY.specification.filter((item) => item.derived).map((i) => i.label);
    // Interior joined this set; the others were already in it.
    expect(derived).toEqual(
      expect.arrayContaining(['Levels', 'Rooms', 'Bedrooms', 'Bathrooms', 'Interior']),
    );
  });
});
