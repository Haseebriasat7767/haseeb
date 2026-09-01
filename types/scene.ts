import type { Vector3Tuple } from 'three';

/** A named, reusable camera framing. Phase 2 animates between these. */
export type CameraView = {
  id: string;
  label: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
};

/** Camera behaviour modes the scene supports. */
export type CameraMode = 'orbit' | 'cinematic' | 'fixed';

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
