import { TOWER_CONFIG, createTowerLayout } from '@/components/three/tower/TowerGeometry';

/**
 * Figures counted from the tower's own geometry.
 *
 * ## Why this module exists at all
 *
 * The residence learned this the expensive way: its interior area read
 * 1,120 m² for most of the project's life against a room schedule totalling
 * 840, because the number was typed once and the plan moved afterwards.
 * `lib/property/schedule.ts` fixed that by counting the same model the 3D
 * scene is generated from. This is the tower's half of the same idea, and
 * it exists before the tower has a chance to acquire its own 1,120.
 *
 * ## Why importing the geometry here is safe
 *
 * `createTowerLayout` looks like a 3D import and is not one. Its whole
 * dependency chain — `StairGeometry`, `VillaTypes`, `walk-floors`,
 * `TowerTypes` — reaches three.js only through `import type`, which the
 * compiler erases. The function is arithmetic that returns plain objects,
 * so a server component can call it for nothing.
 *
 * That is a property worth stating because it is easy to lose. Anything in
 * `components/three/tower/` that touches `DecalMaps` — `MallShops`, and so
 * the sixteen retail tenancies — imports three at runtime and would drag
 * the renderer into whatever imported it. That is why no tenancy count
 * appears below: the figure is real and knowable, and it is not worth a
 * megabyte to print it.
 */

/** Retail levels plus residential levels. The crown is not a storey. */
export function storeyCount(): number {
  return TOWER_CONFIG.podiumLevels + TOWER_CONFIG.towerLevels;
}

export function retailLevelCount(): number {
  return TOWER_CONFIG.podiumLevels;
}

/**
 * Apartments, which is not the same as residential levels.
 *
 * Level 0 of the tower is the amenity floor — the gym, the spa and the way
 * out onto the deck — so the flats start at 1. `TowerScene` filters the
 * plates by exactly this rule before it fits any of them out, so counting
 * it the same way here is counting the apartments that were actually built.
 */
export function apartmentCount(): number {
  return createTowerLayout().residentialPlates.filter((plate) => plate.level > 0).length;
}

/** Every floor the escape stair serves and the lift picker offers. */
export function walkableFloorCount(): number {
  return createTowerLayout().walkFloors.length;
}

/** Plaza to the top of the crown, in metres. */
export function buildingHeight(): number {
  return createTowerLayout().plan.crownTopY;
}

/** Podium roof, and so the level the amenity deck and its pool sit at. */
export function deckHeight(): number {
  return createTowerLayout().plan.podiumTopY;
}

/**
 * The glazed floor plate of the fitted apartment, in metres.
 *
 * The tower steps in twice above this level, so the top three plates are
 * smaller — this is the typical plate rather than the only one, which is
 * what a floor plate figure means on a drawing.
 */
export function typicalPlate(): { width: number; depth: number; area: number } {
  const layout = createTowerLayout();
  const plate =
    layout.residentialPlates.find((entry) => entry.level === layout.plan.furnishedLevel) ??
    layout.residentialPlates[layout.residentialPlates.length - 1];
  if (!plate) throw new Error('the tower layout produced no residential plates');
  const width = Math.round(plate.x[1] - plate.x[0]);
  const depth = Math.round(plate.z[1] - plate.z[0]);
  return { width, depth, area: width * depth };
}

/** The pool on the amenity deck, in metres. */
export function poolSize(): { length: number; width: number } {
  return { length: TOWER_CONFIG.poolLength, width: TOWER_CONFIG.poolWidth };
}

export type TowerFigure = {
  label: string;
  value: string;
  note: string;
};

/**
 * The specification as the page prints it. Every value is a call, not a
 * literal — the same contract `PROPERTY.specification` keeps for the
 * residence, and the reason `tests/tower-figures.test.ts` can pin it.
 */
export function towerSpecification(): TowerFigure[] {
  const plate = typicalPlate();
  const pool = poolSize();

  return [
    {
      label: 'Storeys',
      value: String(storeyCount()),
      note: `${retailLevelCount()} of retail, ${TOWER_CONFIG.towerLevels} above`,
    },
    { label: 'Height', value: `${buildingHeight()} m`, note: 'Plaza to the top of the crown' },
    {
      label: 'Residences',
      value: String(apartmentCount()),
      note: 'One apartment to each floor',
    },
    {
      label: 'Retail levels',
      value: String(retailLevelCount()),
      note: 'Around a full-height atrium',
    },
    { label: 'Amenity deck', value: `${deckHeight()} m`, note: 'On the podium roof' },
    {
      label: 'Floor plate',
      value: `${plate.width} × ${plate.depth} m`,
      note: `${plate.area} m² inside the core`,
    },
    { label: 'Pool', value: `${pool.length} × ${pool.width} m`, note: 'Set back from the edge' },
    {
      label: 'Walkable floors',
      value: String(walkableFloorCount()),
      note: 'Every floor the lift serves',
    },
  ];
}
