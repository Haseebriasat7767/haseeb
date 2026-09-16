/**
 * The rendered plates — the photography the residence does not have.
 *
 * ## Two grades, and why both exist
 *
 * `photoreal` is a plate that has been through the finishing pass: the
 * path-traced frame with real material detail resolved onto it. It is what
 * a buyer should see first.
 *
 * `traced` is the raw path-traced frame straight out of `scripts/
 * brochure-stills.mjs`. It is honest, it is the actual model, and it is a
 * long way short of the finished grade — but it beats a blank card, so a
 * space that has one and no finished plate still shows something real.
 *
 * A space with neither shows the gallery's typographic tile. Nothing here
 * ever points at a file that does not exist: `tests/plates.test.ts` reads
 * `public/` and fails if a path below is missing, which is the only way a
 * manifest like this stays true as plates are added a few at a time.
 *
 * ## These are renders, and the site says so
 *
 * Not photographs, and never described as any. The residence is conceptual;
 * a plate is a frame of the model it is generated from, finished to the
 * standard a developer's marketing render is finished to. The gallery's own
 * standfirst carries that sentence, and it stays.
 */

export type PlateGrade = 'photoreal' | 'traced';

export type Plate = {
  /** The `SPACES` entry this plate frames. */
  space: string;
  src: string;
  grade: PlateGrade;
  /** Intrinsic size, so the layout reserves the right box before it loads. */
  width: number;
  height: number;
};

/**
 * Every plate that currently exists on disk.
 *
 * Add a row when a file lands in `public/assets/`. The four below are the
 * path-traced brochure frames, which predate the finishing pass — as
 * photoreal plates are produced they are added at `photoreal` and the
 * `traced` row for the same space is replaced rather than kept alongside.
 */
export const PLATES: readonly Plate[] = [
  {
    space: 'arrival',
    src: '/assets/brochure/arrival.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
  {
    space: 'living',
    src: '/assets/brochure/living.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
  { space: 'pool', src: '/assets/brochure/pool.jpg', grade: 'traced', width: 3840, height: 2160 },
  {
    space: 'master',
    src: '/assets/brochure/master.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
];

const BY_SPACE: ReadonlyMap<string, Plate> = (() => {
  const map = new Map<string, Plate>();
  for (const plate of PLATES) {
    const existing = map.get(plate.space);
    // A finished plate always wins, whichever order the rows are written in.
    if (!existing || (existing.grade === 'traced' && plate.grade === 'photoreal')) {
      map.set(plate.space, plate);
    }
  }
  return map;
})();

/** The best plate for a space, or `null` when it has none yet. */
export function plateFor(space: string): Plate | null {
  return BY_SPACE.get(space) ?? null;
}

/** How many spaces have a plate, and how many of those are finished. */
export function plateCoverage(): { total: number; photoreal: number } {
  const plates = [...BY_SPACE.values()];
  return {
    total: plates.length,
    photoreal: plates.filter((plate) => plate.grade === 'photoreal').length,
  };
}
