import type { CameraView, QualityProfile, QualityTier } from '@/types';

/**
 * Named framings of the residence, sized to the procedural villa. A later
 * phase tweens between these for the cinematic tour; the orbit camera uses
 * the first entry as its origin.
 */
export const CAMERA_VIEWS: readonly CameraView[] = [
  {
    id: 'approach',
    label: 'Approach',
    position: [36, 13, 44],
    target: [0, 4, 0],
    fov: 30,
  },
  {
    id: 'front',
    label: 'Front',
    position: [0, 9, 58],
    target: [0, 4.5, 0],
    fov: 28,
  },
  {
    id: 'elevation',
    label: 'Elevation',
    position: [58, 9, 8],
    target: [0, 4.5, 0],
    fov: 26,
  },
  {
    id: 'rear',
    label: 'Rear',
    position: [-26, 12, -48],
    target: [0, 4, 0],
    fov: 30,
  },
  {
    id: 'aerial',
    label: 'Aerial',
    position: [30, 44, 42],
    target: [0, 2, 0],
    fov: 34,
  },
] as const;

/**
 * Framings from inside the residence. These are the same `CameraView`
 * objects the exterior list uses and feed the same `CameraController` — the
 * only difference is that they sit inside the building, so they are meant
 * for the `fixed` camera mode rather than the orbit rig, whose minimum
 * distance deliberately keeps the exterior model in frame. They are kept
 * out of `CAMERA_VIEWS` so the public explore page still lists approaches
 * to the house rather than rooms within it.
 */
/**
 * Every interior framing opens up by the same amount.
 *
 * Just over one stop, arrived at from the rendered frames rather than
 * from theory: at the hour's own setting the principal rooms came out two
 * stops under, reading as brown and muddy, while their windows sat at a
 * comfortable mid grey — which is the exact signature of a camera exposed
 * for the view rather than for the room. Opening up puts the walls where
 * they belong and lets the glazing go bright, which is what an interior
 * photograph does.
 */
const INTERIOR_EXPOSURE = 1.05;

export const INTERIOR_VIEWS: readonly CameraView[] = [
  {
    id: 'foyer',
    label: 'Foyer',
    position: [-6, 2.6, 2.7],
    target: [-6.2, 2.1, -3.4],
    fov: 58,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'living',
    label: 'Living room',
    position: [3.6, 2.4, -3.0],
    target: [9.6, 1.5, 3.6],
    fov: 52,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    position: [-3.4, 2.3, 1.6],
    target: [1.4, 1.6, -7.4],
    fov: 58,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'stair',
    label: 'Stair hall',
    position: [-6.0, 2.3, -1.4],
    target: [-6.4, 3.4, -8.4],
    fov: 58,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'master',
    label: 'Master suite',
    position: [-8.4, 6.8, -0.8],
    target: [-12.6, 6.1, -5.2],
    fov: 56,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'library',
    label: 'Library',
    position: [13.8, 6.6, 7.2],
    target: [5.2, 5.9, -3.2],
    fov: 56,
    exposure: INTERIOR_EXPOSURE,
  },
] as const;

export const DEFAULT_VIEW: CameraView = CAMERA_VIEWS[0]!;

/** Terrain and placeholder-massing dimensions (metres). */
export const SITE_GEOMETRY = {
  groundSize: 240,
  block: { width: 14, height: 6, depth: 9 },
  wing: { width: 7, height: 3.4, depth: 6 },
  podium: { width: 22, height: 0.5, depth: 16 },
} as const;

/**
 * The high tier carries a 4096 map because the cinematic key sits low: a
 * thirteen-degree sun needs a wide shadow frustum to hold its own long
 * shadows, and at 2048 that spread visibly stair-stepped the parapet edges
 * from the aerial view. Medium and low are unchanged — the artifact only
 * exists where the premium shadows do.
 */
const PROFILES: Record<QualityTier, QualityProfile> = {
  low: { tier: 'low', dpr: [1, 1], shadows: false, shadowMapSize: 512, antialias: false },
  medium: { tier: 'medium', dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, antialias: true },
  high: { tier: 'high', dpr: [1, 2], shadows: true, shadowMapSize: 4096, antialias: true },
};

export function getQualityProfile(tier: QualityTier): QualityProfile {
  return PROFILES[tier];
}
