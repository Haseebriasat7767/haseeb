import { describe, expect, it } from 'vitest';
import { ALL_TARGETS, spaceIds, towerSpaceIds } from '@/scripts/lib/pano-spaces.mjs';
import { panoReachableSpaces } from '@/lib/pano/hotspots';
import { ROOM_SPACES, SPACES } from '@/lib/experience/spaces';
import { TOWER_VIEWS } from '@/lib/three/tower-views';

/**
 * The render job is `.mjs` so it stays out of the app's type graph, which
 * means the list of rooms to render exists twice. This is what stops the
 * copies from drifting — and a drifted list means a room is silently never
 * rendered, which looks exactly like a room that is simply still queued.
 */
describe('panorama render list', () => {
  it('matches the rooms the navigation graph can reach', () => {
    expect([...spaceIds]).toEqual(panoReachableSpaces().map((space) => space.id));
  });

  it('excludes the site spaces, which have no interior to stand in', () => {
    for (const id of ['arrival', 'terrace', 'pool', 'lounge']) {
      expect(SPACES.some((space) => space.id === id)).toBe(true);
      expect(spaceIds).not.toContain(id);
    }
  });

  it('names only real room spaces', () => {
    const rooms = new Set(ROOM_SPACES.map((space) => space.id));
    for (const id of spaceIds) expect(rooms.has(id)).toBe(true);
  });

  it('is the multiplier the render budget is quoted against', () => {
    // 13 rooms x 6 faces = 78 renders. The earlier figure of 174 came from
    // the brochure plate manifest, which is a different artifact.
    expect(spaceIds.length).toBe(13);
    expect(spaceIds.length * 6).toBe(78);
  });
});

describe('tower render list', () => {
  it('names only real tower framings', () => {
    const known = new Set(TOWER_VIEWS.map((view) => view.id));
    for (const id of towerSpaceIds) expect(known.has(id)).toBe(true);
  });

  it('is the enclosed interiors, identified by their exposure compensation', () => {
    // An interior framing opens up for the room; an exterior one does not.
    // That flag is what distinguishes the two in TOWER_VIEWS, so the render
    // list is checked against it rather than against a remembered list.
    const interiors = TOWER_VIEWS.filter((view) => view.exposure !== undefined).map((v) => v.id);
    for (const id of interiors) expect(towerSpaceIds).toContain(id);
  });

  it('adds the balcony, the one standpoint on the building that is not enclosed', () => {
    // A balcony is part of the apartment and worth standing in, but it is
    // open to the sky, so it carries no interior exposure compensation and
    // the rule above does not reach it. Included deliberately, named here
    // so it cannot be mistaken for the rule leaking.
    const balcony = TOWER_VIEWS.find((view) => view.id === 'balcony');
    expect(balcony?.exposure).toBeUndefined();
    expect(towerSpaceIds).toContain('balcony');

    const interiors = TOWER_VIEWS.filter((view) => view.exposure !== undefined).map((v) => v.id);
    expect(towerSpaceIds.length).toBe(interiors.length + 1);
  });

  it('excludes every exterior framing', () => {
    for (const id of ['arrival', 'park', 'colonnade', 'deck', 'elevation', 'aerial']) {
      expect(TOWER_VIEWS.some((view) => view.id === id)).toBe(true);
      expect(towerSpaceIds).not.toContain(id);
    }
  });

  it('collides with the residence on id, which is why the cache key carries the building', () => {
    // Both buildings have a kitchen. Keying panoramas on the bare id would
    // serve one building's room from the other's faces.
    const shared = towerSpaceIds.filter((id) => spaceIds.includes(id));
    expect(shared.length).toBeGreaterThan(0);
  });

  it('tags every target with its building', () => {
    expect(ALL_TARGETS).toHaveLength(spaceIds.length + towerSpaceIds.length);
    expect(new Set(ALL_TARGETS.map((t) => `${t.building}:${t.id}`)).size).toBe(ALL_TARGETS.length);
  });
});
