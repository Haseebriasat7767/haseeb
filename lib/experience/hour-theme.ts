import { TIME_OF_DAY, TIME_OF_DAY_ORDER } from '@/lib/three/lighting';
import type { TimeOfDay } from '@/types';

/**
 * How the interface answers the hour.
 *
 * The scene already changes completely between morning and night; the
 * chrome sitting over it should acknowledge that without performing it.
 * Two values only — the colour the readability scrim fades to, and the
 * accent the hour control is drawn in — both held within a few degrees of
 * the standing palette. Nothing here changes layout, contrast class, or
 * legibility: alabaster type stays alabaster at every hour.
 */
export type HourTheme = {
  /** The colour the stage scrim resolves to at its darkest edge. */
  scrim: string;
  /** The hour control's accent. Warm at golden hour, cool after dusk. */
  accent: string;
};

const THEME: Record<TimeOfDay, HourTheme> = {
  morning: { scrim: '#0a0b0d', accent: '#cbbea0' },
  day: { scrim: '#090a0c', accent: '#c4b799' },
  goldenHour: { scrim: '#0e0a07', accent: '#c9a86a' },
  blueHour: { scrim: '#07080f', accent: '#a3adc4' },
  night: { scrim: '#050507', accent: '#94a0b6' },
};

export function hourTheme(hour: TimeOfDay): HourTheme {
  return THEME[hour];
}

/** The hours, in order, as the slider steps through them. */
export const HOURS = TIME_OF_DAY_ORDER;

export function hourLabel(hour: TimeOfDay): string {
  return TIME_OF_DAY[hour].label;
}

/** Clamps a slider position onto a real, supported lighting state. */
export function hourAt(index: number): TimeOfDay {
  const clamped = Math.min(HOURS.length - 1, Math.max(0, Math.round(index)));
  return HOURS[clamped]!;
}

export function hourIndex(hour: TimeOfDay): number {
  const at = HOURS.indexOf(hour);
  return at < 0 ? 0 : at;
}
