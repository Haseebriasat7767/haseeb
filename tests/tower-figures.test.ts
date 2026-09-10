import { describe, expect, it } from 'vitest';
import { TOWER_CONFIG, createTowerLayout } from '@/components/three/tower/TowerGeometry';
import { TOWER_VIEWS } from '@/lib/three/tower-views';
import {
  apartmentCount,
  buildingHeight,
  deckHeight,
  poolSize,
  retailLevelCount,
  storeyCount,
  towerSpecification,
  typicalPlate,
  walkableFloorCount,
} from '@/lib/property/tower';

/**
 * The tower's published figures against the tower's own geometry.
 *
 * The residence's equivalent exists because a number went wrong and stayed
 * wrong: 1,120 m² printed against plans totalling 840. This one exists
 * because the tower page is about to start printing figures for the first
 * time, and the cheapest moment to make a number un-driftable is before
 * anybody has had the chance to type it.
 *
 * Nothing below asserts a literal that the module could also be reading —
 * each check re-derives the figure from `TOWER_CONFIG` or from
 * `createTowerLayout()` by a different route than the module takes, so a
 * change to the building fails here with the number to publish.
 */

/** Reads '80 m', '29 × 22 m' and the like back to their leading number. */
const figure = (label: string): string => {
  const entry = towerSpecification().find((item) => item.label === label);
  if (!entry) throw new Error(`no tower specification entry labelled ${label}`);
  return entry.value;
};

describe('tower figures', () => {
  it('counts storeys as the podium plus the tower, and not the crown', () => {
    expect(storeyCount()).toBe(TOWER_CONFIG.podiumLevels + TOWER_CONFIG.towerLevels);
    expect(figure('Storeys')).toBe('20');
  });

  it('counts apartments as the residential plates above the amenity floor', () => {
    // The scene fits out exactly these plates — see the filter in
    // `TowerScene`. One fewer than the residential level count, because
    // level 0 is the gym, the spa and the way onto the deck.
    expect(apartmentCount()).toBe(TOWER_CONFIG.towerLevels - 1);
    expect(apartmentCount()).toBe(14);
    expect(figure('Residences')).toBe('14');
  });

  it('reads the height and the deck level off the built layout', () => {
    const plan = createTowerLayout().plan;
    expect(buildingHeight()).toBe(plan.crownTopY);
    expect(deckHeight()).toBe(plan.podiumTopY);
    expect(figure('Height')).toBe(`${plan.crownTopY} m`);
    expect(figure('Amenity deck')).toBe(`${plan.podiumTopY} m`);
  });

  it('measures the floor plate on the fitted level, inside the core', () => {
    const layout = createTowerLayout();
    const fitted = layout.residentialPlates.find(
      (plate) => plate.level === layout.plan.furnishedLevel,
    );
    expect(fitted).toBeDefined();
    const plate = typicalPlate();
    expect(plate.width).toBe(Math.round(fitted!.x[1] - fitted!.x[0]));
    expect(plate.depth).toBe(Math.round(fitted!.z[1] - fitted!.z[0]));
    // The glazed plate stops at the service blade, so it is narrower than
    // the tower envelope by the core. If these ever match, the core is gone.
    expect(plate.width).toBeLessThan(TOWER_CONFIG.towerWidth);
    expect(figure('Floor plate')).toBe(`${plate.width} × ${plate.depth} m`);
  });

  it('takes the retail levels and the pool from the config the model is built from', () => {
    expect(retailLevelCount()).toBe(TOWER_CONFIG.podiumLevels);
    expect(poolSize()).toEqual({
      length: TOWER_CONFIG.poolLength,
      width: TOWER_CONFIG.poolWidth,
    });
    expect(figure('Pool')).toBe(`${TOWER_CONFIG.poolLength} × ${TOWER_CONFIG.poolWidth} m`);
  });

  it('offers exactly the floors the lift picker is built from', () => {
    expect(walkableFloorCount()).toBe(createTowerLayout().walkFloors.length);
    // Every retail level plus every residential one, the amenity floor
    // included — the picker cannot offer a floor the building lacks.
    expect(walkableFloorCount()).toBe(TOWER_CONFIG.podiumLevels + TOWER_CONFIG.towerLevels);
  });

  it('prints no figure the geometry does not produce', () => {
    for (const entry of towerSpecification()) {
      expect(entry.value).not.toBe('');
      expect(entry.value).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});

/**
 * The deep links the page renders point at `/tower?step=N`, which is a
 * 1-based index into `TOWER_VIEWS` — not the residence's `?space=<id>`.
 * An index is only safe while it is generated from the array it indexes,
 * so this pins the contract the page's links depend on.
 */
describe('tower view deep links', () => {
  it('accepts 1-based indices across the whole view list', () => {
    expect(TOWER_VIEWS.length).toBeGreaterThan(0);
    // `TowerWalkthrough` accepts `step >= 1 && step <= TOWER_VIEWS.length`
    // and subtracts one. Both ends have to resolve to a real view.
    expect(TOWER_VIEWS[1 - 1]).toBeDefined();
    expect(TOWER_VIEWS[TOWER_VIEWS.length - 1]).toBeDefined();
  });

  it('gives every view a unique id and a label to link with', () => {
    const ids = TOWER_VIEWS.map((view) => view.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const view of TOWER_VIEWS) expect(view.label.length).toBeGreaterThan(0);
  });
});
