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
  /** Clear colour behind the sky dome, and the fallback if it fails. */
  background: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  /** Tone-mapping exposure, applied to the existing ACES pipeline. */
  exposure: number;
};

/**
 * Parameters of the analytic daylight model that generates the sky — and,
 * baked through a PMREM pass, the scene's environment map.
 *
 * This is what an HDRI would otherwise provide: real reflections in the
 * glazing and the metals, sky colour behind the building, and image-based
 * ambient light. Generating it means it costs no download, and it follows
 * the hour instead of being fixed to whenever the photograph was taken.
 */
export type SkyModel = {
  /** Haze. Low is a clear alpine morning; high is a hot coastal afternoon. */
  turbidity: number;
  /** Rayleigh scattering — how blue the sky reads away from the sun. */
  rayleigh: number;
  /** Mie scattering strength: the size of the haze disc around the sun. */
  mieCoefficient: number;
  /** Mie directionality: how tightly that disc hugs the sun. */
  mieDirectionalG: number;
  /**
   * Elevation of the sun *in the sky*, which is not always the key light's.
   * At night the key is a high moon while the sky's sun sits below the
   * horizon, and only this separation makes a dark sky with cast shadows
   * possible at all.
   */
  elevation: number;
  /** Strength of the baked environment map as ambient illumination. */
  environmentIntensity: number;
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
  skyModel: SkyModel;
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
      intensity: 2.6,
      color: '#ffe9cf',
      shadowExtent: 52,
      shadowBias: -0.0005,
      shadowNormalBias: 0.05,
    },
    skyModel: {
      turbidity: 4.5,
      rayleigh: 2.4,
      mieCoefficient: 0.006,
      mieDirectionalG: 0.82,
      elevation: 14,
      environmentIntensity: 0.5,
    },
    sky: { skyColor: '#bcccdd', groundColor: '#3c4030', intensity: 0.12 },
    bounce: { azimuthOffset: 168, elevation: 16, intensity: 0.12, color: '#8296b2' },
    atmosphere: {
      background: '#8ea4bc',
      fogColor: '#a5b8cc',
      fogNear: 110,
      fogFar: 330,
      exposure: 0.44,
    },
    interior: { intensity: 7, activeLights: 3 },
    exterior: { intensity: 0, activeLights: 0 },
    surfaces: { glazingOpacity: 0.6, poolGlow: 0.02, fixtureEmissive: 0.5 },
  },

  day: {
    id: 'day',
    label: 'Day',
    sun: {
      elevation: 47,
      azimuth: 55,
      intensity: 3.1,
      color: '#fff6e8',
      shadowExtent: 42,
      shadowBias: -0.0004,
      shadowNormalBias: 0.05,
    },
    skyModel: {
      turbidity: 3.2,
      rayleigh: 1.8,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      elevation: 42,
      environmentIntensity: 0.55,
    },
    sky: { skyColor: '#c2d3e4', groundColor: '#3f4433', intensity: 0.1 },
    bounce: { azimuthOffset: 170, elevation: 14, intensity: 0.14, color: '#b99a63' },
    atmosphere: {
      background: '#9db4cd',
      fogColor: '#b3c6d9',
      fogNear: 130,
      fogFar: 360,
      exposure: 0.4,
    },
    interior: { intensity: 4, activeLights: 2 },
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
      intensity: 3.6,
      color: '#ffcf9a',
      shadowExtent: 54,
      shadowBias: -0.0005,
      shadowNormalBias: 0.075,
    },
    skyModel: {
      // Haze-forward rather than scattering-forward. A physically neutral
      // golden hour is only golden in the sun's own quarter of the sky, and
      // the approach view does not look that way; pushing turbidity and
      // pulling rayleigh back carries the warmth across the whole dome, so
      // the hour reads from every camera rather than from one.
      turbidity: 7,
      rayleigh: 2.1,
      mieCoefficient: 0.019,
      mieDirectionalG: 0.83,
      elevation: 6.5,
      environmentIntensity: 0.55,
    },
    sky: { skyColor: '#d3b795', groundColor: '#5c4a2e', intensity: 0.2 },
    bounce: { azimuthOffset: 172, elevation: 20, intensity: 0.16, color: '#9d8fa5' },
    atmosphere: {
      background: '#c2a37f',
      fogColor: '#c4a684',
      fogNear: 105,
      fogFar: 315,
      exposure: 0.56,
    },
    interior: { intensity: 13, activeLights: 4 },
    exterior: { intensity: 22, activeLights: 1 },
    surfaces: { glazingOpacity: 0.55, poolGlow: 0.07, fixtureEmissive: 0.5 },
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
    skyModel: {
      turbidity: 8,
      rayleigh: 3.2,
      mieCoefficient: 0.02,
      mieDirectionalG: 0.88,
      elevation: -1.6,
      environmentIntensity: 0.85,
    },
    sky: { skyColor: '#5f7594', groundColor: '#12161f', intensity: 0.18 },
    bounce: { azimuthOffset: 170, elevation: 26, intensity: 0.2, color: '#41577a' },
    atmosphere: {
      background: '#31425f',
      fogColor: '#3b4d6d',
      fogNear: 80,
      fogFar: 250,
      exposure: 0.8,
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
      intensity: 0.22,
      color: '#9db3d2',
      shadowExtent: 50,
      shadowBias: -0.0005,
      shadowNormalBias: 0.05,
    },
    skyModel: {
      turbidity: 10,
      rayleigh: 0.6,
      mieCoefficient: 0.03,
      mieDirectionalG: 0.9,
      elevation: -9,
      environmentIntensity: 0.5,
    },
    sky: { skyColor: '#2a3750', groundColor: '#05070b', intensity: 0.16 },
    bounce: { azimuthOffset: 170, elevation: 24, intensity: 0.12, color: '#1d2739' },
    atmosphere: {
      background: '#070b14',
      fogColor: '#0a1020',
      fogNear: 65,
      fogFar: 205,
      exposure: 1.1,
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
