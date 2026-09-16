/**
 * The spaces the panorama job renders, per building.
 *
 * Runtime mirrors of lists the `.mjs` scripts cannot import.
 * `tests/pano-spaces.test.ts` asserts both against their sources, so a room
 * added or disconnected fails that test rather than silently going
 * unrendered.
 *
 * **Residence** — the rooms `panoReachableSpaces()` returns. Not `SPACES`:
 * the four site spaces (arrival, terrace, pool, lounge) are exterior, and a
 * space with no edges in the navigation graph would be a panorama nothing
 * can navigate to.
 *
 * **Tower** — the interior framings from `TOWER_VIEWS`. The tower has no
 * generated room schedule, so there are no retained doorways and therefore
 * no navigation graph: these are standpoints, not a connected tour. The six
 * exterior framings (arrival, park, colonnade, deck, elevation, aerial) are
 * excluded — a cubemap of the outdoors is what the real-time scene already
 * does better, live.
 */
export const spaceIds = [
  'foyer',
  'living',
  'dining',
  'kitchen',
  'study',
  'guest',
  'stair',
  'upperLounge',
  'master',
  'dressing',
  'masterBath',
  'bedroom2',
  'library',
];

export const towerSpaceIds = [
  'atrium',
  'gallery',
  'foodHall',
  'cinema',
  'gym',
  'spa',
  'lobby',
  'residence',
  'bedroom',
  'kitchen',
  'bathroom',
  'balcony',
];

/** Every render target, tagged with its building. */
export const ALL_TARGETS = [
  ...spaceIds.map((id) => ({ building: 'residence', id })),
  ...towerSpaceIds.map((id) => ({ building: 'tower', id })),
];
