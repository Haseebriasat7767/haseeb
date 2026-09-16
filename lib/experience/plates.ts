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
 * A framing with neither shows the tile's typographic device. Nothing here
 * ever points at a file that does not exist: `tests/plates.test.ts` reads
 * `public/` and fails if a path below is missing, which is the only way a
 * manifest like this stays true as plates are added a few at a time.
 *
 * ## Why a plate is keyed by building as well as id
 *
 * The two buildings name framings independently, and they already
 * collide: `arrival` is the residence's approach and also the tower's
 * view from the road. Keyed by id alone, the tower's first tile would
 * quietly show the villa. The building is therefore part of the key
 * everywhere, and `plateFor` takes both.
 *
 * ## These are renders, and the site says so
 *
 * Not photographs, and never described as any. The residence is conceptual;
 * a plate is a frame of the model it is generated from, finished to the
 * standard a developer's marketing render is finished to. The gallery's own
 * standfirst carries that sentence, and it stays.
 */

export type PlateGrade = 'photoreal' | 'traced';

/** Which building's framing list `space` indexes into. */
export type PlateBuilding = 'residence' | 'tower';

export type Plate = {
  /** A `SPACES` id for the residence, a `TOWER_VIEWS` id for the tower. */
  space: string;
  building: PlateBuilding;
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
    building: 'residence',
    src: '/assets/brochure/arrival.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
  {
    space: 'living',
    building: 'residence',
    src: '/assets/brochure/living.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
  {
    space: 'pool',
    building: 'residence',
    src: '/assets/brochure/pool.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
  {
    space: 'master',
    building: 'residence',
    src: '/assets/brochure/master.jpg',
    grade: 'traced',
    width: 3840,
    height: 2160,
  },
];

/** `building:id`, because the two buildings' ids overlap. */
function key(building: PlateBuilding, space: string): string {
  return `${building}:${space}`;
}

const BY_FRAMING: ReadonlyMap<string, Plate> = (() => {
  const map = new Map<string, Plate>();
  for (const plate of PLATES) {
    const id = key(plate.building, plate.space);
    const existing = map.get(id);
    // A finished plate always wins, whichever order the rows are written in.
    if (!existing || (existing.grade === 'traced' && plate.grade === 'photoreal')) {
      map.set(id, plate);
    }
  }
  return map;
})();

/** The best plate for one building's framing, or `null` when it has none. */
export function plateFor(building: PlateBuilding, space: string): Plate | null {
  return BY_FRAMING.get(key(building, space)) ?? null;
}

/** How many framings have a plate, and how many of those are finished. */
export function plateCoverage(building?: PlateBuilding): { total: number; photoreal: number } {
  const plates = [...BY_FRAMING.values()].filter(
    (plate) => building === undefined || plate.building === building,
  );
  return {
    total: plates.length,
    photoreal: plates.filter((plate) => plate.grade === 'photoreal').length,
  };
}
