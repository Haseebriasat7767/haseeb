import type { Vector3Tuple } from 'three';

/** A named, reusable camera framing. Phase 2 animates between these. */
export type CameraView = {
  id: string;
  label: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
};

/**
 * The architectural lighting states the scene can be presented in. Golden
 * hour is the hero; see `lib/three/lighting.ts` for what each one composes.
 */
export type TimeOfDay = 'morning' | 'day' | 'goldenHour' | 'blueHour' | 'night';

/** Camera behaviour modes the scene supports. */
export type CameraMode = 'orbit' | 'cinematic' | 'fixed';

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
