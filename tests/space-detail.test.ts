import { describe, expect, it } from 'vitest';
import { createFloorPlanModel } from '@/lib/experience/floorplan';
import { PALETTE } from '@/lib/experience/palette';
import { allMappedFinishes, spaceArea, spaceFinishes } from '@/lib/experience/space-detail';
import { SPACES, findSpace } from '@/lib/experience/spaces';

/**
 * Guards the two claims the space summary makes about the building.
 *
 * Both are the kind that go wrong silently: an area typed next to a model
 * that has since changed, and a material named for a room the schedule
 * never put it in. The project already lost a figure that way once — see
 * the note in `lib/property/schedule.ts` — so these are asserted against
 * the generator rather than reviewed by eye.
 */

describe('space area', () => {
  it('matches the area the plan schedule prints for the same room', () => {
    const rooms = new Map(
      createFloorPlanModel()
        .levels.flatMap((level) => level.rooms)
        .map((room) => [room.id, Math.round(room.width * room.height)]),
    );

    for (const space of SPACES) {
      if (!space.room) continue;
      expect(spaceArea(space), `area for ${space.id}`).toBe(rooms.get(space.room));
    }
  });

  it('reports no area for a space that is not a room in the plan', () => {
    // The approach, the terrace and the pool are outside the interior plan.
    // An estimate here would be an invented dimension.
    const outside = SPACES.filter((space) => !space.room);
    expect(outside.length).toBeGreaterThan(0);
    for (const space of outside) {
      expect(spaceArea(space), `${space.id} should have no area`).toBeNull();
    }
  });

  it('never reports a non-positive area', () => {
    for (const space of SPACES) {
      const area = spaceArea(space);
      if (area !== null) expect(area, `area for ${space.id}`).toBeGreaterThan(0);
    }
  });
});

describe('space finishes', () => {
  it('only names finishes that exist in the material palette', () => {
    const known = new Set(PALETTE.map((finish) => finish.name));
    for (const name of allMappedFinishes()) {
      expect(known, `"${name}" is not in PALETTE`).toContain(name);
    }
  });

  it('only maps finishes onto spaces that exist', () => {
    // A finish list keyed to a space id that has been renamed would render
    // nothing, silently, on the space it was meant to describe.
    for (const space of SPACES) {
      expect(() => spaceFinishes(space)).not.toThrow();
    }
    const withFinishes = SPACES.filter((space) => spaceFinishes(space).length > 0);
    expect(withFinishes.length).toBeGreaterThan(0);
  });

  it('lists no finish twice for one space', () => {
    for (const space of SPACES) {
      const finishes = spaceFinishes(space);
      expect(new Set(finishes).size, `duplicate finish on ${space.id}`).toBe(finishes.length);
    }
  });

  it('returns an empty list rather than throwing for an unknown space', () => {
    const unknown = { ...SPACES[0]!, id: 'not-a-space' };
    expect(spaceFinishes(unknown)).toEqual([]);
  });
});

describe('floor plan to space mapping', () => {
  it('resolves every plan room that names a space', () => {
    const planRooms = new Set(
      createFloorPlanModel()
        .levels.flatMap((level) => level.rooms)
        .map((room) => room.id),
    );

    for (const space of SPACES) {
      if (!space.room) continue;
      expect(planRooms, `${space.id} points at a room the plan does not draw`).toContain(
        space.room,
      );
    }
  });

  it('fails safely for an id that is not a space', () => {
    expect(findSpace('nope')).toBeUndefined();
    expect(findSpace('')).toBeUndefined();
  });

  it('maps each plan room to at most one space', () => {
    const seen = new Map<string, string>();
    for (const space of SPACES) {
      if (!space.room) continue;
      expect(seen.has(space.room), `${space.room} claimed by two spaces`).toBe(false);
      seen.set(space.room, space.id);
    }
  });
});
