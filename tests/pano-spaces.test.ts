import { describe, expect, it } from 'vitest';
import { spaceIds } from '@/scripts/lib/pano-spaces.mjs';
import { panoReachableSpaces } from '@/lib/pano/hotspots';
import { ROOM_SPACES, SPACES } from '@/lib/experience/spaces';

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
