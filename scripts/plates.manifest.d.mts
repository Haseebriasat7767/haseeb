/**
 * Types for the capture manifest.
 *
 * The manifest itself is plain `.mjs` so the capture script can import it
 * with no loader; this is what lets the test read it with the same
 * strictness as the rest of the codebase.
 */
export type ResidencePlate = { space: string; file: string; caption: string };
export type TowerPlate = { view: string; file: string; caption: string };
export type AnyPlate = (ResidencePlate | TowerPlate) & {
  building: 'residence' | 'tower';
  file: string;
  caption: string;
};

export declare const RESIDENCE_PLATES: readonly ResidencePlate[];
export declare const TOWER_PLATES: readonly TowerPlate[];
export declare const ALL_PLATES: readonly AnyPlate[];
export declare const OUT_DIR: string;
