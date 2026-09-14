import { TOWER_CONFIG, createTowerLayout } from '@/components/three/tower/TowerGeometry';
import { TOWER_VIEWS } from '@/lib/three/tower-views';
import type { CameraView } from '@/types';

/**
 * The tower's units, one to a floor — matching the note `towerSpecification`
 * already prints ("One apartment to each floor").
 *
 * ## Why this lives here and not in `components/three/tower/`
 *
 * Same reasoning as `lib/property/tower.ts`: `createTowerLayout` is
 * arithmetic that returns plain objects, not a three.js import, so a page
 * that only wants the unit list pays nothing for the renderer.
 *
 * ## The mock data
 *
 * Bed count, bath count and sale status are not read from anywhere — there
 * is no unit-level source yet, so this is a placeholder. What *is* real is
 * the floor count and the floor area, both taken from `residentialPlates`,
 * so a taller or wider tower changes the inventory with it rather than
 * leaving it printing figures for a building that no longer exists. Swap
 * `mockDetails` for a real fetch and every consumer of `towerInventory`
 * keeps working unchanged — the shape of `Unit` is the contract, not this
 * function's body.
 */
export type UnitStatus = 'Available' | 'Reserved' | 'Sold';

export type Unit = {
  /** e.g. "1A" — floor 1, the only unit on it. */
  id: string;
  /** Matches `WalkFloor`'s tower ids (`tower-${floor}`) and the lift picker's own numbering. */
  floor: number;
  beds: number;
  baths: number;
  sqft: number;
  status: UnitStatus;
};

const SQM_TO_SQFT = 10.7639;

/** Deterministic, not random — the same floor prints the same mock unit on
 *  every render, server and client alike. */
function mockDetails(floor: number): { beds: number; baths: number; status: UnitStatus } {
  const tier = floor % 3;
  const beds = tier === 0 ? 2 : tier === 1 ? 3 : 4;
  const baths = tier === 2 ? 3 : 2;
  const status: UnitStatus = floor % 5 === 0 ? 'Sold' : floor % 4 === 0 ? 'Reserved' : 'Available';
  return { beds, baths, status };
}

/** Every residential floor's plate, fitted out with a mock unit. */
export function towerInventory(): Unit[] {
  return createTowerLayout()
    .residentialPlates.filter((plate) => plate.level > 0)
    .map((plate) => {
      const width = plate.x[1] - plate.x[0];
      const depth = plate.z[1] - plate.z[0];
      const { beds, baths, status } = mockDetails(plate.level);
      return {
        id: `${plate.level}A`,
        floor: plate.level,
        beds,
        baths,
        sqft: Math.round(width * depth * SQM_TO_SQFT),
        status,
      };
    });
}

/**
 * The camera used by the fitted apartment (`TOWER_VIEWS`'s `residence`
 * entry), shifted to another floor's height.
 *
 * Reuses that framing's position and target rather than composing a new
 * one — every apartment on the tower shares the same plan, so the same
 * corner-of-the-room shot the fitted floor was composed for reads
 * correctly at any height. Only the real, geometry-derived vertical offset
 * between the two floors' slabs changes.
 */
export function unitFloorView(floor: number): CameraView {
  const base = TOWER_VIEWS.find((entry) => entry.id === 'residence');
  const layout = createTowerLayout();
  const reference = layout.residentialPlates.find(
    (plate) => plate.level === TOWER_CONFIG.furnishedLevel,
  );
  const target = layout.residentialPlates.find((plate) => plate.level === floor);
  if (!base || !reference || !target) return TOWER_VIEWS[0]!;

  const dy = target.floorY - reference.floorY;
  return {
    ...base,
    id: `unit-floor-${floor}`,
    label: `Floor ${floor}`,
    position: [base.position[0], base.position[1] + dy, base.position[2]],
    target: [base.target[0], base.target[1] + dy, base.target[2]],
  };
}
