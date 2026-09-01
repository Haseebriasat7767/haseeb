import type { CameraView, QualityProfile, QualityTier } from '@/types';

/**
 * Named camera framings for the residence. Phase 2 tweens between these
 * for the cinematic tour; the orbit camera uses HOME as its origin.
 */
export const CAMERA_VIEWS: readonly CameraView[] = [
  {
    id: 'approach',
    label: 'Approach',
    position: [26, 10, 30],
    target: [0, 3, 0],
    fov: 32,
  },
  {
    id: 'elevation',
    label: 'Elevation',
    position: [36, 5, 2],
    target: [0, 3.5, 0],
    fov: 26,
  },
  {
    id: 'aerial',
    label: 'Aerial',
    position: [14, 28, 24],
    target: [0, 0, 0],
    fov: 38,
  },
] as const;

export const DEFAULT_VIEW: CameraView = CAMERA_VIEWS[0]!;

/** Lighting rig constants — one key sun, soft fill, warm bounce. */
export const LIGHTING = {
  sunPosition: [12, 18, 8] as const,
  sunIntensity: 2.1,
  sunColor: '#fff6e8',
  ambientIntensity: 0.35,
  ambientColor: '#8fa4bd',
  bounceIntensity: 0.6,
  bounceColor: '#b99a63',
  fogColor: '#0a0a0b',
  fogNear: 46,
  fogFar: 135,
} as const;

/** Ground and placeholder-massing dimensions (metres). */
export const SITE_GEOMETRY = {
  groundSize: 120,
  block: { width: 14, height: 6, depth: 9 },
  wing: { width: 7, height: 3.4, depth: 6 },
  podium: { width: 22, height: 0.5, depth: 16 },
} as const;

const PROFILES: Record<QualityTier, QualityProfile> = {
  low: { tier: 'low', dpr: [1, 1], shadows: false, shadowMapSize: 512, antialias: false },
  medium: { tier: 'medium', dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, antialias: true },
  high: { tier: 'high', dpr: [1, 2], shadows: true, shadowMapSize: 2048, antialias: true },
};

export function getQualityProfile(tier: QualityTier): QualityProfile {
  return PROFILES[tier];
}
