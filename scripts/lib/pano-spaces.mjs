/**
 * The rooms the panorama job renders.
 *
 * A runtime mirror of `panoReachableSpaces()` in `lib/pano/hotspots.ts`,
 * which the `.mjs` scripts cannot import. It is not a second opinion:
 * `tests/pano-spaces.test.ts` asserts the two agree, and a room added to
 * `SPACES` or disconnected by a wall change fails that test rather than
 * silently going unrendered.
 *
 * Why this list and not `SPACES`: the four site spaces (arrival, terrace,
 * pool, lounge) are exterior, and a space with no edges in the navigation
 * graph would produce a panorama nothing can navigate to.
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
