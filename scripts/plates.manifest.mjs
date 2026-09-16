/**
 * Every framing worth a plate, and how each one is captured.
 *
 * ## Why this is its own file
 *
 * Three things need this list: the capture script, the test that checks it
 * names real framings, and a person deciding what still has to be
 * rendered. `brochure-stills.mjs` spawns a server the moment it is
 * imported, so it cannot be the home for a list anything else reads. This
 * file has no side effects and imports nothing.
 *
 * Plain `.mjs` rather than TypeScript because the capture script is plain
 * node — no loader, no build step between writing a plate and rendering it.
 *
 * ## The ids are not repeated from memory
 *
 * `space` values are `SPACES` entries in `lib/experience/spaces.ts`.
 * `view` values are `TOWER_VIEWS` entries in `lib/three/tower-views.ts`.
 * `tests/plates-manifest.test.ts` asserts every one of them exists, so a
 * space renamed on one side fails the suite rather than producing a run
 * that quietly skips a plate.
 */

/**
 * The residence. Captured through the gallery's own lightbox — the one
 * surface on the site that already path-traces — by clicking the tile a
 * visitor would click.
 *
 * Every space, not a chosen few. The building already decided which
 * framings are worth having; a hand-picked subset here would be a second
 * list to keep beside the first, which is how the gallery once came to
 * advertise a count it did not have.
 */
export const RESIDENCE_PLATES = [
  { space: 'arrival', file: 'arrival.jpg', caption: 'The residence from the approach' },
  { space: 'foyer', file: 'foyer.jpg', caption: 'Entrance foyer' },
  { space: 'living', file: 'living.jpg', caption: 'Living room' },
  { space: 'dining', file: 'dining.jpg', caption: 'Dining' },
  { space: 'kitchen', file: 'kitchen.jpg', caption: 'Kitchen' },
  { space: 'study', file: 'study.jpg', caption: 'Study' },
  { space: 'guest', file: 'guest.jpg', caption: 'Guest suite' },
  { space: 'stair', file: 'stair.jpg', caption: 'Stair hall' },
  { space: 'upperLounge', file: 'upper-lounge.jpg', caption: 'Upper lounge' },
  { space: 'master', file: 'master.jpg', caption: 'Master suite' },
  { space: 'dressing', file: 'dressing.jpg', caption: 'Dressing room' },
  { space: 'masterBath', file: 'master-bath.jpg', caption: 'Master bathroom' },
  { space: 'bedroom2', file: 'bedroom-two.jpg', caption: 'Second bedroom' },
  { space: 'library', file: 'library.jpg', caption: 'Library' },
  { space: 'terrace', file: 'terrace.jpg', caption: 'Terrace' },
  { space: 'pool', file: 'pool.jpg', caption: 'Infinity edge above the coast' },
  { space: 'lounge', file: 'lounge.jpg', caption: 'Sunken lounge' },
];

/**
 * The tower. Captured through the walkthrough itself, on the framing
 * `?step=` selects.
 *
 * The walkthrough path-traces only when the stills hook is present —
 * `window.__AURELIA_STILL_SAMPLES__`, the same signal the gallery lightbox
 * already reads. That hook is set by the capture script and by nothing
 * else, so a visitor never triggers a trace and no capture-only route
 * exists to drift away from what the site actually renders.
 *
 * `step` is 1-based and is the position in `TOWER_VIEWS`, which is how
 * `TowerWalkthrough` parses it. It is generated from the array below
 * rather than written down, for the reason `TowerViews` explains: an index
 * is a fragile thing to record and a safe thing to derive.
 */
export const TOWER_PLATES = [
  { view: 'arrival', file: 'tower-arrival.jpg', caption: 'The tower from the road' },
  { view: 'park', file: 'tower-park.jpg', caption: 'The park' },
  { view: 'colonnade', file: 'tower-colonnade.jpg', caption: 'Colonnade' },
  { view: 'atrium', file: 'tower-atrium.jpg', caption: 'Atrium' },
  { view: 'gallery', file: 'tower-gallery.jpg', caption: 'Upper gallery' },
  { view: 'foodHall', file: 'tower-food-hall.jpg', caption: 'Food hall' },
  { view: 'cinema', file: 'tower-cinema.jpg', caption: 'Cinema foyer' },
  { view: 'deck', file: 'tower-deck.jpg', caption: 'Pool deck' },
  { view: 'gym', file: 'tower-gym.jpg', caption: 'Gym' },
  { view: 'spa', file: 'tower-spa.jpg', caption: 'Spa' },
  { view: 'lobby', file: 'tower-lobby.jpg', caption: 'Lift lobby' },
  { view: 'residence', file: 'tower-residence.jpg', caption: 'Apartment living room' },
];

/** Where captured plates are written, relative to the repository root. */
export const OUT_DIR = 'public/assets/brochure';

/** Everything, in capture order: the residence first, then the tower. */
export const ALL_PLATES = [
  ...RESIDENCE_PLATES.map((p) => ({ ...p, building: 'residence' })),
  ...TOWER_PLATES.map((p) => ({ ...p, building: 'tower' })),
];
