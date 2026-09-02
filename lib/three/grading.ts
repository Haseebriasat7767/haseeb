import type { QualityTier, TimeOfDay } from '@/types';

/**
 * The finishing grade, per hour.
 *
 * This file deliberately holds no three.js import. It is the same rule the
 * lighting presets follow: grading values are read by UI as well as by the
 * renderer, and anything that pulls three into a page bundle costs a
 * hundred kilobytes on a route that never opens a canvas.
 */

/**
 * A primary colour grade, in the ASC CDL form the film industry uses:
 * `out = (in * slope + offset) ^ power`, then saturation, then contrast.
 *
 * Applied in linear light *before* tone mapping, where slope reads as a
 * white balance, offset as a lift into the shadows, and contrast as a
 * pivot around middle grey — which is what a colourist actually adjusts.
 * Grading after the tone map instead would be fighting the ACES curve for
 * control of the highlights and is how images end up with the clipped,
 * plastic look this is meant to avoid.
 */
export type ColorGrade = {
  /** Multiplier per channel — gain, and the hour's white balance. */
  slope: [number, number, number];
  /** Additive per channel — lifts shadows off pure black and tints them. */
  offset: [number, number, number];
  /** Per-channel gamma. Kept near 1: this is a nudge, not a curve. */
  power: [number, number, number];
  /** 1 leaves saturation alone. Above 1.1 starts to read as a filter. */
  saturation: number;
  /** S-curve strength about middle grey. 1 is off. */
  contrast: number;
  /**
   * Corner falloff, as a fraction of exposure lost at the extreme corner.
   * A real lens does this; the value is kept low enough to be felt rather
   * than seen, which is also what stops it reading as a game filter.
   */
  vignette: number;
};

export type PostGrade = ColorGrade & {
  /**
   * How much light spills from sources brighter than `bloomThreshold`.
   * Rises after dark because that is when the practicals are the subject;
   * in daylight it exists only to soften a clipped specular.
   */
  bloomStrength: number;
  /**
   * Luminance above which a pixel blooms, in linear light. Above 1.0 only
   * genuinely over-range highlights spill, which is why daylight hours sit
   * high — a lit wall should never glow.
   */
  bloomThreshold: number;
  /** Ambient-occlusion weight for the hour. */
  aoIntensity: number;
};

/**
 * Five grades, one per lighting state, and deliberately not one look
 * applied five times. A single cinematic LUT across every hour is the
 * fastest way to make a golden hour and a blue hour read as the same
 * photograph with the sun moved, and it is why so much architectural CG
 * looks templated.
 */
export const TIME_OF_DAY_GRADE: Record<TimeOfDay, PostGrade> = {
  /** Soft daylight, neutral-to-warm whites, gentle contrast. */
  morning: {
    slope: [1.0, 1.0, 1.015],
    offset: [0.004, 0.004, 0.007],
    power: [1.0, 1.0, 1.0],
    saturation: 1.02,
    contrast: 1.04,
    vignette: 0.12,
    bloomStrength: 0.09,
    bloomThreshold: 1.9,
    aoIntensity: 0.85,
  },
  /** Clean daylight. The most neutral of the five, by intent: midday is
   *  when a building should be judged on its own materials. */
  day: {
    slope: [1.0, 1.0, 1.0],
    offset: [0.0, 0.0, 0.003],
    power: [1.0, 1.0, 1.0],
    saturation: 1.03,
    contrast: 1.07,
    vignette: 0.13,
    bloomStrength: 0.07,
    bloomThreshold: 2.1,
    aoIntensity: 0.9,
  },
  /**
   * Warm key, cool shadows. The separation is carried by the offset
   * (shadows) running blue while the slope (highlights) runs warm, which
   * is how the hour actually behaves — sunlight is warm and the fill comes
   * from a blue sky — rather than by tinting the whole frame orange.
   */
  goldenHour: {
    slope: [1.035, 1.0, 0.965],
    offset: [0.002, 0.005, 0.014],
    power: [1.0, 1.0, 1.01],
    saturation: 1.06,
    contrast: 1.06,
    vignette: 0.18,
    bloomStrength: 0.16,
    bloomThreshold: 1.55,
    aoIntensity: 1.0,
  },
  /** Cool ambient against warm practicals — the widest colour separation
   *  of the five, and the hour that most rewards interior/exterior contrast. */
  blueHour: {
    slope: [0.985, 1.0, 1.035],
    offset: [0.005, 0.009, 0.019],
    power: [1.0, 1.0, 1.0],
    saturation: 1.05,
    contrast: 1.02,
    vignette: 0.2,
    bloomStrength: 0.3,
    bloomThreshold: 0.75,
    aoIntensity: 0.95,
  },
  /**
   * Deep but readable. The offset is the important value here: without it
   * the shadows crush to pure black and the landscaping and the pool
   * disappear, which is the difference between a night photograph and an
   * underexposed one.
   */
  night: {
    slope: [1.0, 0.99, 1.02],
    offset: [0.007, 0.009, 0.017],
    power: [1.0, 1.0, 0.99],
    saturation: 0.98,
    contrast: 1.0,
    vignette: 0.26,
    bloomStrength: 0.4,
    bloomThreshold: 0.58,
    aoIntensity: 0.8,
  },
};

/**
 * What the post chain costs, per tier.
 *
 * Ambient occlusion needs a full-scene normal and depth prepass before it
 * samples anything, so it is the one effect here whose cost is not merely
 * a function of screen resolution. The low tier does without: it already
 * renders no shadows at all, and adding a second scene traversal to buy
 * contact darkening on hardware that cannot afford the first one is the
 * wrong trade.
 */
export type PostProfile = {
  /** Whether the composer is mounted at all. False renders as before. */
  enabled: boolean;
  ambientOcclusion: boolean;
  /** GTAO directional samples. The dominant cost once AO is on. */
  aoSamples: number;
  /** World-space radius of the occlusion search, in metres. */
  aoRadius: number;
  /** Fraction of full resolution the AO buffers run at. */
  aoResolutionScale: number;
  bloom: boolean;
  /** MSAA samples on the composer's own targets, since a render target
   *  does not inherit the canvas's antialiasing. */
  samples: number;
};

const POST_PROFILES: Record<QualityTier, PostProfile> = {
  low: {
    enabled: false,
    ambientOcclusion: false,
    aoSamples: 0,
    aoRadius: 0,
    aoResolutionScale: 1,
    bloom: false,
    samples: 0,
  },
  medium: {
    enabled: true,
    ambientOcclusion: true,
    aoSamples: 8,
    aoRadius: 0.6,
    aoResolutionScale: 0.5,
    bloom: true,
    samples: 0,
  },
  high: {
    enabled: true,
    ambientOcclusion: true,
    aoSamples: 16,
    aoRadius: 0.7,
    aoResolutionScale: 1,
    bloom: true,
    samples: 4,
  },
};

export function getPostProfile(tier: QualityTier): PostProfile {
  return POST_PROFILES[tier];
}

export function resolveGrade(timeOfDay: TimeOfDay): PostGrade {
  return TIME_OF_DAY_GRADE[timeOfDay];
}
