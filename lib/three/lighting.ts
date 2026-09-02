import type { QualityTier, TimeOfDay } from '@/types';
import type { Vector3Tuple } from 'three';

/**
 * The key light. Direction is authored as elevation and azimuth rather than
 * a position vector, because "a low sun raking across the front elevation"
 * is an architectural decision and a bare `[26, 34, 18]` is not — and
 * because the shadow frustum has to be sized from the elevation to avoid
 * clipping the long shadows that make golden hour work.
 */
export type SunSetting = {
  /** Degrees above the horizon. Low values give long architectural shadows. */
  elevation: number;
  /** Degrees clockwise from due +Z, which is the front elevation. */
  azimuth: number;
  intensity: number;
  color: string;
  /** Half-width of the orthographic shadow frustum, in metres. */
  shadowExtent: number;
  shadowBias: number;
  shadowNormalBias: number;
};

/** Sky and ground hemisphere fill — the ambient term, with a direction. */
export type SkySetting = {
  skyColor: string;
  groundColor: string;
  intensity: number;
};

/**
 * The architectural bounce: one shadowless directional standing in for
 * light returned off paving, water, and the plinth. Aimed relative to the
 * sun so it always fills the shaded side, whatever the hour.
 */
export type BounceSetting = {
  /** Degrees of azimuth added to the sun's — 180 puts it directly opposite. */
  azimuthOffset: number;
  elevation: number;
  intensity: number;
  color: string;
};

export type AtmosphereSetting = {
  /** Canvas clear colour. Kept in step with the fog so silhouettes read. */
  background: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  /** Tone-mapping exposure, applied to the existing ACES pipeline. */
  exposure: number;
};

/** How a family of practical fixtures behaves at this hour. */
export type PracticalSetting = {
  /** Base candela the layout's own relative weights are multiplied by. */
  intensity: number;
  /** How many of the ranked practical lights are worth mounting at all. */
  activeLights: number;
};

/** Material responses that belong to the hour rather than to the surface. */
export type SurfaceSetting = {
  /** Glazing opacity — lower after dark so lit rooms read through the glass. */
  glazingOpacity: number;
  /**
   * Submerged pool lighting, carried by the water body. Kept low on
   * purpose: a pool that outlines itself is a nightclub, and a pool that
   * glows faintly from within is a house.
   */
  poolGlow: number;
  /**
   * Emissive strength of every lit fixture face, inside and out. One value,
   * because they are one shared material — a fixture is either switched on
   * at this hour or it is not.
   */
  fixtureEmissive: number;
};

export type LightingState = {
  id: TimeOfDay;
  label: string;
  sun: SunSetting;
  sky: SkySetting;
  bounce: BounceSetting;
  atmosphere: AtmosphereSetting;
  interior: PracticalSetting;
  exterior: PracticalSetting;
  surfaces: SurfaceSetting;
};

/**
 * How far out the key light sits. Only its direction matters to a
 * directional light; the distance exists so the shadow camera has somewhere
 * to stand.
 */
const SUN_DISTANCE = 90;

/**
 * Five deterministic architectural lighting states. They are not a
 * continuous sun curve: each is a composed photograph, tuned for what the
 * building should say at that hour, which is why colour temperature,
 * contrast, and which fixtures are switched on all move together.
 */
export const TIME_OF_DAY: Record<TimeOfDay, LightingState> = {
  morning: {
    id: 'morning',
    label: 'Morning',
    sun: {
      elevation: 22,
      azimuth: 118,
      intensity: 2.2,
      color: '#ffe9cf',
      shadowExtent: 52,
      shadowBias: -0.0005,
      shadowNormalBias: 0.05,
    },
    sky: { skyColor: '#a8bcd6', groundColor: '#171a1e', intensity: 0.58 },
    bounce: { azimuthOffset: 168, elevation: 16, intensity: 0.5, color: '#8296b2' },
    atmosphere: {
      background: '#10131a',
      fogColor: '#141922',
      fogNear: 80,
      fogFar: 250,
      exposure: 1.02,
    },
    interior: { intensity: 12, activeLights: 3 },
    exterior: { intensity: 0, activeLights: 0 },
    surfaces: { glazingOpacity: 0.6, poolGlow: 0.02, fixtureEmissive: 0.5 },
  },

  day: {
    id: 'day',
    label: 'Day',
    sun: {
      elevation: 47,
      azimuth: 55,
      intensity: 2.7,
      color: '#fff6e8',
      shadowExtent: 42,
      shadowBias: -0.0004,
      shadowNormalBias: 0.05,
    },
    sky: { skyColor: '#8fa4bd', groundColor: '#101216', intensity: 0.52 },
    bounce: { azimuthOffset: 170, elevation: 14, intensity: 0.55, color: '#b99a63' },
    atmosphere: {
      background: '#0d0f12',
      fogColor: '#11141a',
      fogNear: 90,
      fogFar: 260,
      exposure: 1.0,
    },
    interior: { intensity: 8, activeLights: 2 },
    exterior: { intensity: 0, activeLights: 0 },
    surfaces: { glazingOpacity: 0.62, poolGlow: 0, fixtureEmissive: 0.25 },
  },

  /**
   * The hero state. Everything here is doing one job: modelling the
   * building. An eleven-degree sun rakes the front elevation instead of
   * flooding it, so every reveal, fin, and overhang casts; the colour is
   * warm without being orange; and the interiors come up just far enough to
   * register as inhabited behind the glazing.
   */
  goldenHour: {
    id: 'goldenHour',
    label: 'Golden hour',
    sun: {
      elevation: 13,
      azimuth: 74,
      intensity: 3.4,
      color: '#ffcf9a',
      shadowExtent: 54,
      shadowBias: -0.0005,
      shadowNormalBias: 0.075,
    },
    sky: { skyColor: '#86a0c0', groundColor: '#2a1f17', intensity: 0.58 },
    bounce: { azimuthOffset: 172, elevation: 20, intensity: 0.72, color: '#7d8aa8' },
    atmosphere: {
      background: '#14100e',
      fogColor: '#1c1512',
      fogNear: 78,
      fogFar: 235,
      exposure: 1.08,
    },
    interior: { intensity: 26, activeLights: 5 },
    exterior: { intensity: 22, activeLights: 1 },
    surfaces: { glazingOpacity: 0.55, poolGlow: 0.07, fixtureEmissive: 1.1 },
  },

  blueHour: {
    id: 'blueHour',
    label: 'Blue hour',
    sun: {
      elevation: 3,
      azimuth: 104,
      intensity: 0.5,
      color: '#bcaec6',
      shadowExtent: 54,
      shadowBias: -0.0006,
      shadowNormalBias: 0.08,
    },
    sky: { skyColor: '#4d6285', groundColor: '#0b0d14', intensity: 0.52 },
    bounce: { azimuthOffset: 170, elevation: 26, intensity: 0.34, color: '#41577a' },
    atmosphere: {
      background: '#090c14',
      fogColor: '#0d1220',
      fogNear: 60,
      fogFar: 190,
      exposure: 1.12,
    },
    interior: { intensity: 46, activeLights: 7 },
    exterior: { intensity: 42, activeLights: 3 },
    surfaces: { glazingOpacity: 0.46, poolGlow: 0.17, fixtureEmissive: 2.0 },
  },

  night: {
    id: 'night',
    label: 'Night',
    // A high, cool, very weak key standing in for moonlight. It still casts,
    // because losing every shadow is what makes a night scene read as an
    // unlit model rather than a dark building.
    sun: {
      elevation: 40,
      azimuth: 252,
      intensity: 0.24,
      color: '#9db3d2',
      shadowExtent: 50,
      shadowBias: -0.0005,
      shadowNormalBias: 0.05,
    },
    sky: { skyColor: '#26334a', groundColor: '#05070b', intensity: 0.3 },
    bounce: { azimuthOffset: 170, elevation: 24, intensity: 0.16, color: '#1d2739' },
    atmosphere: {
      background: '#04060a',
      fogColor: '#060910',
      fogNear: 50,
      fogFar: 165,
      exposure: 1.18,
    },
    interior: { intensity: 52, activeLights: 7 },
    exterior: { intensity: 50, activeLights: 3 },
    surfaces: { glazingOpacity: 0.4, poolGlow: 0.24, fixtureEmissive: 2.4 },
  },
};

/** Golden hour is the presentation default — the hero architectural photograph. */
export const DEFAULT_TIME_OF_DAY: TimeOfDay = 'goldenHour';

/** Ordered for UI and validation, darkest-to-brightest is not the point — the day is. */
export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = [
  'morning',
  'day',
  'goldenHour',
  'blueHour',
  'night',
];

/**
 * What each rendering tier can afford of the lighting above. This is the
 * same `QualityTier` every other system keys off — the villa, site,
 * landscape, and interior all carry a tier map of their own — not a second
 * quality system.
 *
 * Only the genuinely expensive things scale: the number of dynamic lights
 * (each one is another iteration in every lit fragment's shader) and the
 * shadow frustum. Colour, exposure, fog, and the emissive fixtures are free
 * and identical everywhere, so a low-tier device still gets the same
 * photograph, just with fewer practical lights carrying it.
 */
type LightingTier = {
  interiorLights: number;
  exteriorLights: number;
  shadowExtentScale: number;
};

const LIGHTING_TIERS: Record<QualityTier, LightingTier> = {
  low: { interiorLights: 0, exteriorLights: 0, shadowExtentScale: 0.8 },
  medium: { interiorLights: 3, exteriorLights: 1, shadowExtentScale: 0.9 },
  high: { interiorLights: 7, exteriorLights: 3, shadowExtentScale: 1 },
};

const RADIANS = Math.PI / 180;

/** Direction expressed as elevation/azimuth, resolved to a world position. */
function polarToPosition(elevation: number, azimuth: number, distance: number): Vector3Tuple {
  const el = elevation * RADIANS;
  const az = azimuth * RADIANS;
  const horizontal = Math.cos(el) * distance;
  return [horizontal * Math.sin(az), Math.sin(el) * distance, horizontal * Math.cos(az)];
}

/** A lighting state with every derived value the renderer actually needs. */
export type ResolvedLighting = LightingState & {
  tier: QualityTier;
  sunPosition: Vector3Tuple;
  bouncePosition: Vector3Tuple;
  /** Shadow frustum half-width after the tier has had its say. */
  shadowExtent: number;
  shadowFar: number;
  /** Practical lights actually mounted, after both the hour and the tier. */
  interiorLightCount: number;
  exteriorLightCount: number;
};

/**
 * Resolves an hour and a rendering tier into the complete lighting rig.
 * Pure and deterministic — the same pair always produces the same result,
 * so callers can memoise it and nothing here animates or randomises.
 */
export function resolveLighting(
  timeOfDay: TimeOfDay = DEFAULT_TIME_OF_DAY,
  tier: QualityTier = 'high',
): ResolvedLighting {
  const state = TIME_OF_DAY[timeOfDay];
  const limits = LIGHTING_TIERS[tier];
  const shadowExtent = state.sun.shadowExtent * limits.shadowExtentScale;

  return {
    ...state,
    tier,
    sunPosition: polarToPosition(state.sun.elevation, state.sun.azimuth, SUN_DISTANCE),
    bouncePosition: polarToPosition(
      state.bounce.elevation,
      state.sun.azimuth + state.bounce.azimuthOffset,
      SUN_DISTANCE,
    ),
    shadowExtent,
    // Far enough to enclose the sun's stand-off plus the frustum itself, so
    // a low sun never clips the far end of its own long shadows.
    shadowFar: SUN_DISTANCE + shadowExtent * 2,
    interiorLightCount: Math.min(limits.interiorLights, state.interior.activeLights),
    exteriorLightCount: Math.min(limits.exteriorLights, state.exterior.activeLights),
  };
}
