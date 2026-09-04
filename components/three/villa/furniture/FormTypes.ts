import type { Vector3Tuple } from 'three';

/**
 * Which material a form is made of.
 *
 * Named rather than passed as an object because forms are authored inside
 * pure layout functions that have no business touching the material cache —
 * the same separation `Parts` already keeps for box specs. `FormRenderer`
 * resolves these to real materials at mount.
 */
export type FormMaterial =
  | 'joinery'
  | 'wood'
  | 'upholstery'
  | 'upholsteryDark'
  | 'marble'
  | 'stone'
  | 'bronze'
  | 'darkMetal'
  | 'frameMetal'
  | 'ceramic'
  | 'rug'
  | 'drapery'
  | 'sheer'
  | 'glow'
  | 'plaster'
  | 'paper'
  | 'glazing'
  | 'indoorFoliage';

type FormBase = {
  key: string;
  material: FormMaterial;
  /** Centre of the form, in world metres. */
  position: Vector3Tuple;
  /** Rotation about the vertical, in radians. */
  rotationY?: number;
  /** Tilt about the form's own X axis, applied before the yaw. */
  tiltX?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/** A rounded solid — cushions, carcasses, mattresses, arms, table tops. */
export type SoftForm = FormBase & {
  kind: 'soft';
  size: Vector3Tuple;
  radius: number;
  detail?: number;
  sag?: number;
  crease?: number;
  seed?: number;
  taper?: number;
};

/** A turned solid — lamp bases, shades, vessels, pots, pedestals. */
export type TurnedForm = FormBase & {
  kind: 'turned';
  /** `[radius, height]` pairs, bottom to top, relative to `position`. */
  profile: readonly (readonly [number, number])[];
  segments?: number;
};

/** A hanging fabric panel that falls in folds. */
export type FoldForm = FormBase & {
  kind: 'fold';
  width: number;
  height: number;
  depth: number;
  pleats: number;
  rows?: number;
  seed?: number;
};

export type Form = SoftForm | TurnedForm | FoldForm;
