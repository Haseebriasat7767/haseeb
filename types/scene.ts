import type { Vector3Tuple } from 'three';

/** A named, reusable camera framing. Phase 2 animates between these. */
export type CameraView = {
  id: string;
  label: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
  /**
   * Exposure compensation for this framing, in stops.
   *
   * A real camera is set for its subject, not for the scene. Standing
   * outside a house at golden hour and standing inside one are two
   * different exposures — perhaps two stops apart — and a photographer
   * changes the setting rather than accepting a silhouette or a blown
   * facade. The hour's own exposure in `lib/three/lighting.ts` is set for
   * the exterior, which is the shot it was composed for; an interior
   * framing opens up from there, and its windows blow out, which is what an
   * interior photograph actually looks like.
   *
   * Absent means no compensation.
   */
  exposure?: number;
};

/**
 * The architectural lighting states the scene can be presented in. Golden
 * hour is the hero; see `lib/three/lighting.ts` for what each one composes.
 */
export type TimeOfDay = 'morning' | 'day' | 'goldenHour' | 'blueHour' | 'night';

/**
 * Camera behaviour modes the scene supports. `journey` is the scroll-driven
 * mode: it tweens position, target, and focal length between named views.
 */
export type CameraMode = 'orbit' | 'cinematic' | 'fixed' | 'journey';

/** Which building the Canvas renders. */
export type SceneContent = 'villa' | 'placeholder';

/** Rendering tier resolved from device capability, not user agent alone. */
export type QualityTier = 'low' | 'medium' | 'high';

export type QualityProfile = {
  tier: QualityTier;
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
};

export type SceneStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
