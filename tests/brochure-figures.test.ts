import { describe, expect, it } from 'vitest';

import { CLIENT } from '@/lib/constants/client';
import { PROPERTY } from '@/lib/constants/site';
import { brochureFigures } from '@/lib/property/brochure';
import {
  bathroomCount,
  bedroomCount,
  interiorArea,
  levelCount,
  roomCount,
} from '@/lib/property/schedule';

/**
 * The brochure is the one artefact that leaves the site and stops being
 * corrected by it: nobody re-reads a downloaded PDF against the page. So
 * every figure it prints is asserted here against the source it claims to
 * come from — the counted ones against the room schedule, the asserted
 * ones against the site's own specification.
 */
const figure = (label: string): string => {
  const entry = brochureFigures().find((item) => item.label === label);
  if (!entry) throw new Error(`the brochure prints no figure labelled ${label}`);
  return entry.value;
};

describe('brochure figures', () => {
  it('counts the derived figures from the room schedule', () => {
    expect(figure('Levels')).toBe(String(levelCount()));
    expect(figure('Rooms')).toBe(String(roomCount()));
    expect(figure('Bedrooms')).toBe(String(bedroomCount()));
    expect(figure('Bathrooms')).toBe(String(bathroomCount()));
    expect(figure('Interior')).toBe(`${interiorArea()} m²`);
  });

  it('agrees with the specification the site itself renders', () => {
    for (const entry of PROPERTY.specification) {
      expect(figure(entry.label)).toBe(entry.value);
    }
  });

  it('prints every row the site prints, in the same order', () => {
    expect(brochureFigures().map((item) => item.label)).toEqual(
      PROPERTY.specification.map((item) => item.label),
    );
  });

  it('is reachable from the download button', () => {
    expect(CLIENT.brochurePath).toBe('/brochure');
  });
});
